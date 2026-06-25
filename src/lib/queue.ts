/**
 * Notification queue operations using Redis lists.
 *
 * Implements a FIFO queue for Telegram notifications when the bot is unavailable.
 * - Maximum capacity: 1000 items
 * - Delivery order: FIFO (first in, first out)
 * - On reconnect: items are delivered in order
 * - Overflow: handled via email fallback (by the caller)
 *
 * Requirements: 12.3
 */

import { getRedisClient, REDIS_KEYS } from "./redis";

/** Maximum number of items the notification queue can hold */
export const MAX_QUEUE_SIZE = 1000;

export interface QueuedNotification {
  id: string;
  type: "new_order" | "escalation" | "unresponded_alert" | "daily_summary";
  content: string;
  actions?: Array<{ label: string; callbackData: string }>;
  priority: "high" | "normal";
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface PushResult {
  /** Whether the item was successfully queued */
  success: boolean;
  /** Current queue length after the operation */
  queueLength: number;
  /** True if the queue is at capacity (item was NOT added) */
  overflow: boolean;
}

/**
 * Pushes a notification to the end of the queue (FIFO - items are popped from the front).
 * Rejects the push if the queue is already at maximum capacity (1000 items).
 *
 * @returns PushResult indicating success and current queue state
 */
export async function pushToQueue(
  notification: QueuedNotification,
): Promise<PushResult> {
  const redis = getRedisClient();
  const key = REDIS_KEYS.NOTIFICATION_QUEUE;

  // Check current queue length
  const currentLength = await redis.llen(key);

  if (currentLength >= MAX_QUEUE_SIZE) {
    return {
      success: false,
      queueLength: currentLength,
      overflow: true,
    };
  }

  // Push to the right (tail) — pop from the left (head) for FIFO
  const newLength = await redis.rpush(key, JSON.stringify(notification));

  return {
    success: true,
    queueLength: newLength,
    overflow: false,
  };
}

/**
 * Pops the oldest notification from the front of the queue (FIFO order).
 * Returns null if the queue is empty.
 */
export async function popFromQueue(): Promise<QueuedNotification | null> {
  const redis = getRedisClient();
  const key = REDIS_KEYS.NOTIFICATION_QUEUE;

  // Pop from the left (head) for FIFO
  const data = await redis.lpop(key);

  if (!data) {
    return null;
  }

  return JSON.parse(data) as QueuedNotification;
}

/**
 * Returns the current number of items in the notification queue.
 */
export async function getQueueLength(): Promise<number> {
  const redis = getRedisClient();
  const key = REDIS_KEYS.NOTIFICATION_QUEUE;

  return redis.llen(key);
}

/**
 * Removes all items from the notification queue.
 * Use with caution — this is irreversible.
 */
export async function clearQueue(): Promise<void> {
  const redis = getRedisClient();
  const key = REDIS_KEYS.NOTIFICATION_QUEUE;

  await redis.del(key);
}

/**
 * Peeks at the front of the queue without removing the item.
 * Useful for inspecting the next notification to be delivered.
 */
export async function peekQueue(): Promise<QueuedNotification | null> {
  const redis = getRedisClient();
  const key = REDIS_KEYS.NOTIFICATION_QUEUE;

  const data = await redis.lindex(key, 0);

  if (!data) {
    return null;
  }

  return JSON.parse(data) as QueuedNotification;
}

/**
 * Retrieves all items from the queue without removing them.
 * Useful for generating email summaries on overflow or 24h timeout.
 */
export async function getAllFromQueue(): Promise<QueuedNotification[]> {
  const redis = getRedisClient();
  const key = REDIS_KEYS.NOTIFICATION_QUEUE;

  const items = await redis.lrange(key, 0, -1);

  return items.map((item) => JSON.parse(item) as QueuedNotification);
}
