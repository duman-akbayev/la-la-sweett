/**
 * Marketing Service Unit Tests
 *
 * Tests for budget allocation, conversion tracking, ROI metrics,
 * seasonal recommendations, weekly analytics, content suggestions,
 * and review solicitation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MarketingServiceImpl,
  TOTAL_BUDGET,
  MARKETING_CHANNELS,
  ATTRIBUTION_WINDOW_MS,
  MIN_INQUIRIES_FOR_SUFFICIENT_DATA,
} from './marketing.service';

describe('MarketingService', () => {
  let service: MarketingServiceImpl;

  beforeEach(() => {
    service = new MarketingServiceImpl();
  });

  // ---------------------------------------------------------------------------
  // generateBudgetAllocation
  // ---------------------------------------------------------------------------

  describe('generateBudgetAllocation', () => {
    it('should return allocations summing to exactly $100.00', async () => {
      const result = await service.generateBudgetAllocation();

      const sum = result.allocations.reduce((acc, a) => acc + a.amount, 0);
      // Use cents comparison to avoid floating point issues
      expect(Math.round(sum * 100)).toBe(TOTAL_BUDGET * 100);
    });

    it('should include all 5 channels', async () => {
      const result = await service.generateBudgetAllocation();

      expect(result.allocations).toHaveLength(MARKETING_CHANNELS.length);

      const channelIds = result.allocations.map((a) => a.channelId);
      for (const channel of MARKETING_CHANNELS) {
        expect(channelIds).toContain(channel.id);
      }
    });

    it('should have all non-negative amounts', async () => {
      const result = await service.generateBudgetAllocation();

      for (const allocation of result.allocations) {
        expect(allocation.amount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should set totalBudget to 100.00', async () => {
      const result = await service.generateBudgetAllocation();

      expect(result.totalBudget).toBe(100.0);
    });

    it('should include current month', async () => {
      const result = await service.generateBudgetAllocation();

      const now = new Date();
      const expectedMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      expect(result.month).toBe(expectedMonth);
    });

    it('should include generatedAt timestamp', async () => {
      const before = new Date();
      const result = await service.generateBudgetAllocation();
      const after = new Date();

      expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should use custom provider when set', async () => {
      const customAllocations = MARKETING_CHANNELS.map((ch, i) => ({
        channelId: ch.id,
        channelName: ch.name,
        amount: i === 0 ? 60 : 10,
      }));

      service.setBudgetAllocationProvider(async () => customAllocations);

      const result = await service.generateBudgetAllocation();
      expect(result.allocations[0].amount).toBe(60);
    });

    it('should fall back to default when provider returns invalid allocation', async () => {
      // Provider returns allocation that doesn't sum to $100
      service.setBudgetAllocationProvider(async () => [
        { channelId: 'meta-ads', channelName: 'Meta Ads', amount: 50 },
      ]);

      const result = await service.generateBudgetAllocation();

      // Should use default allocation
      expect(result.allocations).toHaveLength(MARKETING_CHANNELS.length);
      const sum = result.allocations.reduce((acc, a) => acc + a.amount, 0);
      expect(Math.round(sum * 100)).toBe(TOTAL_BUDGET * 100);
    });
  });

  // ---------------------------------------------------------------------------
  // trackConversion
  // ---------------------------------------------------------------------------

  describe('trackConversion', () => {
    it('should record a conversion for a new customer', async () => {
      await service.trackConversion('customer-1', 'meta-ads');

      const conversions = service.getConversions();
      expect(conversions).toHaveLength(1);
      expect(conversions[0].customerId).toBe('customer-1');
      expect(conversions[0].channel).toBe('meta-ads');
    });

    it('should not overwrite existing attribution (first-touch model)', async () => {
      await service.trackConversion('customer-1', 'meta-ads');
      await service.trackConversion('customer-1', 'google-local');

      const conversions = service.getConversions();
      expect(conversions).toHaveLength(1);
      expect(conversions[0].channel).toBe('meta-ads');
    });

    it('should track multiple customers independently', async () => {
      await service.trackConversion('customer-1', 'meta-ads');
      await service.trackConversion('customer-2', 'google-local');
      await service.trackConversion('customer-3', 'organic-content');

      const conversions = service.getConversions();
      expect(conversions).toHaveLength(3);
    });

    it('should record firstInteraction timestamp', async () => {
      const before = new Date();
      await service.trackConversion('customer-1', 'meta-ads');
      const after = new Date();

      const conversions = service.getConversions();
      expect(conversions[0].firstInteraction.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(conversions[0].firstInteraction.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ---------------------------------------------------------------------------
  // getROIMetrics
  // ---------------------------------------------------------------------------

  describe('getROIMetrics', () => {
    it('should return metrics for all channels', async () => {
      const metrics = await service.getROIMetrics('2024-06');

      expect(metrics).toHaveLength(MARKETING_CHANNELS.length);
    });

    it('should flag insufficient data when inquiries < 5', async () => {
      const metrics = await service.getROIMetrics('2024-06');

      for (const metric of metrics) {
        if (metric.inquiryCount < MIN_INQUIRIES_FOR_SUFFICIENT_DATA) {
          expect(metric.insufficientData).toBe(true);
        }
      }
    });

    it('should return undefined costPerInquiry when inquiryCount is 0', async () => {
      const metrics = await service.getROIMetrics('2024-06');

      for (const metric of metrics) {
        if (metric.inquiryCount === 0) {
          expect(metric.costPerInquiry).toBeUndefined();
        }
      }
    });

    it('should return undefined costPerOrder when orderCount is 0', async () => {
      const metrics = await service.getROIMetrics('2024-06');

      for (const metric of metrics) {
        if (metric.orderCount === 0) {
          expect(metric.costPerOrder).toBeUndefined();
        }
      }
    });

    it('should calculate cost-per-inquiry correctly with provider', async () => {
      service.setChannelSpendProvider(async () => [
        {
          channelId: 'meta-ads',
          month: '2024-06',
          spend: 30,
          inquiryCount: 10,
          orderCount: 3,
        },
        {
          channelId: 'google-local',
          month: '2024-06',
          spend: 25,
          inquiryCount: 5,
          orderCount: 2,
        },
        {
          channelId: 'boosted-instagram',
          month: '2024-06',
          spend: 20,
          inquiryCount: 8,
          orderCount: 1,
        },
        {
          channelId: 'organic-content',
          month: '2024-06',
          spend: 15,
          inquiryCount: 3,
          orderCount: 0,
        },
        {
          channelId: 'review-generation',
          month: '2024-06',
          spend: 10,
          inquiryCount: 0,
          orderCount: 0,
        },
      ]);

      const metrics = await service.getROIMetrics('2024-06');

      // Meta Ads: S/I = 30/10 = 3.0
      const metaAds = metrics.find((m) => m.channelId === 'meta-ads');
      expect(metaAds?.costPerInquiry).toBe(3.0);
      expect(metaAds?.costPerOrder).toBe(10.0);
      expect(metaAds?.insufficientData).toBe(false);

      // Organic content: < 5 inquiries = insufficient data
      const organic = metrics.find((m) => m.channelId === 'organic-content');
      expect(organic?.insufficientData).toBe(true);
      expect(organic?.costPerOrder).toBeUndefined();

      // Review generation: 0 inquiries = undefined CPI
      const reviews = metrics.find((m) => m.channelId === 'review-generation');
      expect(reviews?.costPerInquiry).toBeUndefined();
      expect(reviews?.costPerOrder).toBeUndefined();
      expect(reviews?.insufficientData).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // generateSeasonalRecommendations
  // ---------------------------------------------------------------------------

  describe('generateSeasonalRecommendations', () => {
    it('should return recommendations with event dates ≥28 days in the future', async () => {
      const recommendations = await service.generateSeasonalRecommendations();
      const now = new Date();

      for (const rec of recommendations) {
        const daysUntilEvent = Math.floor(
          (rec.eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );
        expect(daysUntilEvent).toBeGreaterThanOrEqual(28);
      }
    });

    it('should set recommendedStartDate 28 days before event', async () => {
      const recommendations = await service.generateSeasonalRecommendations();

      for (const rec of recommendations) {
        const daysBefore = Math.floor(
          (rec.eventDate.getTime() - rec.recommendedStartDate.getTime()) /
            (24 * 60 * 60 * 1000)
        );
        expect(daysBefore).toBe(28);
      }
    });

    it('should include promotion ideas for each recommendation', async () => {
      const recommendations = await service.generateSeasonalRecommendations();

      for (const rec of recommendations) {
        expect(rec.promotionIdeas.length).toBeGreaterThan(0);
      }
    });

    it('should sort recommendations by event date (soonest first)', async () => {
      const recommendations = await service.generateSeasonalRecommendations();

      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i].eventDate.getTime()).toBeGreaterThanOrEqual(
          recommendations[i - 1].eventDate.getTime()
        );
      }
    });

    it('should not contain duplicate events', async () => {
      const recommendations = await service.generateSeasonalRecommendations();

      const keys = recommendations.map(
        (r) => `${r.eventName}-${r.eventDate.toISOString()}`
      );
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  // ---------------------------------------------------------------------------
  // getWeeklyAnalytics
  // ---------------------------------------------------------------------------

  describe('getWeeklyAnalytics', () => {
    it('should return a weekly report with all required fields', async () => {
      const report = await service.getWeeklyAnalytics();

      expect(report.weekStarting).toBeInstanceOf(Date);
      expect(report.weekEnding).toBeInstanceOf(Date);
      expect(report.totalConversationsByChannel).toBeDefined();
      expect(report.topTopics).toBeDefined();
      expect(typeof report.conversionRate).toBe('number');
      expect(report.averageResponseTimeByChannel).toBeDefined();
    });

    it('should return week ending 6 days after start', async () => {
      const report = await service.getWeeklyAnalytics();

      const dayDiff = Math.floor(
        (report.weekEnding.getTime() - report.weekStarting.getTime()) /
          (24 * 60 * 60 * 1000)
      );
      expect(dayDiff).toBe(6);
    });

    it('should include all three channels', async () => {
      const report = await service.getWeeklyAnalytics();

      expect(report.totalConversationsByChannel).toHaveProperty('whatsapp');
      expect(report.totalConversationsByChannel).toHaveProperty('instagram');
      expect(report.totalConversationsByChannel).toHaveProperty('chat_widget');
    });

    it('should use custom provider when set', async () => {
      const customReport = {
        weekStarting: new Date('2024-06-03'),
        weekEnding: new Date('2024-06-09'),
        totalConversationsByChannel: {
          whatsapp: 15,
          instagram: 10,
          chat_widget: 25,
        } as Record<'whatsapp' | 'instagram' | 'chat_widget', number>,
        topTopics: [
          { topic: 'pricing', count: 20 },
          { topic: 'availability', count: 15 },
        ],
        conversionRate: 0.35,
        averageResponseTimeByChannel: {
          whatsapp: 2500,
          instagram: 3000,
          chat_widget: 1500,
        } as Record<'whatsapp' | 'instagram' | 'chat_widget', number>,
      };

      service.setWeeklyAnalyticsProvider(async () => customReport);

      const report = await service.getWeeklyAnalytics();
      expect(report.totalConversationsByChannel.whatsapp).toBe(15);
      expect(report.conversionRate).toBe(0.35);
    });
  });

  // ---------------------------------------------------------------------------
  // generateContentSuggestions
  // ---------------------------------------------------------------------------

  describe('generateContentSuggestions', () => {
    it('should return the requested number of content suggestions', async () => {
      const suggestions = await service.generateContentSuggestions(3);

      expect(suggestions).toHaveLength(3);
    });

    it('should return suggestions with required fields', async () => {
      const suggestions = await service.generateContentSuggestions(2);

      for (const suggestion of suggestions) {
        expect(suggestion.topic).toBeDefined();
        expect(suggestion.format).toBeDefined();
        expect(suggestion.caption).toBeDefined();
        expect(['post', 'story', 'reel']).toContain(suggestion.format);
      }
    });

    it('should return fewer items when count exceeds available', async () => {
      const suggestions = await service.generateContentSuggestions(100);

      // Should return as many as available (not throw)
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(100);
    });
  });

  // ---------------------------------------------------------------------------
  // sendReviewSolicitation
  // ---------------------------------------------------------------------------

  describe('sendReviewSolicitation', () => {
    it('should send a solicitation for a new order', async () => {
      const sender = vi.fn();
      service.setReviewSolicitationSender(sender);

      await service.sendReviewSolicitation('order-1');

      expect(sender).toHaveBeenCalledWith('order-1');
    });

    it('should be idempotent (only one solicitation per order)', async () => {
      const sender = vi.fn();
      service.setReviewSolicitationSender(sender);

      await service.sendReviewSolicitation('order-1');
      await service.sendReviewSolicitation('order-1');
      await service.sendReviewSolicitation('order-1');

      expect(sender).toHaveBeenCalledTimes(1);
    });

    it('should allow solicitations for different orders', async () => {
      const sender = vi.fn();
      service.setReviewSolicitationSender(sender);

      await service.sendReviewSolicitation('order-1');
      await service.sendReviewSolicitation('order-2');
      await service.sendReviewSolicitation('order-3');

      expect(sender).toHaveBeenCalledTimes(3);
    });

    it('should record solicitation even without sender configured', async () => {
      await service.sendReviewSolicitation('order-1');

      const records = service.getReviewSolicitations();
      expect(records).toHaveLength(1);
      expect(records[0].orderId).toBe('order-1');
    });

    it('should not send again after first solicitation', async () => {
      const sender = vi.fn();
      service.setReviewSolicitationSender(sender);

      await service.sendReviewSolicitation('order-1');
      sender.mockClear();

      await service.sendReviewSolicitation('order-1');
      expect(sender).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Attribution Window
  // ---------------------------------------------------------------------------

  describe('isWithinAttributionWindow', () => {
    it('should return true for interactions within 30 days', () => {
      const firstInteraction = new Date('2024-06-01');
      const conversionDate = new Date('2024-06-15');

      expect(
        service.isWithinAttributionWindow(firstInteraction, conversionDate)
      ).toBe(true);
    });

    it('should return true for interactions exactly at 30 days', () => {
      const firstInteraction = new Date('2024-06-01');
      const conversionDate = new Date(
        firstInteraction.getTime() + ATTRIBUTION_WINDOW_MS
      );

      expect(
        service.isWithinAttributionWindow(firstInteraction, conversionDate)
      ).toBe(true);
    });

    it('should return false for interactions beyond 30 days', () => {
      const firstInteraction = new Date('2024-06-01');
      const conversionDate = new Date(
        firstInteraction.getTime() + ATTRIBUTION_WINDOW_MS + 1
      );

      expect(
        service.isWithinAttributionWindow(firstInteraction, conversionDate)
      ).toBe(false);
    });

    it('should return false when conversion is before first interaction', () => {
      const firstInteraction = new Date('2024-06-15');
      const conversionDate = new Date('2024-06-01');

      expect(
        service.isWithinAttributionWindow(firstInteraction, conversionDate)
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('should clear all internal state', async () => {
      await service.trackConversion('customer-1', 'meta-ads');
      await service.sendReviewSolicitation('order-1');

      service.reset();

      expect(service.getConversions()).toHaveLength(0);
      expect(service.getReviewSolicitations()).toHaveLength(0);
    });
  });
});
