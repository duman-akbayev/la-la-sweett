/**
 * Session management utility for Redis.
 *
 * Manages chat widget and WhatsApp conversation sessions with a 30-minute timeout.
 * Sessions store serialized JSON data keyed by session ID.
 *
 * Requirements: 11.3, 11.4 (session-based rate limiting context)
 */

import { getRedisClient, REDIS_KEYS } from "./redis";

/** Default session timeout in seconds (30 minutes) */
const DEFAULT_SESSION_TIMEOUT_SECONDS = 30 * 60;

export interface SessionData {
  sessionId: string;
  channel: "whatsapp" | "instagram" | "chat_widget";
  customerId?: string;
  messages?: Array<{ role: string; content: string; timestamp: string }>;
  capturedIntent?: Record<string, unknown>;
  createdAt: string;
  lastActivityAt: string;
  [key: string]: unknown;
}

/**
 * Retrieves a session by its ID.
 * Returns null if the session does not exist or has expired.
 */
export async function getSession(
  sessionId: string,
): Promise<SessionData | null> {
  const redis = getRedisClient();
  const key = `${REDIS_KEYS.SESSION}${sessionId}`;

  const data = await redis.get(key);
  if (!data) {
    return null;
  }

  return JSON.parse(data) as SessionData;
}

/**
 * Creates or updates a session with the given data.
 * Automatically sets/resets the 30-minute expiration timer.
 */
export async function setSession(
  sessionId: string,
  data: SessionData,
  timeoutSeconds: number = DEFAULT_SESSION_TIMEOUT_SECONDS,
): Promise<void> {
  const redis = getRedisClient();
  const key = `${REDIS_KEYS.SESSION}${sessionId}`;

  // Update lastActivityAt on every set
  data.lastActivityAt = new Date().toISOString();

  await redis.set(key, JSON.stringify(data), "EX", timeoutSeconds);
}

/**
 * Refreshes the expiration timer on an existing session without modifying data.
 * Returns true if the session exists and was refreshed, false otherwise.
 */
export async function refreshSession(
  sessionId: string,
  timeoutSeconds: number = DEFAULT_SESSION_TIMEOUT_SECONDS,
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${REDIS_KEYS.SESSION}${sessionId}`;

  const result = await redis.expire(key, timeoutSeconds);
  return result === 1;
}

/**
 * Explicitly expires (deletes) a session.
 * Returns true if the session existed and was deleted, false otherwise.
 */
export async function expireSession(sessionId: string): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${REDIS_KEYS.SESSION}${sessionId}`;

  const result = await redis.del(key);
  return result === 1;
}

/**
 * Gets the remaining TTL (time to live) for a session in seconds.
 * Returns -2 if the key does not exist, -1 if no TTL is set.
 */
export async function getSessionTTL(sessionId: string): Promise<number> {
  const redis = getRedisClient();
  const key = `${REDIS_KEYS.SESSION}${sessionId}`;

  return redis.ttl(key);
}
