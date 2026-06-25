/**
 * Notification Service implementation.
 *
 * Responsible for delivering notifications to the owner (via Telegram) and
 * customers (via their originating channel), managing the Redis notification
 * queue, and triggering email fallback when:
 * - The queue overflows (>1000 items)
 * - Telegram is down for more than 24 hours
 *
 * Requirements: 12.3, 12.4
 */

import crypto from "crypto";
import {
  pushToQueue,
  popFromQueue,
  getQueueLength,
  getAllFromQueue,
  clearQueue,
  MAX_QUEUE_SIZE,
} from "../lib/queue";
import type { QueuedNotification } from "../lib/queue";
import { getRedisClient, REDIS_KEYS } from "../lib/redis";
import { retryExternalCall } from "../lib/retry";
import { circuitBreakers } from "../lib/circuit-breaker";
import type {
  OwnerNotification,
  CustomerNotification,
  DailySummary,
  NotificationService as INotificationService,
} from "../types";

// Redis key to track when the Telegram outage started
const TELEGRAM_OUTAGE_KEY = "telegram:outage_start";

// 24 hours in milliseconds
const OUTAGE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Sends a Telegram message to the owner.
 * This is the actual API call — wrapped in retry and circuit breaker externally.
 */
async function sendTelegramMessage(
  content: string,
  actions?: { label: string; callbackData: string }[],
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error("Telegram bot token or owner chat ID not configured");
  }

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: content,
    parse_mode: "HTML",
  };

  if (actions && actions.length > 0) {
    payload.reply_markup = {
      inline_keyboard: actions.map((action) => [
        { text: action.label, callback_data: action.callbackData },
      ]),
    };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${errorData}`);
  }
}

/**
 * Sends an email to the owner as fallback when Telegram is unavailable.
 * Uses a configurable email transport (e.g., SendGrid, Nodemailer).
 */
async function sendEmailFallback(
  subject: string,
  content: string,
): Promise<void> {
  const ownerEmail = process.env.OWNER_EMAIL;

  if (!ownerEmail) {
    throw new Error("Owner email not configured for fallback");
  }

  // In production, this would use an email service (SendGrid, SES, etc.)
  // For now, we log and mark as sent — the actual transport is injected via
  // the emailTransport dependency.
  if (notificationServiceInstance._emailTransport) {
    await notificationServiceInstance._emailTransport(ownerEmail, subject, content);
  } else {
    console.warn(
      `[NotificationService] Email fallback triggered but no transport configured. Subject: ${subject}`,
    );
  }
}

/**
 * Sends a message to a customer via their originating channel.
 */
async function sendCustomerMessage(
  channel: string,
  recipientId: string,
  content: string,
): Promise<void> {
  // In production, this dispatches to the appropriate channel integration
  // (WhatsApp, Instagram, Chat Widget). The actual transport is injected.
  if (notificationServiceInstance._customerTransport) {
    await notificationServiceInstance._customerTransport(
      channel,
      recipientId,
      content,
    );
  } else {
    console.warn(
      `[NotificationService] Customer transport not configured. Channel: ${channel}, Recipient: ${recipientId}`,
    );
  }
}

/**
 * Records the start of a Telegram outage in Redis.
 */
async function recordOutageStart(): Promise<void> {
  const redis = getRedisClient();
  const existing = await redis.get(TELEGRAM_OUTAGE_KEY);
  if (!existing) {
    await redis.set(TELEGRAM_OUTAGE_KEY, Date.now().toString());
  }
}

/**
 * Clears the Telegram outage tracking key (Telegram is back up).
 */
async function clearOutageRecord(): Promise<void> {
  const redis = getRedisClient();
  await redis.del(TELEGRAM_OUTAGE_KEY);
}

/**
 * Checks if the Telegram outage has exceeded 24 hours.
 */
async function isOutageExceeded(): Promise<boolean> {
  const redis = getRedisClient();
  const outageStart = await redis.get(TELEGRAM_OUTAGE_KEY);

  if (!outageStart) {
    return false;
  }

  const elapsed = Date.now() - parseInt(outageStart, 10);
  return elapsed >= OUTAGE_THRESHOLD_MS;
}

/**
 * Gets the outage start timestamp (or null if no outage).
 */
async function getOutageStart(): Promise<number | null> {
  const redis = getRedisClient();
  const outageStart = await redis.get(TELEGRAM_OUTAGE_KEY);
  return outageStart ? parseInt(outageStart, 10) : null;
}

// Type for email transport function
export type EmailTransport = (
  to: string,
  subject: string,
  body: string,
) => Promise<void>;

// Type for customer message transport function
export type CustomerTransport = (
  channel: string,
  recipientId: string,
  content: string,
) => Promise<void>;

// Type for daily summary data provider
export type DailySummaryProvider = () => Promise<DailySummary>;

/**
 * Notification Service class implementing the NotificationService interface.
 */
class NotificationServiceImpl implements INotificationService {
  /** Injectable email transport for testing and configuration */
  _emailTransport: EmailTransport | null = null;

  /** Injectable customer message transport */
  _customerTransport: CustomerTransport | null = null;

  /** Injectable daily summary data provider */
  _dailySummaryProvider: DailySummaryProvider | null = null;

  /**
   * Set the email transport function (for dependency injection / testing).
   */
  setEmailTransport(transport: EmailTransport): void {
    this._emailTransport = transport;
  }

  /**
   * Set the customer message transport function.
   */
  setCustomerTransport(transport: CustomerTransport): void {
    this._customerTransport = transport;
  }

  /**
   * Set the daily summary data provider function.
   */
  setDailySummaryProvider(provider: DailySummaryProvider): void {
    this._dailySummaryProvider = provider;
  }

  /**
   * Sends a notification to the owner via Telegram.
   * If Telegram is unavailable (circuit breaker open or delivery fails),
   * queues the notification in Redis for later delivery.
   * If queue overflows or outage exceeds 24h, triggers email fallback.
   */
  async notifyOwner(notification: OwnerNotification): Promise<void> {
    try {
      // Attempt delivery through circuit breaker + retry
      await circuitBreakers.telegram.execute(async () => {
        await retryExternalCall("telegram", () =>
          sendTelegramMessage(
            notification.content,
            notification.actions?.map((a) => ({
              label: a.text,
              callbackData: a.callbackData,
            })),
          ),
        );
      });

      // Delivery succeeded — clear outage tracking
      await clearOutageRecord();
    } catch (error) {
      // Delivery failed — record outage and queue notification
      await recordOutageStart();

      // Check if we should use email fallback
      const outageExceeded = await isOutageExceeded();
      const currentQueueLength = await getQueueLength();

      if (outageExceeded || currentQueueLength >= MAX_QUEUE_SIZE) {
        // Email fallback: send summary and flush queue
        await this.triggerEmailFallback(notification);
      } else {
        // Queue the notification for later FIFO delivery
        const queuedNotification: QueuedNotification = {
          id: crypto.randomUUID(),
          type: notification.type,
          content: notification.content,
          actions: notification.actions?.map((a) => ({
            label: a.text,
            callbackData: a.callbackData,
          })),
          priority: notification.priority,
          createdAt: new Date().toISOString(),
        };

        const result = await pushToQueue(queuedNotification);

        if (result.overflow) {
          // Queue is full — email fallback
          await this.triggerEmailFallback(notification);
        }
      }
    }
  }

  /**
   * Sends a notification to a customer via their originating channel.
   */
  async notifyCustomer(notification: CustomerNotification): Promise<void> {
    await sendCustomerMessage(
      notification.channel,
      notification.customerId,
      notification.content,
    );
  }

  /**
   * Queues a notification in Redis for later processing.
   * If the queue is at capacity, triggers email fallback.
   */
  async queueNotification(notification: OwnerNotification): Promise<void> {
    const queuedNotification: QueuedNotification = {
      id: crypto.randomUUID(),
      type: notification.type,
      content: notification.content,
      actions: notification.actions?.map((a) => ({
        label: a.text,
        callbackData: a.callbackData,
      })),
      priority: notification.priority,
      createdAt: new Date().toISOString(),
    };

    const result = await pushToQueue(queuedNotification);

    if (result.overflow) {
      await this.triggerEmailFallback(notification);
    }
  }

  /**
   * Processes all pending notifications from the Redis queue in FIFO order.
   * Called when Telegram reconnects to deliver queued messages.
   */
  async processQueue(): Promise<void> {
    let notification = await popFromQueue();

    while (notification !== null) {
      try {
        await circuitBreakers.telegram.execute(async () => {
          await retryExternalCall("telegram", () =>
            sendTelegramMessage(notification!.content, notification!.actions),
          );
        });
      } catch (error) {
        // If Telegram fails again during queue processing, stop and re-queue
        // Push the failed notification back to the front
        const redis = getRedisClient();
        await redis.lpush(
          REDIS_KEYS.NOTIFICATION_QUEUE,
          JSON.stringify(notification),
        );
        // Stop processing — Telegram is down again
        return;
      }

      notification = await popFromQueue();
    }

    // Queue fully processed — clear outage record
    await clearOutageRecord();
  }

  /**
   * Generates and sends the daily summary at 20:00 local time.
   * Contains: total inquiries, orders received, estimated revenue, top 3 cake types.
   */
  async sendDailySummary(): Promise<void> {
    let summary: DailySummary;

    if (this._dailySummaryProvider) {
      summary = await this._dailySummaryProvider();
    } else {
      // Default: generate empty summary when no provider is configured
      summary = {
        date: new Date(),
        totalInquiries: 0,
        ordersReceived: 0,
        estimatedRevenue: 0,
        topCakeTypes: [],
      };
    }

    const formattedContent = this.formatDailySummary(summary);

    const notification: OwnerNotification = {
      type: "daily_summary",
      content: formattedContent,
      priority: "normal",
    };

    await this.notifyOwner(notification);
  }

  /**
   * Triggers email fallback: sends all queued notifications via email
   * and clears the Redis queue.
   */
  private async triggerEmailFallback(
    currentNotification?: OwnerNotification,
  ): Promise<void> {
    // Collect all queued notifications
    const queued = await getAllFromQueue();

    // Build email content
    let emailBody = "⚠️ Telegram notification delivery failed.\n\n";
    emailBody += `Queued notifications (${queued.length}):\n\n`;

    for (const item of queued) {
      emailBody += `[${item.type}] ${item.createdAt}\n${item.content}\n\n`;
    }

    if (currentNotification) {
      emailBody += `\nLatest notification:\n[${currentNotification.type}] ${currentNotification.content}\n`;
    }

    await sendEmailFallback(
      "La La Sweett: Telegram Notification Fallback",
      emailBody,
    );

    // Clear the queue after email is sent
    await clearQueue();
    await clearOutageRecord();
  }

  /**
   * Formats the daily summary into a readable Telegram message.
   */
  private formatDailySummary(summary: DailySummary): string {
    const topCakes = summary.topCakeTypes
      .slice(0, 3)
      .map((ct, i) => `  ${i + 1}. ${ct.type} (${ct.count} inquiries)`)
      .join("\n");

    return [
      "📊 <b>Daily Summary</b>",
      "",
      `📅 ${summary.date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
      "",
      `📨 Inquiries: ${summary.totalInquiries}`,
      `🎂 Orders: ${summary.ordersReceived}`,
      `💰 Est. Revenue: $${summary.estimatedRevenue.toFixed(2)}`,
      "",
      topCakes
        ? `🏆 Top Cake Types:\n${topCakes}`
        : "No cake inquiries today.",
    ].join("\n");
  }
}

// Singleton instance
const notificationServiceInstance = new NotificationServiceImpl();

export { notificationServiceInstance as notificationService };
export type { NotificationServiceImpl };

// Export utility functions for testing
export {
  recordOutageStart,
  clearOutageRecord,
  isOutageExceeded,
  getOutageStart,
  TELEGRAM_OUTAGE_KEY,
  OUTAGE_THRESHOLD_MS,
};
