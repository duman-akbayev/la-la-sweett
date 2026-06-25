/**
 * Tests for WhatsApp Graceful Degradation Module
 *
 * Validates:
 * - AI timeout handling (>10s sends acknowledgment)
 * - Retry with exponential backoff on failed API calls
 * - Owner alert when all retries exhausted
 * - 24-hour follow-up scheduling for abandoned intake flows
 *
 * Requirements: 12.2, 12.6, 7.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleWithTimeout,
  sendAcknowledgment,
  alertOwnerOnFailure,
  scheduleFollowUp,
  cancelFollowUp,
  getScheduledFollowUp,
  processFollowUp,
  DEFAULT_TIMEOUT_MS,
  ACKNOWLEDGMENT_MESSAGE,
  FOLLOWUP_KEY_PREFIX,
  FOLLOWUP_DELAY_SECONDS,
  FOLLOWUP_MESSAGE,
} from './whatsapp-degradation';

// Mock dependencies
vi.mock('@/integrations/whatsapp', () => ({
  whatsappIntegration: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendTemplate: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/retry', () => ({
  retryExternalCall: vi.fn(
    async (_apiName: string, fn: () => Promise<unknown>) => {
      return fn();
    }
  ),
}));

vi.mock('@/services/notification.service', () => ({
  notificationService: {
    notifyOwner: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockRedisStore: Record<string, { value: string; ttl?: number }> = {};

vi.mock('@/lib/redis', () => ({
  getRedisClient: () => ({
    set: vi.fn(async (key: string, value: string, _mode?: string, ttl?: number) => {
      mockRedisStore[key] = { value, ttl };
      return 'OK';
    }),
    get: vi.fn(async (key: string) => {
      return mockRedisStore[key]?.value ?? null;
    }),
    del: vi.fn(async (key: string) => {
      delete mockRedisStore[key];
      return 1;
    }),
  }),
  REDIS_KEYS: {
    SESSION: 'session:',
    RATE_LIMIT: 'ratelimit:',
    NOTIFICATION_QUEUE: 'notifications:queue',
  },
}));

// Get mocked modules
import { whatsappIntegration } from '@/integrations/whatsapp';
import { retryExternalCall } from '@/lib/retry';
import { notificationService } from '@/services/notification.service';

describe('WhatsApp Graceful Degradation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Clear mock Redis store
    Object.keys(mockRedisStore).forEach((key) => delete mockRedisStore[key]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // handleWithTimeout
  // ---------------------------------------------------------------------------
  describe('handleWithTimeout', () => {
    it('should return success when operation completes within timeout', async () => {
      const processFn = vi.fn().mockResolvedValue('ai-response');

      const resultPromise = handleWithTimeout(processFn, '+15551234567', 10000);
      // Advance time but not past timeout
      await vi.advanceTimersByTimeAsync(100);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.result).toBe('ai-response');
      expect(result.timedOut).toBe(false);
      expect(whatsappIntegration.sendMessage).not.toHaveBeenCalled();
    });

    it('should send acknowledgment when operation times out after 10s', async () => {
      // Create a function that never resolves (simulates slow AI)
      const processFn = vi.fn(
        () => new Promise<string>(() => {}) // Never resolves
      );

      const resultPromise = handleWithTimeout(processFn, '+15551234567', 10000);

      // Advance past the 10s timeout
      await vi.advanceTimersByTimeAsync(10001);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.result).toBeUndefined();
      // Should send acknowledgment message
      expect(retryExternalCall).toHaveBeenCalledWith(
        'whatsapp',
        expect.any(Function)
      );
    });

    it('should use DEFAULT_TIMEOUT_MS when no timeout specified', async () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(10000);

      const processFn = vi.fn(
        () => new Promise<string>(() => {})
      );

      const resultPromise = handleWithTimeout(processFn, '+15551234567');

      // Advance just before timeout — should not trigger
      await vi.advanceTimersByTimeAsync(9999);
      // Not yet timed out since we haven't awaited
      
      // Now advance past timeout
      await vi.advanceTimersByTimeAsync(2);
      const result = await resultPromise;

      expect(result.timedOut).toBe(true);
    });

    it('should handle operation that rejects before timeout', async () => {
      vi.useRealTimers(); // Use real timers for this test since it resolves immediately
      const processFn = vi.fn().mockRejectedValue(new Error('AI error'));

      await expect(
        handleWithTimeout(processFn, '+15551234567', 10000)
      ).rejects.toThrow('AI error');
    });
  });

  // ---------------------------------------------------------------------------
  // sendAcknowledgment
  // ---------------------------------------------------------------------------
  describe('sendAcknowledgment', () => {
    it('should send the predefined acknowledgment message', async () => {
      await sendAcknowledgment('+15551234567');

      expect(retryExternalCall).toHaveBeenCalledWith(
        'whatsapp',
        expect.any(Function)
      );

      // Execute the retry callback to verify it calls sendMessage correctly
      const retryFn = vi.mocked(retryExternalCall).mock.calls[0][1];
      await retryFn();

      expect(whatsappIntegration.sendMessage).toHaveBeenCalledWith(
        '+15551234567',
        ACKNOWLEDGMENT_MESSAGE
      );
    });

    it('should send custom message when provided', async () => {
      const customMessage = 'Custom acknowledgment!';
      await sendAcknowledgment('+15551234567', customMessage);

      const retryFn = vi.mocked(retryExternalCall).mock.calls[0][1];
      await retryFn();

      expect(whatsappIntegration.sendMessage).toHaveBeenCalledWith(
        '+15551234567',
        customMessage
      );
    });

    it('should alert owner if acknowledgment send fails after retries', async () => {
      vi.mocked(retryExternalCall).mockRejectedValueOnce(
        new Error('WhatsApp API unreachable')
      );

      await sendAcknowledgment('+15551234567');

      expect(notificationService.notifyOwner).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system_alert',
          priority: 'high',
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // alertOwnerOnFailure
  // ---------------------------------------------------------------------------
  describe('alertOwnerOnFailure', () => {
    it('should notify owner with error details', async () => {
      const error = new Error('Connection refused');

      await alertOwnerOnFailure(error, {
        operation: 'send_message',
        recipientPhone: '+15551234567',
        message: 'Failed to send response',
      });

      expect(notificationService.notifyOwner).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system_alert',
          priority: 'high',
          content: expect.stringContaining('WhatsApp API Failure'),
        })
      );

      const call = vi.mocked(notificationService.notifyOwner).mock.calls[0][0];
      expect(call.content).toContain('send_message');
      expect(call.content).toContain('+15551234567');
      expect(call.content).toContain('Connection refused');
    });

    it('should log error if notification itself fails', async () => {
      vi.mocked(notificationService.notifyOwner).mockRejectedValueOnce(
        new Error('Notification service down')
      );
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await alertOwnerOnFailure(new Error('API error'), {
        operation: 'test_op',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[WhatsApp Degradation] Failed to alert owner:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Follow-up scheduling (24-hour abandoned intake)
  // ---------------------------------------------------------------------------
  describe('scheduleFollowUp', () => {
    it('should store follow-up data in Redis with correct TTL', async () => {
      await scheduleFollowUp('+15551234567', 'order-123');

      const key = `${FOLLOWUP_KEY_PREFIX}+15551234567`;
      expect(mockRedisStore[key]).toBeDefined();

      const data = JSON.parse(mockRedisStore[key].value);
      expect(data.phone).toBe('+15551234567');
      expect(data.orderId).toBe('order-123');
      expect(data.message).toBe(FOLLOWUP_MESSAGE);
      // TTL should be 24h + 1h buffer
      expect(mockRedisStore[key].ttl).toBe(FOLLOWUP_DELAY_SECONDS + 3600);
    });

    it('should work without an orderId', async () => {
      await scheduleFollowUp('+15559876543');

      const key = `${FOLLOWUP_KEY_PREFIX}+15559876543`;
      const data = JSON.parse(mockRedisStore[key].value);
      expect(data.phone).toBe('+15559876543');
      expect(data.orderId).toBeUndefined();
    });
  });

  describe('cancelFollowUp', () => {
    it('should remove the follow-up from Redis', async () => {
      const key = `${FOLLOWUP_KEY_PREFIX}+15551234567`;
      mockRedisStore[key] = {
        value: JSON.stringify({ phone: '+15551234567', message: FOLLOWUP_MESSAGE }),
      };

      await cancelFollowUp('+15551234567');

      expect(mockRedisStore[key]).toBeUndefined();
    });
  });

  describe('getScheduledFollowUp', () => {
    it('should return follow-up data if scheduled', async () => {
      const key = `${FOLLOWUP_KEY_PREFIX}+15551234567`;
      const followUpData = {
        phone: '+15551234567',
        orderId: 'order-456',
        scheduledAt: '2025-01-01T12:00:00.000Z',
        message: FOLLOWUP_MESSAGE,
      };
      mockRedisStore[key] = { value: JSON.stringify(followUpData) };

      const result = await getScheduledFollowUp('+15551234567');

      expect(result).toEqual(followUpData);
    });

    it('should return null if no follow-up is scheduled', async () => {
      const result = await getScheduledFollowUp('+15559999999');
      expect(result).toBeNull();
    });
  });

  describe('processFollowUp', () => {
    it('should send follow-up message and remove from Redis', async () => {
      const key = `${FOLLOWUP_KEY_PREFIX}+15551234567`;
      mockRedisStore[key] = {
        value: JSON.stringify({
          phone: '+15551234567',
          orderId: 'order-789',
          scheduledAt: '2025-01-01T12:00:00.000Z',
          message: FOLLOWUP_MESSAGE,
        }),
      };

      const result = await processFollowUp('+15551234567');

      expect(result).toBe(true);
      expect(retryExternalCall).toHaveBeenCalledWith(
        'whatsapp',
        expect.any(Function)
      );
      // Verify message was sent
      const retryFn = vi.mocked(retryExternalCall).mock.calls[0][1];
      await retryFn();
      expect(whatsappIntegration.sendMessage).toHaveBeenCalledWith(
        '+15551234567',
        FOLLOWUP_MESSAGE
      );
      // Should be removed from Redis
      expect(mockRedisStore[key]).toBeUndefined();
    });

    it('should return false if no follow-up is pending', async () => {
      const result = await processFollowUp('+15559999999');
      expect(result).toBe(false);
      expect(retryExternalCall).not.toHaveBeenCalled();
    });

    it('should alert owner if follow-up delivery fails', async () => {
      const key = `${FOLLOWUP_KEY_PREFIX}+15551234567`;
      mockRedisStore[key] = {
        value: JSON.stringify({
          phone: '+15551234567',
          orderId: 'order-fail',
          scheduledAt: '2025-01-01T12:00:00.000Z',
          message: FOLLOWUP_MESSAGE,
        }),
      };

      vi.mocked(retryExternalCall).mockRejectedValueOnce(
        new Error('All retries failed')
      );

      const result = await processFollowUp('+15551234567');

      expect(result).toBe(false);
      expect(notificationService.notifyOwner).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system_alert',
          priority: 'high',
          content: expect.stringContaining('send_followup'),
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Constants validation
  // ---------------------------------------------------------------------------
  describe('constants', () => {
    it('should have 10-second default timeout', () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
    });

    it('should have 24-hour follow-up delay', () => {
      expect(FOLLOWUP_DELAY_SECONDS).toBe(86400);
    });

    it('should have a meaningful acknowledgment message', () => {
      expect(ACKNOWLEDGMENT_MESSAGE).toContain('processing');
      expect(ACKNOWLEDGMENT_MESSAGE.length).toBeGreaterThan(10);
    });

    it('should have a meaningful follow-up message', () => {
      expect(FOLLOWUP_MESSAGE).toContain('continue');
      expect(FOLLOWUP_MESSAGE.length).toBeGreaterThan(10);
    });
  });
});
