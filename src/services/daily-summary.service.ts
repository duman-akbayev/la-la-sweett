/**
 * Daily Summary Service
 *
 * Responsible for:
 * - Scheduling a daily summary at 20:00 local time (Requirements: 8.3)
 * - Generating daily stats: total inquiries, orders, estimated revenue, top 3 cake types
 * - Checking for unresponded customer messages after 30 minutes (Requirements: 8.5)
 * - Sending alerts for unresponded messages
 *
 * Requirements: 8.3, 8.5
 */

import { getRedisClient, REDIS_KEYS } from '../lib/redis';
import { notificationService } from './notification.service';
import type { DailySummary, OwnerNotification } from '../types';

// Redis key for tracking pending (unresponded) customer messages
const PENDING_MESSAGES_KEY = 'messages:pending';

// 30 minutes in milliseconds
const UNRESPONDED_THRESHOLD_MS = 30 * 60 * 1000;

// Check interval for unresponded messages (every 5 minutes)
const UNRESPONDED_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Daily summary hour (20:00 local time)
const DAILY_SUMMARY_HOUR = 20;

// Daily summary minute
const DAILY_SUMMARY_MINUTE = 0;

/** Represents a pending (unresponded) customer message tracked in Redis */
export interface PendingMessage {
  messageId: string;
  customerName: string;
  channel: string;
  content: string;
  receivedAt: string; // ISO timestamp
  alerted: boolean;
}

/** Injectable data provider for daily summary statistics */
export type DailySummaryDataProvider = () => Promise<DailySummary>;

/**
 * Daily Summary Service class
 *
 * Manages scheduled daily summaries and unresponded message alerts.
 */
export class DailySummaryService {
  private dailySummaryTimer: ReturnType<typeof setTimeout> | null = null;
  private unrespondedCheckTimer: ReturnType<typeof setInterval> | null = null;
  private _dataProvider: DailySummaryDataProvider | null = null;
  private _isRunning = false;

  /**
   * Set the data provider for generating daily summary statistics.
   * This allows injection of the actual database query logic.
   */
  setDataProvider(provider: DailySummaryDataProvider): void {
    this._dataProvider = provider;
  }

  /**
   * Start the daily summary scheduler and unresponded message checker.
   */
  start(): void {
    if (this._isRunning) {
      return;
    }

    this._isRunning = true;
    this.scheduleDailySummary();
    this.startUnrespondedCheck();
  }

  /**
   * Stop all scheduled tasks and clean up timers.
   */
  stop(): void {
    this._isRunning = false;

    if (this.dailySummaryTimer) {
      clearTimeout(this.dailySummaryTimer);
      this.dailySummaryTimer = null;
    }

    if (this.unrespondedCheckTimer) {
      clearInterval(this.unrespondedCheckTimer);
      this.unrespondedCheckTimer = null;
    }
  }

  /**
   * Whether the service is currently running.
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  // ---------------------------------------------------------------------------
  // Daily Summary Scheduling
  // ---------------------------------------------------------------------------

  /**
   * Schedule the daily summary to run at 20:00 local time.
   * Uses setTimeout to schedule the next occurrence, then reschedules after execution.
   */
  scheduleDailySummary(): void {
    const msUntilNext = this.getMillisecondsUntilNextSummary();

    this.dailySummaryTimer = setTimeout(async () => {
      await this.executeDailySummary();

      // Reschedule for the next day
      if (this._isRunning) {
        this.scheduleDailySummary();
      }
    }, msUntilNext);
  }

  /**
   * Calculate milliseconds until the next 20:00 local time.
   */
  getMillisecondsUntilNextSummary(): number {
    const now = new Date();
    const target = new Date(now);
    target.setHours(DAILY_SUMMARY_HOUR, DAILY_SUMMARY_MINUTE, 0, 0);

    // If we've already passed 20:00 today, schedule for tomorrow
    if (now >= target) {
      target.setDate(target.getDate() + 1);
    }

    return target.getTime() - now.getTime();
  }

  /**
   * Execute the daily summary: generate stats and send via notification service.
   */
  async executeDailySummary(): Promise<void> {
    const summary = await this.generateDailySummary();
    await notificationService.sendDailySummary();

    // Also set the provider on the notification service if we have one
    if (this._dataProvider && !notificationService._dailySummaryProvider) {
      notificationService.setDailySummaryProvider(this._dataProvider);
    }
  }

