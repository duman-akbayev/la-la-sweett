/**
 * WhatsApp Rate Limiting Module
 *
 * Implements per-phone-number rate limiting for inbound WhatsApp messages:
 * - 20 messages per minute per phone number (sliding window via Redis)
 * - Sends a single rate-limit notification on first rejection
 * - Silently drops subsequent excess messages within the same window
 *
 * Requirements: 11.3
 */

import { checkRateLimit, RATE_LIMITS, type RateLimitResult } from '@/lib/rate-limit';
import { getRedisClient, REDIS_KEYS } from '@/lib/redis';

// Key prefix for tracking whether a rate-limit notification has been sent
const RATE_LIMIT_NOTIFIED_PREFIX = `${REDIS_KEYS.RATE_LIMIT}whatsapp:notified:`;

export interface WhatsAppRateLimitCheck {
  /** Whether the message should be processed */
  allowed: boolean;
  /** Whether a rate-limit notification should be sent to the customer */
  shouldNotify: boolean;
  /** Seconds until the rate limit resets (when blocked) */
  retryAfter?: number;
}

/**
 * Checks whether an inbound WhatsApp message from a phone number should be processed.
 *
 * Uses a sliding window rate limiter (20 messages/minute per phone number).
 * On the first rejected message, returns shouldNotify=true so a single notification
 * can be sent to the customer. Subsequent rejections in the same window return
 * shouldNotify=false (messages are silently dropped).
 *
 * @param phoneNumber - The sender's phone number (with country code)
 * @returns WhatsAppRateLimitCheck indicating whether to process, notify, or drop
 */
export async function checkWhatsAppRateLimit(
  phoneNumber: string
): Promise<WhatsAppRateLimitCheck> {
  const rateLimitKey = `whatsapp:${phoneNumber}`;

  const result: RateLimitResult = await checkRateLimit(
    rateLimitKey,
    RATE_LIMITS.WHATSAPP.maxRequests,
    RATE_LIMITS.WHATSAPP.windowSeconds
  );

  if (result.allowed) {
    return { allowed: true, shouldNotify: false };
  }

  // Rate limit exceeded — check if we've already sent a notification
  const shouldNotify = await markNotifiedIfFirst(phoneNumber, result.retryAfter);

  return {
    allowed: false,
    shouldNotify,
    retryAfter: result.retryAfter,
  };
}

/**
 * Marks a phone number as having been notified about rate limiting.
 * Returns true only if this is the first time (notification should be sent).
 * Uses Redis SET NX (set if not exists) for atomicity.
 *
 * @param phoneNumber - The sender's phone number
 * @param retryAfter - Seconds until rate limit resets (used as TTL for the notified flag)
 * @returns true if this is the first notification (should send), false if already notified
 */
async function markNotifiedIfFirst(
  phoneNumber: string,
  retryAfter?: number
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${RATE_LIMIT_NOTIFIED_PREFIX}${phoneNumber}`;

  // TTL for the notification flag: use retryAfter or default to 60 seconds
  const ttlSeconds = retryAfter ?? RATE_LIMITS.WHATSAPP.windowSeconds;

  // SET NX returns "OK" if the key was set (first time), null if it already exists
  const wasSet = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');

  return wasSet === 'OK';
}

/**
 * Generates the rate limit notification message for the customer.
 *
 * @param retryAfter - Seconds until the customer can send messages again
 * @returns The notification message text
 */
export function getRateLimitMessage(retryAfter?: number): string {
  const waitTime = retryAfter ?? 60;
  return (
    `⏳ You've sent too many messages in a short time. ` +
    `Please wait ${waitTime} seconds before sending another message. ` +
    `We'll be happy to help once the limit resets!`
  );
}
