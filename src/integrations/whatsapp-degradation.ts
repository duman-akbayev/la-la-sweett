/**
 * WhatsApp Graceful Degradation Module
 *
 * Implements graceful degradation for WhatsApp messaging:
 * - AI timeout (>10s): sends predefined acknowledgment message
 * - Retry failed API calls 3x with exponential backoff (1s, 2s, 4s)
 * - Alert owner if all retries fail
 * - 24-hour follow-up for abandoned intake flows
 *
 * Requirements: 12.2, 12.6, 7.7
 */

import { whatsappIntegration } from '@/integrations/whatsapp';
import { retryExternalCall } from '@/lib/retry';
import { notificationService } from '@/services/notification.service';
import { getRedisClient } from '@/lib/redis';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Default timeout for AI processing in milliseconds */
const DEFAULT_TIMEOUT_MS = 10_000;

/** Predefined acknowledgment message sent when AI times out */
const ACKNOWLEDGMENT_MESSAGE =
  "Thanks for your message! We're processing your request and will get back to you shortly. 🎂";

/** Redis key prefix for follow-up scheduling */
const FOLLOWUP_KEY_PREFIX = 'whatsapp:followup:';

/** Follow-up delay: 24 hours in seconds (for Redis TTL) */
const FOLLOWUP_DELAY_SECONDS = 24 * 60 * 60;

/** Follow-up message sent after 24 hours of inactivity */
const FOLLOWUP_MESSAGE =
  "Hi! 👋 We noticed you started an order inquiry with us. Would you like to continue? We'd love to help you find the perfect cake for your event! 🎂✨";

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

export interface FollowUpData {
  phone: string;
  orderId?: string;
  scheduledAt: string;
  message: string;
}

// -----------------------------------------------------------------------------
// Core Functions
// -----------------------------------------------------------------------------

/**
 * Wraps a message processing operation with a timeout.
 *
 * If the operation takes longer than timeoutMs, sends a predefined
 * acknowledgment message to the recipient and returns a timeout result.
 *
 * @param processFn - The async function to execute (e.g., AI processing)
 * @param recipientPhone - Phone number to send acknowledgment if timeout occurs
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns TimeoutResult indicating whether the operation completed or timed out
 */
export async function handleWithTimeout<T>(
  processFn: () => Promise<T>,
  recipientPhone: string,
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
      // AI timed out — send predefined acknowledgment
      await sendAcknowledgment(recipientPhone);

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
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Sends a predefined acknowledgment message to a WhatsApp recipient
 * when the AI fails to respond within the timeout window.
 *
 * Uses retry with exponential backoff (1s, 2s, 4s) for the API call itself.
 *
 * @param recipientPhone - The recipient's phone number (with country code)
 * @param message - Optional custom acknowledgment message
 */
export async function sendAcknowledgment(
  recipientPhone: string,
  message: string = ACKNOWLEDGMENT_MESSAGE
): Promise<void> {
  try {
    await retryExternalCall('whatsapp', async () => {
      await whatsappIntegration.sendMessage(recipientPhone, message);
    });
  } catch (error) {
    // If even the acknowledgment fails after retries, alert the owner
    await alertOwnerOnFailure(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'send_acknowledgment',
        recipientPhone,
        message: 'Failed to send acknowledgment message after all retries',
      }
    );
  }
}

/**
 * Alerts the bakery owner when all retries for a WhatsApp API call are exhausted.
 *
 * Sends a notification via the notification service (Telegram with email fallback).
 *
 * @param error - The error that caused the final failure
 * @param context - Additional context about the failed operation
 */
