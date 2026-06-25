/**
 * Weekly Analytics Delivery Service
 *
 * Schedules and delivers weekly analytics reports every Monday at a configured time
 * via Telegram. Also wires the marketing service's getWeeklyAnalytics to the
 * Telegram bot's analytics provider for on-demand /analytics command access.
 *
 * Metrics delivered:
 * - Total conversations by channel
 * - Top 5 inquiry topics
 * - Conversion rate (inquiry → order)
 * - Average response time per channel
 *
 * Requirements: 14.2, 14.4
 */

import type { WeeklyReport, OwnerNotification } from '../types';
import { marketingService } from './marketing.service';
import { notificationService } from './notification.service';
import { telegramBot } from '../integrations/telegram.bot';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Default hour for Monday analytics delivery (9:00 AM local) */
const DEFAULT_ANALYTICS_HOUR = 9;

/** Default minute for analytics delivery */
const DEFAULT_ANALYTICS_MINUTE = 0;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Injectable analytics data provider (for testing) */
export type AnalyticsDataProvider = () => Promise<WeeklyReport>;

// -----------------------------------------------------------------------------
// Weekly Analytics Service Implementation
// -----------------------------------------------------------------------------

export class WeeklyAnalyticsService {
  private _weeklyTimer: ReturnType<typeof setTimeout> | null = null;
  private _isRunning = false;
  private _analyticsProvider: AnalyticsDataProvider;
  private _hour: number;
  private _minute: number;

  constructor(
    analyticsProvider?: AnalyticsDataProvider,
    hour?: number,
    minute?: number,
  ) {
    this._analyticsProvider =
      analyticsProvider ?? (() => marketingService.getWeeklyAnalytics());
    this._hour = hour ?? DEFAULT_ANALYTICS_HOUR;
    this._minute = minute ?? DEFAULT_ANALYTICS_MINUTE;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Whether the scheduler is currently running.
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * The configured delivery hour (0-23).
   */
  get hour(): number {
    return this._hour;
  }

  /**
   * The configured delivery minute (0-59).
   */
  get minute(): number {
    return this._minute;
  }

  /**
   * Initialize the service: wire the analytics provider to the Telegram bot
   * and start the weekly scheduler.
   *
   * This should be called once at application startup.
   */
  initialize(): void {
    this.wireTelegramBot();
    this.startScheduler();
  }

  /**
   * Wire the analytics provider to the Telegram bot's /analytics command.
   * After calling this, the /analytics command will use marketingService.getWeeklyAnalytics().
   */
  wireTelegramBot(): void {
    telegramBot.setAnalyticsProvider(this._analyticsProvider);
  }

  /**
   * Start the weekly scheduler for Monday delivery.
   */
  startScheduler(): void {
    if (this._isRunning) {
      return;
    }

    this._isRunning = true;
    this.scheduleNextMonday();
  }

  /**
   * Stop the weekly scheduler.
   */
  stopScheduler(): void {
    this._isRunning = false;

    if (this._weeklyTimer) {
      clearTimeout(this._weeklyTimer);
      this._weeklyTimer = null;
    }
  }

  /**
   * Execute weekly analytics delivery.
   *
   * Fetches the weekly report from the analytics provider and delivers it
   * via Telegram to the owner.
   *
   * Can be called manually for testing or on-demand delivery.
   */
  async deliverWeeklyAnalytics(): Promise<WeeklyReport> {
    const report = await this._analyticsProvider();
    await this.sendAnalyticsViaTelegram(report);
    return report;
  }

  /**
   * Set a custom analytics data provider (for testing).
   */
  setAnalyticsProvider(provider: AnalyticsDataProvider): void {
    this._analyticsProvider = provider;
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  /**
   * Format a weekly report into a readable Telegram message.
   */
  formatWeeklyReport(report: WeeklyReport): string {
    const channels = Object.entries(report.totalConversationsByChannel)
      .map(([ch, count]) => `  • ${ch}: ${count}`)
      .join('\n');

    const topics = report.topTopics
      .slice(0, 5)
      .map((t, i) => `  ${i + 1}. ${t.topic} (${t.count})`)
      .join('\n');

    const avgResponseTimes = Object.entries(
      report.averageResponseTimeByChannel,
    )
      .map(([ch, time]) => `  • ${ch}: ${(time / 1000).toFixed(1)}s`)
      .join('\n');

    return [
      '📈 <b>Weekly Analytics Report</b>',
      '',
      `📅 ${report.weekStarting.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${report.weekEnding.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      '',
      '<b>Conversations by Channel:</b>',
      channels || '  No conversations this week.',
      '',
      '<b>Top 5 Topics:</b>',
      topics || '  No topics recorded.',
      '',
      `<b>Conversion Rate:</b> ${(report.conversionRate * 100).toFixed(1)}%`,
      '',
      '<b>Avg Response Time:</b>',
      avgResponseTimes || '  No data available.',
    ].join('\n');
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Send the weekly analytics report to the owner via Telegram notification.
   */
  private async sendAnalyticsViaTelegram(report: WeeklyReport): Promise<void> {
    const message = this.formatWeeklyReport(report);

    const notification: OwnerNotification = {
      type: 'system_alert',
      content: message,
      priority: 'normal',
    };

    await notificationService.notifyOwner(notification);
  }

  /**
   * Schedule a timer for the next Monday at the configured time.
   */
  private scheduleNextMonday(): void {
    const msUntilNextMonday = this.getMillisecondsUntilNextMonday();

    this._weeklyTimer = setTimeout(async () => {
      await this.deliverWeeklyAnalytics();

      // Reschedule for next Monday
      if (this._isRunning) {
        this.scheduleNextMonday();
      }
    }, msUntilNextMonday);
  }

  /**
   * Calculate milliseconds until the next Monday at the configured time.
   */
  getMillisecondsUntilNextMonday(): number {
    const now = new Date();
    const target = new Date(now);

    // Set target to the configured hour
    target.setHours(this._hour, this._minute, 0, 0);

    // Calculate days until Monday (1 = Monday)
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ...
    let daysUntilMonday = (1 - currentDay + 7) % 7;

    // If it's Monday but we've already passed the target time, go to next Monday
    if (daysUntilMonday === 0 && now >= target) {
      daysUntilMonday = 7;
    }

    target.setDate(target.getDate() + daysUntilMonday);

    return target.getTime() - now.getTime();
  }
}

// -----------------------------------------------------------------------------
// Singleton Export
// -----------------------------------------------------------------------------

export const weeklyAnalyticsService = new WeeklyAnalyticsService();

// Export constants for testing
export { DEFAULT_ANALYTICS_HOUR, DEFAULT_ANALYTICS_MINUTE };
