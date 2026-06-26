/**
 * Marketing Service implementation.
 *
 * Responsible for:
 * - Budget allocation across 5 channels summing to exactly $100.00
 * - Conversion tracking with 30-day attribution window
 * - ROI metrics calculation (cost-per-inquiry, cost-per-order) with insufficient data flagging
 * - Seasonal promotion recommendations ≥4 weeks before Austin events
 * - Weekly analytics (conversations by channel, top topics, conversion rate, avg response time)
 * - Content suggestion generation (delegates to content planner)
 * - Review solicitation (one per order, idempotent)
 *
 * Requirements: 10.1, 10.2, 10.4
 */

import type {
  MarketingService as IMarketingService,
  BudgetAllocation,
  ChannelAllocation,
  ChannelROI,
  SeasonalRecommendation,
  WeeklyReport,
  ContentSuggestion,
  Channel,
} from '../types';
import { contentPlannerService } from './content-planner.service';
import { getWeeklyAnalyticsFromDb } from './analytics.service';
import { isDbConfigured } from '@/lib/supabase';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Total monthly marketing budget */
const TOTAL_BUDGET = 100.0;

/** Marketing channels with default allocation percentages */
const MARKETING_CHANNELS = [
  { id: 'meta-ads', name: 'Meta Ads', defaultPercent: 30 },
  { id: 'google-local', name: 'Google local search', defaultPercent: 25 },
  { id: 'boosted-instagram', name: 'Boosted Instagram posts', defaultPercent: 20 },
  { id: 'organic-content', name: 'Organic content', defaultPercent: 15 },
  { id: 'review-generation', name: 'Review generation', defaultPercent: 10 },
] as const;

/** Attribution window in milliseconds (30 days) */
const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Minimum attributed inquiries for sufficient data */
const MIN_INQUIRIES_FOR_SUFFICIENT_DATA = 5;

/** Austin-area seasonal events with approximate dates */
const AUSTIN_SEASONAL_EVENTS = [
  { name: 'Valentine\'s Day', month: 1, day: 14 },
  { name: 'Spring Wedding Season Start', month: 2, day: 1 },
  { name: 'Easter', month: 3, day: 20 },
  { name: 'Graduation Season', month: 4, day: 15 },
  { name: 'Mother\'s Day', month: 4, day: 10 },
  { name: 'Father\'s Day', month: 5, day: 15 },
  { name: 'Summer Wedding Season', month: 5, day: 1 },
  { name: 'Fourth of July', month: 6, day: 4 },
  { name: 'Back to School', month: 7, day: 15 },
  { name: 'Fall Wedding Season', month: 8, day: 15 },
  { name: 'Halloween', month: 9, day: 31 },
  { name: 'Thanksgiving', month: 10, day: 25 },
  { name: 'Holiday/Christmas Season', month: 11, day: 1 },
  { name: 'New Year\'s Eve', month: 11, day: 31 },
];

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Conversion record stored in memory (in production: database) */
export interface ConversionRecord {
  customerId: string;
  channel: string;
  firstInteraction: Date;
  attributedAt: Date;
}

/** Channel spend record for ROI calculation */
export interface ChannelSpend {
  channelId: string;
  month: string;
  spend: number;
  inquiryCount: number;
  orderCount: number;
}

/** Review solicitation record for idempotency */
export interface ReviewSolicitationRecord {
  orderId: string;
  sentAt: Date;
}

/** Injectable data provider for channel spend data */
export type ChannelSpendProvider = (month: string) => Promise<ChannelSpend[]>;

/** Injectable data provider for weekly analytics data */
export type WeeklyAnalyticsProvider = () => Promise<WeeklyReport>;

/** Injectable review solicitation sender */
export type ReviewSolicitationSender = (orderId: string) => Promise<void>;

/** Injectable budget allocation provider (for ML/AI-based allocation) */
export type BudgetAllocationProvider = () => Promise<ChannelAllocation[]>;

// -----------------------------------------------------------------------------
// Marketing Service Implementation
// -----------------------------------------------------------------------------

