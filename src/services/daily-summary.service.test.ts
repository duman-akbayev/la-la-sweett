/**
 * Tests for Daily Summary Service
 *
 * Validates:
 * - Daily summary scheduling at 20:00 local time (Requirement 8.3)
 * - Daily summary generation with correct stats
 * - Unresponded message detection after 30 minutes (Requirement 8.5)
 * - Alert sending for unresponded messages
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DailySummaryService,
  UNRESPONDED_THRESHOLD_MS,
  DAILY_SUMMARY_HOUR,
  DAILY_SUMMARY_MINUTE,
} from './daily-summary.service';
import type { PendingMessage } from './daily-summary.service';
import type { DailySummary } from '../types';

// Shared store for Redis mock — cleared in beforeEach
let redisStore: Map<string, Map<string, string>>;

// Mock Redis
vi.mock('../lib/redis', () => {
  return {
    getRedisClient: () => ({
      hset: vi.fn(async (key: string, field: string, value: string) => {
        if (!redisStore.has(key)) {
          redisStore.set(key, new Map());
        }
        redisStore.get(key)!.set(field, value);
        return 1;
      }),
      hget: vi.fn(async (key: string, field: string) => {
        return redisStore.get(key)?.get(field) ?? null;
      }),
      hdel: vi.fn(async (key: string, field: string) => {
        redisStore.get(key)?.delete(field);
        return 1;
      }),
      hgetall: vi.fn(async (key: string) => {
        const map = redisStore.get(key);
        if (!map || map.size === 0) return {};
        const result: Record<string, string> = {};
        for (const [k, v] of map) {
          result[k] = v;
        }
        return result;
      }),
      del: vi.fn(async (key: string) => {
        redisStore.delete(key);
        return 1;
      }),
    }),
    REDIS_KEYS: {
      SESSION: 'session:',
      RATE_LIMIT: 'ratelimit:',
      NOTIFICATION_QUEUE: 'notifications:queue',
    },
  };
});

// Mock notification service
vi.mock('./notification.service', () => ({
  notificationService: {
    sendDailySummary: vi.fn(async () => {}),
    notifyOwner: vi.fn(async () => {}),
    setDailySummaryProvider: vi.fn(),
    _dailySummaryProvider: null,
  },
}));

import { notificationService } from './notification.service';

describe('DailySummaryService', () => {
  let service: DailySummaryService;

  beforeEach(() => {
    vi.useFakeTimers();
    redisStore = new Map();
    service = new DailySummaryService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Scheduling Tests
  // ---------------------------------------------------------------------------

  describe('scheduleDailySummary', () => {
    it('should calculate time until next 20:00 correctly when before 20:00', () => {
      // Set current time to 14:00 today
      const today14h = new Date();
      today14h.setHours(14, 0, 0, 0);
      vi.setSystemTime(today14h);

      const ms = service.getMillisecondsUntilNextSummary();

      // Should be 6 hours (14:00 → 20:00)
      const expectedMs = 6 * 60 * 60 * 1000;
      expect(ms).toBe(expectedMs);
    });

    it('should schedule for next day when after 20:00', () => {
      // Set current time to 21:00 today
      const today21h = new Date();
      today21h.setHours(21, 0, 0, 0);
      vi.setSystemTime(today21h);

      const ms = service.getMillisecondsUntilNextSummary();

      // Should be 23 hours (21:00 today → 20:00 tomorrow)
      const expectedMs = 23 * 60 * 60 * 1000;
      expect(ms).toBe(expectedMs);
    });

    it('should schedule for next day when exactly at 20:00', () => {
      // Set current time to exactly 20:00
      const today20h = new Date();
      today20h.setHours(DAILY_SUMMARY_HOUR, DAILY_SUMMARY_MINUTE, 0, 0);
      vi.setSystemTime(today20h);

      const ms = service.getMillisecondsUntilNextSummary();

      // Should be 24 hours (since now >= target)
      const expectedMs = 24 * 60 * 60 * 1000;
      expect(ms).toBe(expectedMs);
    });

    it('should execute daily summary at scheduled time', async () => {
      // Set time to 19:59:00
      const beforeSummary = new Date();
      beforeSummary.setHours(19, 59, 0, 0);
      vi.setSystemTime(beforeSummary);

      service.start();

      // Advance time to 20:00:00 (1 minute)
      await vi.advanceTimersByTimeAsync(60 * 1000);

      expect(notificationService.sendDailySummary).toHaveBeenCalledTimes(1);
    });

    it('should use data provider when configured', async () => {
      const mockSummary: DailySummary = {
        date: new Date(),
        totalInquiries: 15,
        ordersReceived: 5,
        estimatedRevenue: 2500,
        topCakeTypes: [
          { type: 'Birthday', count: 8 },
          { type: 'Wedding', count: 4 },
          { type: 'Cupcakes', count: 3 },
        ],
      };

      const provider = vi.fn(async () => mockSummary);
      service.setDataProvider(provider);

      const result = await service.generateDailySummary();

      expect(provider).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSummary);
    });

    it('should return empty summary when no data provider is set', async () => {
      const result = await service.generateDailySummary();

      expect(result.totalInquiries).toBe(0);
      expect(result.ordersReceived).toBe(0);
      expect(result.estimatedRevenue).toBe(0);
      expect(result.topCakeTypes).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Service Lifecycle Tests
  // ---------------------------------------------------------------------------

  describe('start/stop', () => {
    it('should set isRunning to true when started', () => {
      service.start();
      expect(service.isRunning).toBe(true);
    });

    it('should set isRunning to false when stopped', () => {
      service.start();
      service.stop();
      expect(service.isRunning).toBe(false);
    });

    it('should not start twice', () => {
      // Set time to 14:00 so we have a predictable wait
      const today14h = new Date();
      today14h.setHours(14, 0, 0, 0);
      vi.setSystemTime(today14h);

      service.start();
      service.start(); // Second call should be no-op

      expect(service.isRunning).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Unresponded Message Tests
  // ---------------------------------------------------------------------------

  describe('checkUnrespondedMessages', () => {
    it('should send alert for messages waiting > 30 minutes', async () => {
      const thirtyOneMinutesAgo = new Date(
        Date.now() - 31 * 60 * 1000
      ).toISOString();

      const pendingMessage: PendingMessage = {
        messageId: 'msg_001',
        customerName: 'Alice Baker',
        channel: 'whatsapp',
        content: 'Hi, I need a birthday cake for next Saturday!',
        receivedAt: thirtyOneMinutesAgo,
        alerted: false,
      };

      await service.trackPendingMessage(pendingMessage);
      await service.checkUnrespondedMessages();

      expect(notificationService.notifyOwner).toHaveBeenCalledTimes(1);
      const call = vi.mocked(notificationService.notifyOwner).mock.calls[0][0];
      expect(call.type).toBe('unresponded_alert');
      expect(call.priority).toBe('high');
      expect(call.content).toContain('Alice Baker');
      expect(call.content).toContain('whatsapp');
    });

    it('should NOT send alert for messages waiting < 30 minutes', async () => {
      const tenMinutesAgo = new Date(
        Date.now() - 10 * 60 * 1000
      ).toISOString();

      const pendingMessage: PendingMessage = {
        messageId: 'msg_002',
        customerName: 'Bob Smith',
        channel: 'instagram',
        content: 'What are your prices?',
        receivedAt: tenMinutesAgo,
        alerted: false,
      };

      await service.trackPendingMessage(pendingMessage);
      await service.checkUnrespondedMessages();

      expect(notificationService.notifyOwner).not.toHaveBeenCalled();
    });

    it('should NOT alert again for already-alerted messages', async () => {
      const fortyMinutesAgo = new Date(
        Date.now() - 40 * 60 * 1000
      ).toISOString();

      const pendingMessage: PendingMessage = {
        messageId: 'msg_003',
        customerName: 'Carol Lee',
        channel: 'chat_widget',
        content: 'Do you have gluten-free options?',
        receivedAt: fortyMinutesAgo,
        alerted: true, // Already alerted
      };

      await service.trackPendingMessage(pendingMessage);
      await service.checkUnrespondedMessages();

      expect(notificationService.notifyOwner).not.toHaveBeenCalled();
    });

    it('should remove message from pending when marked as responded', async () => {
      const pendingMessage: PendingMessage = {
        messageId: 'msg_004',
        customerName: 'Dave Wilson',
        channel: 'whatsapp',
        content: 'Can I order a wedding cake?',
        receivedAt: new Date().toISOString(),
        alerted: false,
      };

      await service.trackPendingMessage(pendingMessage);

      let messages = await service.getPendingMessages();
      expect(messages).toHaveLength(1);

      await service.markMessageResponded('msg_004');

      messages = await service.getPendingMessages();
      expect(messages).toHaveLength(0);
    });

    it('should mark message as alerted after sending alert', async () => {
      const thirtyFiveMinutesAgo = new Date(
        Date.now() - 35 * 60 * 1000
      ).toISOString();

      const pendingMessage: PendingMessage = {
        messageId: 'msg_005',
        customerName: 'Eve Green',
        channel: 'instagram',
        content: 'How much for a 3-tier cake?',
        receivedAt: thirtyFiveMinutesAgo,
        alerted: false,
      };

      await service.trackPendingMessage(pendingMessage);
      await service.checkUnrespondedMessages();

      // Verify the alert was sent
      expect(notificationService.notifyOwner).toHaveBeenCalledTimes(1);

      // Check that second call doesn't send another alert
      vi.mocked(notificationService.notifyOwner).mockClear();
      await service.checkUnrespondedMessages();
      expect(notificationService.notifyOwner).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Alert Content Tests
  // ---------------------------------------------------------------------------

  describe('sendUnrespondedAlert', () => {
    it('should format alert with customer name, channel, and elapsed time', async () => {
      const thirtyTwoMinutesAgo = new Date(
        Date.now() - 32 * 60 * 1000
      ).toISOString();

      const message: PendingMessage = {
        messageId: 'msg_alert_001',
        customerName: 'Frank Torres',
        channel: 'whatsapp',
        content: 'I want to order a custom cake for my daughter',
        receivedAt: thirtyTwoMinutesAgo,
        alerted: false,
      };

      await service.sendUnrespondedAlert(message);

      const call = vi.mocked(notificationService.notifyOwner).mock.calls[0][0];
      expect(call.content).toContain('Frank Torres');
      expect(call.content).toContain('whatsapp');
      expect(call.content).toContain('32 minutes');
      expect(call.content).toContain(
        'I want to order a custom cake for my daughter'
      );
    });

    it('should truncate long message content to 200 characters', async () => {
      const longContent = 'A'.repeat(300);
      const thirtyMinutesAgo = new Date(
        Date.now() - 31 * 60 * 1000
      ).toISOString();

      const message: PendingMessage = {
        messageId: 'msg_alert_002',
        customerName: 'Grace Kim',
        channel: 'instagram',
        content: longContent,
        receivedAt: thirtyMinutesAgo,
        alerted: false,
      };

      await service.sendUnrespondedAlert(message);

      const call = vi.mocked(notificationService.notifyOwner).mock.calls[0][0];
      // Should contain truncated content with ellipsis
      expect(call.content).toContain('...');
      expect(call.content).not.toContain(longContent);
    });

    it('should set priority to high for unresponded alerts', async () => {
      const message: PendingMessage = {
        messageId: 'msg_alert_003',
        customerName: 'Henry Park',
        channel: 'chat_widget',
        content: 'Hello?',
        receivedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
        alerted: false,
      };

      await service.sendUnrespondedAlert(message);

      const call = vi.mocked(notificationService.notifyOwner).mock.calls[0][0];
      expect(call.priority).toBe('high');
      expect(call.type).toBe('unresponded_alert');
    });
  });

  // ---------------------------------------------------------------------------
  // Pending Message Tracking Tests
  // ---------------------------------------------------------------------------

  describe('pending message tracking', () => {
    it('should track and retrieve pending messages', async () => {
      const msg: PendingMessage = {
        messageId: 'track_001',
        customerName: 'Iris Wang',
        channel: 'whatsapp',
        content: 'Do you deliver to Round Rock?',
        receivedAt: new Date().toISOString(),
        alerted: false,
      };

      await service.trackPendingMessage(msg);
      const messages = await service.getPendingMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0].messageId).toBe('track_001');
      expect(messages[0].customerName).toBe('Iris Wang');
    });

    it('should clear all pending messages', async () => {
      const msg1: PendingMessage = {
        messageId: 'clear_001',
        customerName: 'Jack Brown',
        channel: 'instagram',
        content: 'Pricing?',
        receivedAt: new Date().toISOString(),
        alerted: false,
      };
      const msg2: PendingMessage = {
        messageId: 'clear_002',
        customerName: 'Kate White',
        channel: 'chat_widget',
        content: 'Available dates?',
        receivedAt: new Date().toISOString(),
        alerted: false,
      };

      await service.trackPendingMessage(msg1);
      await service.trackPendingMessage(msg2);

      let messages = await service.getPendingMessages();
      expect(messages).toHaveLength(2);

      await service.clearPendingMessages();

      messages = await service.getPendingMessages();
      expect(messages).toHaveLength(0);
    });

    it('should handle multiple pending messages independently', async () => {
      const old = new Date(Date.now() - 35 * 60 * 1000).toISOString();
      const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      await service.trackPendingMessage({
        messageId: 'multi_001',
        customerName: 'Liam Fox',
        channel: 'whatsapp',
        content: 'Old message',
        receivedAt: old,
        alerted: false,
      });

      await service.trackPendingMessage({
        messageId: 'multi_002',
        customerName: 'Mia Hart',
        channel: 'instagram',
        content: 'Recent message',
        receivedAt: recent,
        alerted: false,
      });

      await service.checkUnrespondedMessages();

      // Only the old message should trigger an alert
      expect(notificationService.notifyOwner).toHaveBeenCalledTimes(1);
      const call = vi.mocked(notificationService.notifyOwner).mock.calls[0][0];
      expect(call.content).toContain('Liam Fox');
    });
  });

  // ---------------------------------------------------------------------------
  // Periodic Check Tests
  // ---------------------------------------------------------------------------

  describe('periodic unresponded check', () => {
    it('should check unresponded messages periodically when started', async () => {
      const fortyMinutesAgo = new Date(
        Date.now() - 40 * 60 * 1000
      ).toISOString();

      await service.trackPendingMessage({
        messageId: 'periodic_001',
        customerName: 'Noah Chen',
        channel: 'whatsapp',
        content: 'Cake inquiry',
        receivedAt: fortyMinutesAgo,
        alerted: false,
      });

      service.start();

      // Advance by 5 minutes (one check interval)
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(notificationService.notifyOwner).toHaveBeenCalledTimes(1);
    });
  });
});
