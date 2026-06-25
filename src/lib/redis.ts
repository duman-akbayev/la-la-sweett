/**
 * Redis client configuration for session management, rate limiting, and notification queuing.
 *
 * Uses ioredis for connection management with support for:
 * - Session management (30-minute timeout)
 * - Sliding window rate limiting (WhatsApp: 20/min, Chat: 10/min)
 * - Notification queuing (FIFO, max 1000 items)
 *
 * Environment variables:
 * - REDIS_URL: Redis connection string (default: redis://localhost:6379)
 * - REDIS_PASSWORD: Optional Redis password
 */

import Redis from "ioredis";

let redisClient: Redis | null = null;

export interface RedisConfig {
  url: string;
  password?: string;
  maxRetriesPerRequest?: number;
  retryStrategy?: (times: number) => number | null;
}

/**
 * Returns the default Redis configuration from environment variables.
 */
export function getRedisConfig(): RedisConfig {
  return {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
  };
}

/**
 * Creates and returns a Redis client singleton.
 * Reuses the existing connection if already initialized.
 */
export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const config = getRedisConfig();

  redisClient = new Redis(config.url, {
    password: config.password,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    retryStrategy(times: number) {
      // Exponential backoff: 1s, 2s, 4s, then stop
      if (times > 3) {
        return null;
      }
      return Math.min(times * 1000, 4000);
    },
    lazyConnect: true,
  });

  return redisClient;
}

/**
 * Disconnects the Redis client gracefully.
 * Useful for cleanup during tests or application shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Resets the Redis client reference (for testing purposes).
 * Does not disconnect — use disconnectRedis() for graceful shutdown.
 */
export function resetRedisClient(): void {
  redisClient = null;
}

// Key prefix constants for namespacing
export const REDIS_KEYS = {
  SESSION: "session:",
  RATE_LIMIT: "ratelimit:",
  NOTIFICATION_QUEUE: "notifications:queue",
} as const;