export class MarketingServiceImpl implements IMarketingService {
  /** In-memory conversion records (in production: database) */
  private _conversions: ConversionRecord[] = [];

  /** In-memory review solicitation tracking for idempotency */
  private _reviewSolicitations: ReviewSolicitationRecord[] = [];

  /** Injectable channel spend data provider */
  private _channelSpendProvider: ChannelSpendProvider | null = null;

  /** Injectable weekly analytics provider */
  private _weeklyAnalyticsProvider: WeeklyAnalyticsProvider | null = null;

  /** Injectable review solicitation sender */
  private _reviewSolicitationSender: ReviewSolicitationSender | null = null;

  /** Injectable budget allocation provider */
  private _budgetAllocationProvider: BudgetAllocationProvider | null = null;

  // ---------------------------------------------------------------------------
  // Dependency Injection
  // ---------------------------------------------------------------------------

  setChannelSpendProvider(provider: ChannelSpendProvider): void {
    this._channelSpendProvider = provider;
  }

  setWeeklyAnalyticsProvider(provider: WeeklyAnalyticsProvider): void {
    this._weeklyAnalyticsProvider = provider;
  }

  setReviewSolicitationSender(sender: ReviewSolicitationSender): void {
    this._reviewSolicitationSender = sender;
  }

  setBudgetAllocationProvider(provider: BudgetAllocationProvider): void {
    this._budgetAllocationProvider = provider;
  }

  // ---------------------------------------------------------------------------
  // Public API: generateBudgetAllocation
  // ---------------------------------------------------------------------------

