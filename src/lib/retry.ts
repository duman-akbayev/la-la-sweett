/**
 * Retry utility with exponential backoff for external API calls.
 *
 * Implements Property 19 / Requirement 12.6:
 * For any failed external API call, the system must retry exactly 3 times
 * with intervals of 1s, 2s, and 4s (exponential backoff from 1s base).
 * If all retries fail, an owner alert must be generated.
 */

/** Supported external API names for typed retry wrapper */
export type ExternalApiName = "whatsapp" | "instagram" | "telegram" | "claude";

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000). Actual delays: base*2^0, base*2^1, base*2^2 */
  baseDelayMs?: number;
  /** Called on each retry attempt with the attempt number (1-based) and the error */
  onRetry?: (attempt: number, error: Error) => void;
  /** Called when all retries are exhausted, before throwing */
  onAllRetriesFailed?: (error: Error) => void;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

/**
 * Delays execution for the specified number of milliseconds.
 * Extracted for testability with fake timers.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates the delay for a given retry attempt using exponential backoff.
 * attempt is 0-indexed: delay = baseDelayMs * 2^attempt
 * - Attempt 0: 1000ms (1s)
 * - Attempt 1: 2000ms (2s)
 * - Attempt 2: 4000ms (4s)
 */
export function calculateDelay(
  attempt: number,
  baseDelayMs: number = DEFAULT_BASE_DELAY_MS,
): number {
  return baseDelayMs * Math.pow(2, attempt);
}

/**
 * Wraps an async function with exponential backoff retry logic.
 *
 * On first call, executes fn() immediately. If it throws:
 * - Waits 1s, then retries (attempt 1)
 * - Waits 2s, then retries (attempt 2)
 * - Waits 4s, then retries (attempt 3)
 *
 * If all retries fail, calls onAllRetriesFailed and throws the last error.
 *
 * @param fn - Async function to execute with retry logic
 * @param options - Configuration for retry behavior
 * @returns The result of fn() on success
 * @throws The last error encountered if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const onRetry = options?.onRetry;
  const onAllRetriesFailed = options?.onAllRetriesFailed;

  let lastError: Error | undefined;

  // Initial attempt + maxRetries retries = maxRetries + 1 total attempts
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this was a retry (not the initial attempt), we've already waited
      // If we've exhausted all retries, break out
      if (attempt === maxRetries) {
        break;
      }

      // Notify about the retry
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      // Wait with exponential backoff before next attempt
      const delayMs = calculateDelay(attempt, baseDelayMs);
      await delay(delayMs);
    }
  }

  // All retries exhausted
  if (onAllRetriesFailed && lastError) {
    onAllRetriesFailed(lastError);
  }

  throw lastError;
}

/**
 * Alert payload generated when all retries fail for an external API call.
 */
export interface RetryExhaustedAlert {
  apiName: ExternalApiName;
  error: Error;
  timestamp: Date;
  totalAttempts: number;
}

/** Listeners for retry exhaustion alerts (owner notifications) */
type AlertListener = (alert: RetryExhaustedAlert) => void;
const alertListeners: AlertListener[] = [];

/**
 * Registers a listener that will be called when all retries fail for any external API call.
 * Used by the notification service to generate owner alerts.
 */
export function onRetryExhausted(listener: AlertListener): () => void {
  alertListeners.push(listener);
  // Return unsubscribe function
  return () => {
    const index = alertListeners.indexOf(listener);
    if (index >= 0) {
      alertListeners.splice(index, 1);
    }
  };
}

/**
 * Emits a retry exhausted alert to all registered listeners.
 */
function emitRetryExhaustedAlert(alert: RetryExhaustedAlert): void {
  for (const listener of alertListeners) {
    listener(alert);
  }
}

/**
 * Typed wrapper for external API calls with retry logic and automatic alert generation.
 *
 * When all retries are exhausted, this function:
 * 1. Emits an alert to all registered listeners (for owner notification)
 * 2. Throws the last error
 *
 * @param apiName - Name of the external API being called
 * @param fn - Async function making the API call
 * @param options - Optional retry configuration overrides
 * @returns The result of fn() on success
 * @throws The last error encountered if all retries are exhausted
 */
export async function retryExternalCall<T>(
  apiName: ExternalApiName,
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

  return withRetry(fn, {
    ...options,
    onAllRetriesFailed: (error) => {
      // Emit alert for owner notification
      emitRetryExhaustedAlert({
        apiName,
        error,
        timestamp: new Date(),
        totalAttempts: maxRetries + 1, // initial + retries
      });

      // Also call user-provided callback if any
      if (options?.onAllRetriesFailed) {
        options.onAllRetriesFailed(error);
      }
    },
  });
}

/**
 * Clears all registered alert listeners.
 * Primarily for testing purposes.
 */
export function clearAlertListeners(): void {
  alertListeners.length = 0;
}
