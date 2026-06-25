/**
 * Tests for WhatsApp Rate Limiting Module
 *
 * Validates: Requirement 11.3
 * - 20 messages per minute per phone number (sliding window)
 * - Single rate-limit notification on first rejection
 * - Silent drop for subsequent excess messages
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Redis before importing the module
const mockPipeline = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

const mockRedis = {
  pipeline: vi.fn(() => mockPipeline),
  zrange: vi.fn(),
  zadd: vi.fn(),
  expire: vi.fn(),
  del: vi.fn(),
  set: vi.fn(),
};

vi.mock('@/lib/redis', () => ({
  getRedisClient: () => mockRedis,
  REDIS_KEYS: {
    SESSION: 'session:',
    RATE_LIMIT: 'ratelimit:',
    NOTIFICATION_QUEUE: 'notifications:queue',
  },
}));

import {
  checkWhatsAppRateLimit,
  getRateLimitMessage,
} from './whatsapp-rate-limit';

describe('WhatsApp Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkWhatsAppRateLimit', () => {
    it('allows messages when under the rate limit', async () => {
      // Simulate 5 existing requests (well under 20 limit)
      mockPipeline.exec.mockResolvedValue([
        [null, 0], // zremrangebyscore result
        [null, 5], // zcard returns 5 (under limit)
      ]);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await checkWhatsAppRateLimit('+15551234567');

      expect(result.allowed).toBe(true);
      expect(result.shouldNotify).toBe(false);
      expect(result.retryAfter).toBeUndefined();
    });

    it('rejects messages when at the rate limit (20 messages)', async () => {
      // Simulate 20 existing requests (at the limit)
      mockPipeline.exec.mockResolvedValue([
        [null, 0], // zremrangebyscore result
        [null, 20], // zcard returns 20 (at limit)
      ]);
      // Return oldest entry for retryAfter calculation
      mockRedis.zrange.mockResolvedValue([
        'entry-1',
        String(Date.now() - 30000), // 30 seconds ago
      ]);
      // First rejection — SET NX succeeds (notification not yet sent)
      mockRedis.set.mockResolvedValue('OK');

      const result = await checkWhatsAppRateLimit('+15551234567');

      expect(result.allowed).toBe(false);
      expect(result.shouldNotify).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('silently drops subsequent excess messages (shouldNotify=false)', async () => {
      // Simulate 20 existing requests (at the limit)
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 20],
      ]);
      mockRedis.zrange.mockResolvedValue([
        'entry-1',
        String(Date.now() - 30000),
      ]);
      // SET NX returns null — notification was already sent
      mockRedis.set.mockResolvedValue(null);

      const result = await checkWhatsAppRateLimit('+15551234567');

      expect(result.allowed).toBe(false);
      expect(result.shouldNotify).toBe(false);
    });

    it('allows the 20th message (limit is inclusive at 20)', async () => {
      // 19 existing requests — the 20th should still be allowed
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 19],
      ]);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await checkWhatsAppRateLimit('+15551234567');

      expect(result.allowed).toBe(true);
      expect(result.shouldNotify).toBe(false);
    });

    it('uses different rate limit keys for different phone numbers', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 0],
      ]);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await checkWhatsAppRateLimit('+15551111111');
      await checkWhatsAppRateLimit('+15552222222');

      // Verify pipeline was called for each phone number separately
      expect(mockRedis.pipeline).toHaveBeenCalledTimes(2);
    });

    it('defaults to allowing when Redis pipeline fails', async () => {
      mockPipeline.exec.mockResolvedValue(null);

      const result = await checkWhatsAppRateLimit('+15551234567');

      expect(result.allowed).toBe(true);
      expect(result.shouldNotify).toBe(false);
    });
  });

  describe('getRateLimitMessage', () => {
    it('returns a message with the retry time', () => {
      const message = getRateLimitMessage(45);

      expect(message).toContain('45 seconds');
      expect(message).toContain('too many messages');
    });

    it('defaults to 60 seconds when retryAfter is undefined', () => {
      const message = getRateLimitMessage(undefined);

      expect(message).toContain('60 seconds');
    });

    it('returns a non-empty string', () => {
      const message = getRateLimitMessage(30);

      expect(message.length).toBeGreaterThan(0);
    });
  });
});
