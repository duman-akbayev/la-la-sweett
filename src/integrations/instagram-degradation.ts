/**
 * Instagram Graceful Degradation Module
 *
 * Implements graceful degradation for Instagram DM messaging:
 * - AI timeout (>10s): sends predefined acknowledgment DM
 * - Retry 3x with exponential backoff (1s, 2s, 4s) via retryExternalCall
 * - On all retries exhausted: log the failure and skip (don't crash)
 *
 * Requirements: 12.7, 12.6
 */

import { instagramIntegration } from '@/integrations/instagram';
import { retryExternalCall } from '@/lib/retry';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Default timeout for AI processing in milliseconds */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Predefined acknowledgment message sent when AI times out */
export const ACKNOWLEDGMENT_MESSAGE =
  "Thanks for reaching out! We're looking into your message and will get back to you shortly. 🎂";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TimeoutResult<T> {
  /** Whether the operation completed within the timeout */
  success: boolean;
  /** The result of the operation (only set if success=true) */
  result?: T;
  /** Whether the timeout was triggered */
  timedOut: boolean;
}

// -----------------------------------------------------------------------------
// Core Functions
// -----------------------------------------------------------------------------

/**
 * Wraps a DM processing operation with a timeout.
 *
 * If the operation takes longer than timeoutMs (default 10s), sends a predefined
 * acknowledgment DM to the recipient and returns a timeout result.
 *
 * On failure (including retries exhausted), logs the error and skips — does not crash.
 *
 * @param processFn - The async function to execute (e.g., AI processing)
 * @param recipientId - Instagram-scoped user ID to send acknowledgment if timeout occurs
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns TimeoutResult indicating whether the operation completed or timed out
 */
export async function handleDMWithTimeout<T>(
  processFn: () => Promise<T>,
  recipientId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<TimeoutResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    timeoutId = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  try {
    const result = await Promise.race([
      processFn().then((res) => ({ type: 'success' as const, value: res })),
      timeoutPromise.then(() => ({ type: 'timeout' as const, value: undefined })),
    ]);

    if (result.type === 'timeout') {
      // AI timed out — send predefined acknowledgment DM
      await sendAcknowledgmentDM(recipientId);

      return {
        success: false,
        timedOut: true,
      };
    }

    return {
      success: true,
      result: result.value as T,
      timedOut: false,
    };
  } catch (error) {
    // Operation threw an error — log and skip (don't crash)
    console.error(
      '[Instagram Degradation] DM processing failed:',
      error instanceof Error ? error.message : String(error)
    );

    return {
      success: false,
      timedOut: false,
    };
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Sends a predefined acknowledgment DM to an Instagram user
 * when the AI fails to respond within the timeout window.
 *
 * Uses retry with exponential backoff (1s, 2s, 4s) via retryExternalCall.
 * If all retries are exhausted, logs the failure and skips (does not crash).
 *
 * @param recipientId - The recipient's Instagram-scoped user ID
 * @param message - Optional custom acknowledgment message
 */
export async function sendAcknowledgmentDM(
  recipientId: string,
  message: string = ACKNOWLEDGMENT_MESSAGE
): Promise<void> {
  try {
    await retryExternalCall('instagram', async () => {
      await instagramIntegration.sendDM(recipientId, message);
    });
  } catch (error) {
    // All retries exhausted — log and skip (don't crash)
    console.error(
      '[Instagram Degradation] Failed to send acknowledgment DM after all retries:',
      {
        recipientId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }
    );
  }
}