export async function alertOwnerOnFailure(
  error: Error,
  context: {
    operation: string;
    recipientPhone?: string;
    message?: string;
  }
): Promise<void> {
  const content = [
    '⚠️ <b>WhatsApp API Failure</b>',
    '',
    `<b>Operation:</b> ${context.operation}`,
    context.recipientPhone
      ? `<b>Recipient:</b> ${context.recipientPhone}`
      : '',
    `<b>Error:</b> ${error.message}`,
    context.message ? `<b>Details:</b> ${context.message}` : '',
    '',
    `<b>Time:</b> ${new Date().toISOString()}`,
    '',
    'All retry attempts (3x with exponential backoff) have been exhausted.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await notificationService.notifyOwner({
      type: 'system_alert',
      content,
      priority: 'high',
    });
  } catch (notifyError) {
    // Last resort: log the error if we can't even notify the owner
    console.error(
      '[WhatsApp Degradation] Failed to alert owner:',
      notifyError
    );
    console.error('[WhatsApp Degradation] Original error:', error.message);
    console.error('[WhatsApp Degradation] Context:', context);
  }
}

/**
 * Schedules a 24-hour follow-up message for an abandoned intake flow.
 *
 * Stores the follow-up data in Redis with a TTL. A background worker
 * (or scheduled job) should check for due follow-ups and send them.
 *
 * @param phone - Customer's phone number
 * @param orderId - Optional order/intent ID associated with the abandoned flow
 */
export async function scheduleFollowUp(
  phone: string,
  orderId?: string
): Promise<void> {
  const redis = getRedisClient();

  const followUpData: FollowUpData = {
    phone,
    orderId,
    scheduledAt: new Date(Date.now() + FOLLOWUP_DELAY_SECONDS * 1000).toISOString(),
    message: FOLLOWUP_MESSAGE,
  };

  const key = `${FOLLOWUP_KEY_PREFIX}${phone}`;

  // Store follow-up data with 25-hour TTL (24h + 1h buffer for processing)
  await redis.set(key, JSON.stringify(followUpData), 'EX', FOLLOWUP_DELAY_SECONDS + 3600);
}

/**
 * Cancels a scheduled follow-up for a phone number.
 * Called when the customer resumes their intake flow.
 *
 * @param phone - Customer's phone number
 */
export async function cancelFollowUp(phone: string): Promise<void> {
  const redis = getRedisClient();
  const key = `${FOLLOWUP_KEY_PREFIX}${phone}`;
  await redis.del(key);
}

/**
 * Retrieves a pending follow-up for a phone number.
 * Returns null if no follow-up is scheduled.
 *
 * @param phone - Customer's phone number
 */
export async function getScheduledFollowUp(
  phone: string
): Promise<FollowUpData | null> {
  const redis = getRedisClient();
  const key = `${FOLLOWUP_KEY_PREFIX}${phone}`;
  const data = await redis.get(key);

  if (!data) {
    return null;
  }

  return JSON.parse(data) as FollowUpData;
}

/**
 * Processes a due follow-up by sending the follow-up message.
 * Removes the follow-up from Redis after sending.
 *
 * @param phone - Customer's phone number
 * @returns true if follow-up was sent, false if no follow-up was pending
 */
export async function processFollowUp(phone: string): Promise<boolean> {
  const followUp = await getScheduledFollowUp(phone);

  if (!followUp) {
    return false;
  }

  try {
    await retryExternalCall('whatsapp', async () => {
      await whatsappIntegration.sendMessage(phone, followUp.message);
    });

    // Remove follow-up after successful delivery
    await cancelFollowUp(phone);
    return true;
  } catch (error) {
    // Alert owner if follow-up delivery fails
    await alertOwnerOnFailure(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'send_followup',
        recipientPhone: phone,
        message: `Failed to send 24-hour follow-up for abandoned intake flow${followUp.orderId ? ` (order: ${followUp.orderId})` : ''}`,
      }
    );
    return false;
  }
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export {
  DEFAULT_TIMEOUT_MS,
  ACKNOWLEDGMENT_MESSAGE,
  FOLLOWUP_KEY_PREFIX,
  FOLLOWUP_DELAY_SECONDS,
  FOLLOWUP_MESSAGE,
};
