/**
 * Sliding window rate limiter using Redis sorted sets.
 *
 * Implements rate limiting for:
 * - WhatsApp: 20 messages per minute per phone number
 * - Chat Widget: 10 messages per minute per session
 *
 * Uses a sliding window approach with sorted sets where:
 * - Members are unique request IDs (timestamps + random suffix)
 * - Scores are Unix timestamps in milliseconds
 * - Expired entries are pruned on every check
 *
 * Requirements: 11.3, 11.4
 */

import { getRedisClient, REDIS_KEYS } from "./redis";

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Seconds until the rate limit resets (only set when blocked) */
  retryAfter?: number;
}

/** Default rate limit configurations */
export const RATE_LIMITS = {
  WHATSAPP: { maxRequests: 20, windowSeconds: 60 },
  CHAT_WIDGET: { maxRequests: 10, windowSeconds: 60 },
} as const;

/**
 * Checks and enforces the rate limit for a given key using a sliding window algorithm.
 *
 * @param key - Unique identifier for the rate limit subject (e.g., phone number, session ID)
 * @param maxRequests - Maximum number of requests allowed in the window
 * @param windowSeconds - Size of the sliding window in seconds
 * @returns RateLimitResult indicating whether the request is allowed
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const redisKey = `${REDIS_KEYS.RATE_LIMIT}${key}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  // Use a pipeline for atomicity
  const pipeline = redis.pipeline();

  // Remove expired entries outside the sliding window
  pipeline.zremrangebyscore(redisKey, 0, windowStart);

  // Count current entries in the window
  pipeline.zcard(redisKey);

  const results = await pipeline.exec();

  if (!results) {
    // Pipeline failed, default to allowing the request
    return { allowed: true, remaining: maxRequests - 1 };
  }

  const currentCount = (results[1]?.[1] as number) || 0;

  if (currentCount >= maxRequests) {
    // Rate limit exceeded — calculate retry time
    // Get the oldest entry to determine when the window will free up
    const oldestEntries = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
    let retryAfter = windowSeconds;

    if (oldestEntries.length >= 2) {
      const oldestTimestamp = parseInt(oldestEntries[1], 10);
      retryAfter = Math.ceil(
        (oldestTimestamp + windowSeconds * 1000 - now) / 1000,
      );
      retryAfter = Math.max(1, retryAfter);
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfter,
    };
  }

  // Add the current request to the sorted set
  const uniqueId = `${now}-${Math.random().toString(36).substring(2, 10)}`;
  await redis.zadd(redisKey, now, uniqueId);

  // Set expiration on the key to auto-cleanup (window + small buffer)
  await redis.expire(redisKey, windowSeconds + 1);

  return {
    allowed: true,
    remaining: maxRequests - currentCount - 1,
  };
}

/**
 * Resets the rate limit for a given key (useful for testing or admin overrides).
 */
export async function resetRateLimit(key: string): Promise<void> {
  const redis = getRedisClient();
  const redisKey = `${REDIS_KEYS.RATE_LIMIT}${key}`;
  await redis.del(redisKey);
}

/**
 * Gets the current request count within the sliding window for a given key.
 */
export async function getRateLimitCount(
  key: string,
  windowSeconds: number,
): Promise<number> {
  const redis = getRedisClient();
  const redisKey = `${REDIS_KEYS.RATE_LIMIT}${key}`;
  const windowStart = Date.now() - windowSeconds * 1000;

  // Prune expired entries
  await redis.zremrangebyscore(redisKey, 0, windowStart);

  return redis.zcard(redisKey);
}