  /**
   * Generate the daily summary data.
   *
   * If a data provider is configured, uses it to query actual order data.
   * Otherwise, returns a default empty summary.
   */
  async generateDailySummary(): Promise<DailySummary> {
    if (this._dataProvider) {
      return this._dataProvider();
    }

    // Default: return empty summary for today
    return {
      date: new Date(),
      totalInquiries: 0,
      ordersReceived: 0,
      estimatedRevenue: 0,
      topCakeTypes: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Unresponded Message Alerts
  // ---------------------------------------------------------------------------

  /**
   * Start periodic checking for unresponded messages.
   * Runs every 5 minutes to check for messages waiting > 30 minutes.
   */
  startUnrespondedCheck(): void {
    this.unrespondedCheckTimer = setInterval(async () => {
      await this.checkUnrespondedMessages();
    }, UNRESPONDED_CHECK_INTERVAL_MS);
  }

  /**
   * Check for customer messages that have been waiting more than 30 minutes
   * without a response. Sends an alert for each unresponded message.
   */
  async checkUnrespondedMessages(): Promise<void> {
    const pendingMessages = await this.getPendingMessages();
    const now = Date.now();

    for (const message of pendingMessages) {
      if (message.alerted) {
        continue; // Already sent an alert for this message
      }

      const receivedAt = new Date(message.receivedAt).getTime();
      const elapsed = now - receivedAt;

      if (elapsed >= UNRESPONDED_THRESHOLD_MS) {
        await this.sendUnrespondedAlert(message);
        await this.markMessageAlerted(message.messageId);
      }
    }
  }

  /**
   * Send an alert to the owner about an unresponded customer message.
   */
  async sendUnrespondedAlert(message: PendingMessage): Promise<void> {
    const elapsedMinutes = Math.round(
      (Date.now() - new Date(message.receivedAt).getTime()) / (60 * 1000)
    );

    const content = [
      '⚠️ <b>Unresponded Message Alert</b>',
      '',
      `👤 Customer: ${message.customerName || 'Unknown'}`,
      `📱 Channel: ${message.channel}`,
      `⏱ Waiting: ${elapsedMinutes} minutes`,
      '',
      `💬 "${message.content.slice(0, 200)}${message.content.length > 200 ? '...' : ''}"`,
    ].join('\n');

    const notification: OwnerNotification = {
      type: 'unresponded_alert',
      content,
      priority: 'high',
    };

    await notificationService.notifyOwner(notification);
  }

  // ---------------------------------------------------------------------------
  // Pending Message Tracking (Redis-based)
  // ---------------------------------------------------------------------------

  /**
   * Track a new customer message as pending (awaiting response).
   * Called when a customer message is received.
   */
  async trackPendingMessage(message: PendingMessage): Promise<void> {
    const redis = getRedisClient();
    await redis.hset(
      PENDING_MESSAGES_KEY,
      message.messageId,
      JSON.stringify(message)
    );
  }

  /**
   * Mark a message as responded to (remove from pending).
   * Called when a response is sent to the customer.
   */
  async markMessageResponded(messageId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.hdel(PENDING_MESSAGES_KEY, messageId);
  }

  /**
   * Mark a message as alerted (so we don't send duplicate alerts).
   */
  async markMessageAlerted(messageId: string): Promise<void> {
    const redis = getRedisClient();
    const data = await redis.hget(PENDING_MESSAGES_KEY, messageId);

    if (data) {
      const message: PendingMessage = JSON.parse(data);
      message.alerted = true;
      await redis.hset(
        PENDING_MESSAGES_KEY,
        messageId,
        JSON.stringify(message)
      );
    }
  }

  /**
   * Get all currently pending (unresponded) messages.
   */
  async getPendingMessages(): Promise<PendingMessage[]> {
    const redis = getRedisClient();
    const all = await redis.hgetall(PENDING_MESSAGES_KEY);

    return Object.values(all).map(
      (value) => JSON.parse(value) as PendingMessage
    );
  }

  /**
   * Clear all pending messages (useful for testing).
   */
  async clearPendingMessages(): Promise<void> {
    const redis = getRedisClient();
    await redis.del(PENDING_MESSAGES_KEY);
  }
}

// Singleton instance
export const dailySummaryService = new DailySummaryService();

// Export constants for testing
export {
  PENDING_MESSAGES_KEY,
  UNRESPONDED_THRESHOLD_MS,
  UNRESPONDED_CHECK_INTERVAL_MS,
  DAILY_SUMMARY_HOUR,
  DAILY_SUMMARY_MINUTE,
};