  /**
   * Generate monthly budget allocation across 5 channels.
   *
   * The allocation always sums to exactly $100.00.
   * All channels receive a non-negative amount.
   * All 5 defined channels are always represented.
   *
   * If a custom allocation provider is set (for ML/AI-based allocation),
   * it delegates to that provider and validates the result.
   * Otherwise, uses the default percentage-based allocation.
   *
   * Requirement: 10.1
   */
  async generateBudgetAllocation(): Promise<BudgetAllocation> {
    let allocations: ChannelAllocation[];

    if (this._budgetAllocationProvider) {
      allocations = await this._budgetAllocationProvider();

      // Validate provider result
      if (!this.isValidAllocation(allocations)) {
        // Fall back to default allocation if provider returns invalid result
        allocations = this.getDefaultAllocation();
      }
    } else {
      allocations = this.getDefaultAllocation();
    }

    return {
      allocations,
      totalBudget: TOTAL_BUDGET,
      month: this.getCurrentMonth(),
      generatedAt: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // Public API: trackConversion
  // ---------------------------------------------------------------------------

  /**
   * Track a conversion by recording the customer's first interaction and
   * marketing channel.
   *
   * Attribution is valid within a 30-day window from the customer's first
   * interaction. If the customer already has an attribution record, this
   * is a no-op (first-touch attribution model).
   *
   * Requirement: 10.2
   */
  async trackConversion(customerId: string, channel: string): Promise<void> {
    // Check if this customer already has an attribution record
    const existing = this._conversions.find(
      (c) => c.customerId === customerId
    );

    if (existing) {
      // First-touch attribution: do not overwrite
      return;
    }

    const now = new Date();

    this._conversions.push({
      customerId,
      channel,
      firstInteraction: now,
      attributedAt: now,
    });
  }

  // ---------------------------------------------------------------------------
  // Public API: getROIMetrics
  // ---------------------------------------------------------------------------

  /**
   * Calculate ROI metrics per channel for a given month.
   *
   * Returns cost-per-inquiry (S/I) and cost-per-order (S/O) per channel.
   * - costPerInquiry is undefined when inquiryCount = 0
   * - costPerOrder is undefined when orderCount = 0
   * - insufficientData is true when inquiryCount < 5
   *
   * Requirements: 10.4, 10.6
   */
  async getROIMetrics(month: string): Promise<ChannelROI[]> {
    let channelSpends: ChannelSpend[];

    if (this._channelSpendProvider) {
      channelSpends = await this._channelSpendProvider(month);
    } else {
      // Default: derive from conversions and default budget allocation
      channelSpends = this.deriveChannelSpends(month);
    }

    return channelSpends.map((cs) => ({
      channelId: cs.channelId,
      spend: cs.spend,
      inquiryCount: cs.inquiryCount,
      orderCount: cs.orderCount,
      costPerInquiry: cs.inquiryCount > 0 ? cs.spend / cs.inquiryCount : undefined,
      costPerOrder: cs.orderCount > 0 ? cs.spend / cs.orderCount : undefined,
      insufficientData: cs.inquiryCount < MIN_INQUIRIES_FOR_SUFFICIENT_DATA,
    }));
  }

  // ---------------------------------------------------------------------------
  // Public API: generateSeasonalRecommendations
  // ---------------------------------------------------------------------------

  /**
   * Generate promotion recommendations ≥4 weeks (28 days) before Austin events.
   *
   * Scans upcoming Austin-area events and generates recommendations for those
   * that are at least 28 days in the future. Each recommendation includes:
   * - Event name and date
   * - Recommended start date (28 days before event)
   * - Promotion ideas based on the event type
   *
   * Requirement: 10.3
   */
  async generateSeasonalRecommendations(): Promise<SeasonalRecommendation[]> {
    const now = new Date();
    const recommendations: SeasonalRecommendation[] = [];

    // Check events for the next 3 months
    for (let monthOffset = 0; monthOffset <= 3; monthOffset++) {
      const targetDate = new Date(now);
      targetDate.setMonth(targetDate.getMonth() + monthOffset);

      for (const event of AUSTIN_SEASONAL_EVENTS) {
        const eventDate = new Date(
          targetDate.getFullYear(),
          event.month,
          event.day
        );

        // Only include events that are ≥28 days in the future
        const daysUntilEvent = Math.floor(
          (eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );

        if (daysUntilEvent >= 28) {
          const recommendedStartDate = new Date(eventDate);
          recommendedStartDate.setDate(recommendedStartDate.getDate() - 28);

          recommendations.push({
            eventName: event.name,
            eventDate,
            recommendedStartDate,
            promotionIdeas: this.getPromotionIdeas(event.name),
          });
        }
      }
    }

    // Deduplicate by event name (in case same event shows up in multiple month offsets)
    const seen = new Set<string>();
    const uniqueRecommendations = recommendations.filter((r) => {
      const key = `${r.eventName}-${r.eventDate.toISOString()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by event date (soonest first)
    return uniqueRecommendations.sort(
      (a, b) => a.eventDate.getTime() - b.eventDate.getTime()
    );
  }

  // ---------------------------------------------------------------------------
  // Public API: getWeeklyAnalytics
  // ---------------------------------------------------------------------------

  /**
   * Get weekly analytics report.
   *
   * Returns: total conversations by channel, top 5 topics, conversion rate,
   * and average response time by channel.
   *
   * If a custom analytics provider is configured, delegates to that.
   * Otherwise returns a default report derived from available data.
   *
   * Requirement: 14.2, 14.4
   */
  async getWeeklyAnalytics(): Promise<WeeklyReport> {
    if (this._weeklyAnalyticsProvider) {
      return this._weeklyAnalyticsProvider();
    }

    if (isDbConfigured()) {
      return getWeeklyAnalyticsFromDb();
    }

    // Default: return a report with available data
    const now = new Date();
    const weekStart = this.getMondayOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    return {
      weekStarting: weekStart,
      weekEnding: weekEnd,
      totalConversationsByChannel: {
        whatsapp: 0,
        instagram: 0,
        chat_widget: 0,
      },
      topTopics: [],
      conversionRate: 0,
      averageResponseTimeByChannel: {
        whatsapp: 0,
        instagram: 0,
        chat_widget: 0,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Public API: generateContentSuggestions
  // ---------------------------------------------------------------------------

  /**
   * Generate content suggestions for social media.
   *
   * Delegates to the Content Planner Service for content generation.
   *
   * @param count - Number of suggestions to return
   * @returns Array of ContentSuggestion items
   */
  async generateContentSuggestions(count: number): Promise<ContentSuggestion[]> {
    return contentPlannerService.getContentSuggestions(count);
  }

  // ---------------------------------------------------------------------------
  // Public API: sendReviewSolicitation
  // ---------------------------------------------------------------------------

  /**
   * Generate and send a review solicitation for an order.
   *
   * Enforces idempotency: at most one solicitation per order.
   * If a solicitation has already been sent for this order, this is a no-op.
   *
   * In production, this is triggered when an order transitions to
   * Delivered or Picked_Up state.
   *
   * Requirement: 10.5
   */
  async sendReviewSolicitation(orderId: string): Promise<void> {
    // Idempotency check: has a solicitation already been sent for this order?
    const existing = this._reviewSolicitations.find(
      (r) => r.orderId === orderId
    );

    if (existing) {
      // Already sent — do nothing (idempotent)
      return;
    }

    // Send the solicitation
    if (this._reviewSolicitationSender) {
      await this._reviewSolicitationSender(orderId);
    }

    // Record that solicitation was sent
    this._reviewSolicitations.push({
      orderId,
      sentAt: new Date(),
    });
  }

  // ---------------------------------------------------------------------------
  // Public Utility Methods (for testing)
  // ---------------------------------------------------------------------------

  /**
   * Get all tracked conversions (for testing/inspection).
   */
  getConversions(): ConversionRecord[] {
    return [...this._conversions];
  }

  /**
   * Get all review solicitation records (for testing/inspection).
   */
  getReviewSolicitations(): ReviewSolicitationRecord[] {
    return [...this._reviewSolicitations];
  }

  /**
   * Check if a conversion is within the 30-day attribution window.
   */
  isWithinAttributionWindow(
    firstInteraction: Date,
    conversionDate: Date
  ): boolean {
    const elapsed = conversionDate.getTime() - firstInteraction.getTime();
    return elapsed >= 0 && elapsed <= ATTRIBUTION_WINDOW_MS;
  }

  /**
   * Get attributed conversions for a given month (within 30-day window).
   */
  getAttributedConversions(month: string): ConversionRecord[] {
    const [year, monthNum] = month.split('-').map(Number);
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);

    return this._conversions.filter((c) => {
      const isInMonth =
        c.attributedAt >= monthStart && c.attributedAt <= monthEnd;
      const isWithinWindow = this.isWithinAttributionWindow(
        c.firstInteraction,
        c.attributedAt
      );
      return isInMonth && isWithinWindow;
    });
  }

  /**
   * Reset all internal state (for testing).
   */
  reset(): void {
    this._conversions = [];
    this._reviewSolicitations = [];
    this._channelSpendProvider = null;
    this._weeklyAnalyticsProvider = null;
    this._reviewSolicitationSender = null;
    this._budgetAllocationProvider = null;
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Generate the default budget allocation based on fixed percentages.
   * Ensures the sum is exactly $100.00 using remainder distribution.
   */
  private getDefaultAllocation(): ChannelAllocation[] {
    const allocations: ChannelAllocation[] = [];
    let remaining = TOTAL_BUDGET * 100; // Work in cents to avoid floating point

    for (let i = 0; i < MARKETING_CHANNELS.length; i++) {
      const channel = MARKETING_CHANNELS[i];

      if (i === MARKETING_CHANNELS.length - 1) {
        // Last channel gets the remainder to ensure exact sum
        allocations.push({
          channelId: channel.id,
          channelName: channel.name,
          amount: remaining / 100,
        });
      } else {
        const amount = Math.round(
          (TOTAL_BUDGET * channel.defaultPercent) / 100 * 100
        ) / 100;
        allocations.push({
          channelId: channel.id,
          channelName: channel.name,
          amount,
        });
        remaining -= Math.round(amount * 100);
      }
    }

    return allocations;
  }

  /**
   * Validate that a budget allocation is correct:
   * - All channels represented
   * - All amounts non-negative
   * - Sum equals exactly $100.00
   */
  private isValidAllocation(allocations: ChannelAllocation[]): boolean {
    if (allocations.length !== MARKETING_CHANNELS.length) {
      return false;
    }

    // All amounts must be non-negative
    if (allocations.some((a) => a.amount < 0)) {
      return false;
    }

    // Sum must equal exactly $100.00 (check in cents to avoid floating point)
    const sumCents = allocations.reduce(
      (sum, a) => sum + Math.round(a.amount * 100),
      0
    );

    if (sumCents !== TOTAL_BUDGET * 100) {
      return false;
    }

    // All channel IDs must be from the defined set
    const validIds = new Set(MARKETING_CHANNELS.map((c) => c.id));
    return allocations.every((a) => validIds.has(a.channelId));
  }

  /**
   * Derive channel spend data from conversions when no provider is configured.
   */
  private deriveChannelSpends(month: string): ChannelSpend[] {
    const attributedConversions = this.getAttributedConversions(month);

    return MARKETING_CHANNELS.map((channel) => {
      const channelConversions = attributedConversions.filter(
        (c) => c.channel === channel.id
      );

      return {
        channelId: channel.id,
        month,
        spend: (TOTAL_BUDGET * channel.defaultPercent) / 100,
        inquiryCount: channelConversions.length,
        orderCount: Math.floor(channelConversions.length * 0.3), // Estimate 30% conversion
      };
    });
  }

  /**
   * Get promotion ideas based on event type.
   */
  private getPromotionIdeas(eventName: string): string[] {
    const lowerEvent = eventName.toLowerCase();

    if (lowerEvent.includes('wedding')) {
      return [
        'Free wedding cake consultation offer',
        'Wedding cake portfolio showcase on Instagram',
        'Boosted post targeting Austin brides-to-be',
        'Partner with local Austin wedding venues',
      ];
    }

    if (lowerEvent.includes('graduation')) {
      return [
        'Graduation cake special: 10% off orders over $150',
        'Instagram stories showcasing graduation cake designs',
        'Targeted Meta ad for Austin high school/college parents',
      ];
    }

    if (lowerEvent.includes('valentine')) {
      return [
        'Valentine\'s Day heart-shaped cake special',
        'Cupcake dozen gift boxes for couples',
        'Instagram countdown to Valentine\'s Day orders',
      ];
    }

    if (lowerEvent.includes('halloween')) {
      return [
        'Spooky cake design contest on Instagram',
        'Halloween cupcake decorating class promotion',
        'Boosted post featuring themed cake pops',
      ];
    }

    if (lowerEvent.includes('christmas') || lowerEvent.includes('holiday')) {
      return [
        'Holiday pre-order early bird discount',
        'Christmas cookie box gift packages',
        'Corporate holiday party catering packages',
        'Instagram Advent calendar of daily cake art reveals',
      ];
    }

    if (lowerEvent.includes('mother')) {
      return [
        'Mother\'s Day cake gift packages',
        'Special floral cake designs for Mom',
        'Instagram story polls: "What flavor does your Mom love?"',
      ];
    }

    if (lowerEvent.includes('father')) {
      return [
        'Father\'s Day themed cake designs',
        'BBQ-themed cake pops and cupcakes',
        'Targeted Meta ad for Dad celebration cakes',
      ];
    }

    if (lowerEvent.includes('easter')) {
      return [
        'Easter-themed cookie decorating kits',
        'Pastel spring cake collection showcase',
        'Bunny and egg cake pop promotions',
      ];
    }

    // Default promotion ideas
    return [
      'Seasonal design showcase on Instagram',
      'Boosted post featuring themed cakes',
      'Review generation campaign for recent orders',
      'Google local search ad highlighting availability',
    ];
  }

  /**
   * Get the current month in YYYY-MM format.
   */
  private getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Get Monday of the current week.
   */
  private getMondayOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

// -----------------------------------------------------------------------------
// Singleton Export
// -----------------------------------------------------------------------------

export const marketingService = new MarketingServiceImpl();

// Export constants for testing
export {
  TOTAL_BUDGET,
  MARKETING_CHANNELS,
  ATTRIBUTION_WINDOW_MS,
  MIN_INQUIRIES_FOR_SUFFICIENT_DATA,
  AUSTIN_SEASONAL_EVENTS,
};
