/**
 * Tests for Weekly Analytics Delivery Service
 *
 * Validates: Requirements 14.2, 14.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WeeklyAnalyticsService,
  DEFAULT_ANALYTICS_HOUR,
  DEFAULT_ANALYTICS_MINUTE,
} from './weekly-analytics.service';
import type { WeeklyReport, Channel } from '../types';

// Mock dependencies
vi.mock('./notification.service', () => ({
  notificationService: {
    notifyOwner: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../integrations/telegram.bot', () => ({
  telegramBot: {
    setAnalyticsProvider: vi.fn(),
    _analyticsProvider: null,
  },
}));

vi.mock('./marketing.service', () => ({
  marketingService: {
    getWeeklyAnalytics: vi.fn().mockResolvedValue({
      weekStarting: new Date('2024-06-10'),
      weekEnding: new Date('2024-06-16'),
      totalConversationsByChannel: {
        whatsapp: 10,
        instagram: 5,
        chat_widget: 15,
      },
      topTopics: [
        { topic: 'Birthday cakes', count: 8 },
        { topic: 'Wedding cakes', count: 6 },
        { topic: 'Pricing', count: 4 },
      ],
      conversionRate: 0.25,
      averageResponseTimeByChannel: {
        whatsapp: 3000,
        instagram: 4000,
        chat_widget: 2500,
      },
    }),
  },
}));

import { notificationService } from './notification.service';
import { telegramBot } from '../integrations/telegram.bot';
import { marketingService } from './marketing.service';

describe('WeeklyAnalyticsService', () => {
  let service: WeeklyAnalyticsService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    service = new WeeklyAnalyticsService();
  });

  afterEach(() => {
    service.stopScheduler();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Constructor and Defaults
  // ---------------------------------------------------------------------------

  describe('constructor', () => {
    it('uses default analytics hour and minute', () => {
      expect(service.hour).toBe(DEFAULT_ANALYTICS_HOUR);
      expect(service.minute).toBe(DEFAULT_ANALYTICS_MINUTE);
    });

    it('accepts custom hour and minute', () => {
      const custom = new WeeklyAnalyticsService(undefined, 14, 30);
      expect(custom.hour).toBe(14);
      expect(custom.minute).toBe(30);
    });

    it('accepts custom analytics provider', async () => {
      const mockReport: WeeklyReport = {
        weekStarting: new Date('2024-06-10'),
        weekEnding: new Date('2024-06-16'),
        totalConversationsByChannel: {
          whatsapp: 20,
          instagram: 10,
          chat_widget: 30,
        } as Record<Channel, number>,
        topTopics: [{ topic: 'Custom topic', count: 5 }],
        conversionRate: 0.5,
        averageResponseTimeByChannel: {
          whatsapp: 2000,
          instagram: 3000,
          chat_widget: 1500,
        } as Record<Channel, number>,
      };

      const customProvider = vi.fn().mockResolvedValue(mockReport);
      const custom = new WeeklyAnalyticsService(customProvider);

      const report = await custom.deliverWeeklyAnalytics();
      expect(customProvider).toHaveBeenCalled();
      expect(report.totalConversationsByChannel.whatsapp).toBe(20);
    });
  });

  // ---------------------------------------------------------------------------
  // Telegram Bot Wiring
  // ---------------------------------------------------------------------------

  describe('wireTelegramBot', () => {
    it('sets the analytics provider on the Telegram bot', () => {
      service.wireTelegramBot();

      expect(telegramBot.setAnalyticsProvider).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('wired provider returns marketing service data when called', async () => {
      service.wireTelegramBot();

      // Get the provider function that was passed to setAnalyticsProvider
      const providerFn = (telegramBot.setAnalyticsProvider as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const report = await providerFn();

      expect(report.totalConversationsByChannel.whatsapp).toBe(10);
      expect(report.conversionRate).toBe(0.25);
    });
  });

  // ---------------------------------------------------------------------------
  // Initialize
  // ---------------------------------------------------------------------------

  describe('initialize', () => {
    it('wires the Telegram bot and starts the scheduler', () => {
      service.initialize();

      expect(telegramBot.setAnalyticsProvider).toHaveBeenCalled();
      expect(service.isRunning).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Weekly Scheduling
  // ---------------------------------------------------------------------------

  describe('scheduler', () => {
    it('starts and stops the scheduler', () => {
      expect(service.isRunning).toBe(false);

      service.startScheduler();
      expect(service.isRunning).toBe(true);

      service.stopScheduler();
      expect(service.isRunning).toBe(false);
    });

    it('does not start twice', () => {
      service.startScheduler();
      service.startScheduler(); // second call is no-op
      expect(service.isRunning).toBe(true);
    });

    it('schedules delivery for next Monday', () => {
      // Set current time to Wednesday 2024-06-12 at 10:00
      vi.setSystemTime(new Date('2024-06-12T10:00:00'));

      service.startScheduler();

      // Should schedule for Monday 2024-06-17 at 09:00 (default)
      // Advance to just before Monday
      vi.advanceTimersByTime(4 * 24 * 60 * 60 * 1000); // 4 days

      // notifyOwner should not have been called yet
      expect(notificationService.notifyOwner).not.toHaveBeenCalled();
    });

    it('delivers analytics when Monday timer fires', async () => {
      // Set current time to Monday 2024-06-10 at 08:00 (before delivery time)
      vi.setSystemTime(new Date('2024-06-10T08:00:00'));

      service.startScheduler();

      // Advance 1 hour to reach 09:00
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(notificationService.notifyOwner).toHaveBeenCalled();
    });

    it('reschedules for next Monday after delivery', async () => {
      // Set current time to Monday 2024-06-10 at 08:00
      vi.setSystemTime(new Date('2024-06-10T08:00:00'));

      service.startScheduler();

      // Advance to trigger first delivery
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(notificationService.notifyOwner).toHaveBeenCalledTimes(1);

      // Advance a full week to trigger next delivery
      await vi.advanceTimersByTimeAsync(7 * 24 * 60 * 60 * 1000);

      expect(notificationService.notifyOwner).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getMillisecondsUntilNextMonday
  // ---------------------------------------------------------------------------

  describe('getMillisecondsUntilNextMonday', () => {
    it('calculates correct ms from Wednesday to Monday', () => {
      // Wednesday 2024-06-12 at 10:00
      vi.setSystemTime(new Date('2024-06-12T10:00:00'));

      const ms = service.getMillisecondsUntilNextMonday();

      // Next Monday is 2024-06-17 at 09:00 (5 days minus 1 hour)
      const expected =
        4 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000;
      expect(ms).toBe(expected);
    });

    it('returns 7 days if already past Monday delivery time', () => {
      // Monday 2024-06-10 at 10:00 (past default 09:00)
      vi.setSystemTime(new Date('2024-06-10T10:00:00'));

      const ms = service.getMillisecondsUntilNextMonday();

      // Should be next Monday at 09:00 (6 days + 23 hours)
      const expected =
        6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000;
      expect(ms).toBe(expected);
    });

    it('returns correct ms on Monday before delivery time', () => {
      // Monday 2024-06-10 at 08:00 (before default 09:00)
      vi.setSystemTime(new Date('2024-06-10T08:00:00'));

      const ms = service.getMillisecondsUntilNextMonday();

      // Should be 1 hour until delivery
      expect(ms).toBe(60 * 60 * 1000);
    });

    it('calculates from Sunday to Monday', () => {
      // Sunday 2024-06-09 at 12:00
      vi.setSystemTime(new Date('2024-06-09T12:00:00'));

      const ms = service.getMillisecondsUntilNextMonday();

      // Monday 2024-06-10 at 09:00 → 21 hours
      expect(ms).toBe(21 * 60 * 60 * 1000);
    });
  });

  // ---------------------------------------------------------------------------
  // deliverWeeklyAnalytics
  // ---------------------------------------------------------------------------

  describe('deliverWeeklyAnalytics', () => {
    it('fetches report and sends via notification service', async () => {
      const report = await service.deliverWeeklyAnalytics();

      expect(report.totalConversationsByChannel.whatsapp).toBe(10);
      expect(notificationService.notifyOwner).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system_alert',
          priority: 'normal',
          content: expect.stringContaining('Weekly Analytics Report'),
        }),
      );
    });

    it('returns the weekly report', async () => {
      const report = await service.deliverWeeklyAnalytics();

      expect(report.weekStarting).toBeInstanceOf(Date);
      expect(report.weekEnding).toBeInstanceOf(Date);
      expect(report.conversionRate).toBe(0.25);
    });
  });

  // ---------------------------------------------------------------------------
  // formatWeeklyReport
  // ---------------------------------------------------------------------------

  describe('formatWeeklyReport', () => {
    const sampleReport: WeeklyReport = {
      weekStarting: new Date('2024-06-10'),
      weekEnding: new Date('2024-06-16'),
      totalConversationsByChannel: {
        whatsapp: 10,
        instagram: 5,
        chat_widget: 15,
      } as Record<Channel, number>,
      topTopics: [
        { topic: 'Birthday cakes', count: 8 },
        { topic: 'Wedding cakes', count: 6 },
        { topic: 'Pricing', count: 4 },
        { topic: 'Availability', count: 3 },
        { topic: 'Delivery', count: 2 },
      ],
      conversionRate: 0.25,
      averageResponseTimeByChannel: {
        whatsapp: 3000,
        instagram: 4000,
        chat_widget: 2500,
      } as Record<Channel, number>,
    };

    it('includes all required sections', () => {
      const formatted = service.formatWeeklyReport(sampleReport);

      expect(formatted).toContain('Weekly Analytics Report');
      expect(formatted).toContain('Conversations by Channel');
      expect(formatted).toContain('Top 5 Topics');
      expect(formatted).toContain('Conversion Rate');
      expect(formatted).toContain('Avg Response Time');
    });

    it('shows total conversations by channel', () => {
      const formatted = service.formatWeeklyReport(sampleReport);

      expect(formatted).toContain('whatsapp: 10');
      expect(formatted).toContain('instagram: 5');
      expect(formatted).toContain('chat_widget: 15');
    });

    it('shows top 5 topics', () => {
      const formatted = service.formatWeeklyReport(sampleReport);

      expect(formatted).toContain('Birthday cakes (8)');
      expect(formatted).toContain('Wedding cakes (6)');
      expect(formatted).toContain('Pricing (4)');
      expect(formatted).toContain('Availability (3)');
      expect(formatted).toContain('Delivery (2)');
    });

    it('shows conversion rate as percentage', () => {
      const formatted = service.formatWeeklyReport(sampleReport);
      expect(formatted).toContain('25.0%');
    });

    it('shows average response time in seconds', () => {
      const formatted = service.formatWeeklyReport(sampleReport);

      expect(formatted).toContain('whatsapp: 3.0s');
      expect(formatted).toContain('instagram: 4.0s');
      expect(formatted).toContain('chat_widget: 2.5s');
    });

    it('handles empty topics', () => {
      const emptyReport: WeeklyReport = {
        ...sampleReport,
        topTopics: [],
      };

      const formatted = service.formatWeeklyReport(emptyReport);
      expect(formatted).toContain('No topics recorded.');
    });

    it('handles empty conversations', () => {
      const emptyReport: WeeklyReport = {
        ...sampleReport,
        totalConversationsByChannel: {} as Record<Channel, number>,
      };

      const formatted = service.formatWeeklyReport(emptyReport);
      expect(formatted).toContain('No conversations this week.');
    });

    it('limits topics to 5', () => {
      const manyTopics: WeeklyReport = {
        ...sampleReport,
        topTopics: [
          { topic: 'Topic 1', count: 10 },
          { topic: 'Topic 2', count: 9 },
          { topic: 'Topic 3', count: 8 },
          { topic: 'Topic 4', count: 7 },
          { topic: 'Topic 5', count: 6 },
          { topic: 'Topic 6', count: 5 },
          { topic: 'Topic 7', count: 4 },
        ],
      };

      const formatted = service.formatWeeklyReport(manyTopics);
      expect(formatted).toContain('Topic 5');
      expect(formatted).not.toContain('Topic 6');
      expect(formatted).not.toContain('Topic 7');
    });
  });
});
