/**
 * Instagram Integration
 *
 * Implements the InstagramIntegration interface for:
 * - DM webhook handling: Parsing Instagram DM webhook payloads
 * - Keyword detection: Routing cake-related DMs to AI Assistant
 * - Comment webhook handling: Detecting purchase-intent and auto-replying
 * - Message delivery: Sending DM replies and comment replies via Instagram Graph API
 *
 * All DMs are routed to the AI_Assistant:
 * - DMs with cake-related keywords are routed for order-related processing
 * - DMs without keywords are routed for a greeting response
 *
 * Comments with purchase-intent keywords get an auto-reply within 60 seconds
 * directing the customer to DM or WhatsApp.
 *
 * Inbound messages are delivered to the Message Router within 3 seconds.
 *
 * Requirements: 9.1, 9.2, 9.6
 */

import type { InstagramDMPayload, InstagramCommentPayload, InstagramIntegration, ContentPlan } from '@/types';
import { messageRouter, type RawChannelMessage } from '@/services/message-router';
import { retryExternalCall } from '@/lib/retry';
import { handleDMWithTimeout } from '@/integrations/instagram-degradation';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const INSTAGRAM_API_BASE = 'https://graph.facebook.com/v18.0';

/**
 * Cake-related keywords used to identify order-related DMs.
 * Matched case-insensitively against the message text.
 */
export const CAKE_KEYWORDS: string[] = [
  'cake',
  'order',
  'price',
  'custom',
  'birthday',
  'wedding',
  'cupcake',
  'dessert',
  'book',
  'quote',
];

// -----------------------------------------------------------------------------
// Keyword Detection
// -----------------------------------------------------------------------------

/**
 * Checks whether the given text contains any cake-related keywords.
 * Matching is case-insensitive and checks for keyword presence as substrings.
 *
 * @param text - The DM text content to check
 * @returns true if at least one keyword is found in the text
 */
export function hasCakeKeywords(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CAKE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Purchase-intent keywords for Instagram comment detection.
 * Matched case-insensitively as whole words (word boundaries).
 *
 * Requirement 9.2: order, price, how much, available, book
 */
export const PURCHASE_INTENT_KEYWORDS: string[] = [
  'order',
  'price',
  'how much',
  'available',
  'book',
];

/**
 * Auto-reply message sent when purchase-intent is detected in a comment.
 * Directs the customer to DM or WhatsApp for order details.
 */
export const COMMENT_AUTO_REPLY_MESSAGE =
  "Thanks for your interest! 🎂 Send us a DM or message us on WhatsApp to discuss your order.";

/**
 * Checks whether the given text contains any purchase-intent keywords
 * as case-insensitive whole words.
 *
 * Uses word boundary matching (\b) for single-word keywords and
 * case-insensitive substring matching with surrounding word boundaries
 * for multi-word keywords like "how much".
 *
 * @param text - The comment text content to check
 * @returns true if at least one purchase-intent keyword is found as a whole word
 */
export function hasPurchaseIntent(text: string): boolean {
  if (!text) return false;

  return PURCHASE_INTENT_KEYWORDS.some((keyword) => {
    // Build a regex for whole-word, case-insensitive matching
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(text);
  });
}

// -----------------------------------------------------------------------------
// Instagram Integration Implementation
// -----------------------------------------------------------------------------

class InstagramIntegrationImpl implements Omit<InstagramIntegration, 'generateWeeklyContentPlan'> {
  /**
   * Handles an inbound Instagram DM webhook payload.
   *
   * Parses the webhook payload and delivers the message to the Message Router
   * for AI processing. Must complete within 3 seconds per Requirement 9.1.
   *
   * All DMs are routed to the AI_Assistant:
   * - DMs with cake keywords get full order-handling treatment
   * - DMs without keywords get a greeting response from the AI_Assistant
   */
  async handleDMWebhook(payload: InstagramDMPayload): Promise<void> {
    // Validate the payload has the expected structure
    if (payload.object !== 'instagram') {
      return;
    }

    const entry = payload.entry?.[0];
    const messaging = entry?.messaging?.[0];

    // Only process if there is an actual message with text
    if (!messaging || !messaging.message?.text) {
      return;
    }

    const senderId = messaging.sender?.id;

    // Deliver to Message Router as a raw channel message
    // The Message Router normalizes and routes to AI_Assistant
    const rawMessage: RawChannelMessage = {
      channel: 'instagram',
      payload,
    };

    // Route through message router with timeout-based graceful degradation.
    // If AI response takes >10s, sends predefined acknowledgment DM (Requirement 12.7)
    const timeoutResult = await handleDMWithTimeout(
      () => messageRouter.handleInbound(rawMessage),
      senderId || ''
    );

    if (timeoutResult.success && timeoutResult.result) {
      // AI responded in time — send the response
      await this.sendDM(timeoutResult.result.recipientId, timeoutResult.result.content);
    }
    // If timed out: acknowledgment already sent by handleDMWithTimeout
    // If failed: error already logged by handleDMWithTimeout — skip
  }

  /**
   * Sends a DM reply to an Instagram user via the Graph API.
   *
   * Uses retry with exponential backoff (1s, 2s, 4s) for resilience.
   *
   * @param recipientId - The recipient's Instagram-scoped user ID
   * @param content - The text message content to send
   */
  async sendDM(recipientId: string, content: string): Promise<void> {
    const { accessToken, pageId } = this.getConfig();

    const url = `${INSTAGRAM_API_BASE}/${pageId}/messages`;
    const body = {
      recipient: { id: recipientId },
      message: { text: content },
    };

    await retryExternalCall('instagram', async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Instagram API error: ${response.status} - ${errorData}`
        );
      }
    });
  }

  /**
   * Handles an inbound Instagram comment webhook payload.
   *
   * Parses the comment webhook, checks for purchase-intent keywords
   * (order, price, how much, available, book) matched as whole words
   * case-insensitively. If detected, auto-replies within 60 seconds
   * directing the customer to DM or WhatsApp.
   *
   * Requirement 9.2
   */
  async handleCommentWebhook(payload: InstagramCommentPayload): Promise<void> {
    if (payload.object !== 'instagram') {
      return;
    }

    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];

    // Only process comment changes
    if (!change || change.field !== 'comments') {
      return;
    }

    const commentText = change.value?.text;
    const commentId = change.value?.id;

    if (!commentText || !commentId) {
      return;
    }

    // Check for purchase-intent keywords as whole words, case-insensitive
    if (hasPurchaseIntent(commentText)) {
      // Auto-reply directing to DM or WhatsApp
      await this.replyToComment(commentId, COMMENT_AUTO_REPLY_MESSAGE);
    }
  }

  /**
   * Replies to an Instagram comment via the Graph API.
   *
   * Uses retry with exponential backoff (1s, 2s, 4s) for resilience.
   *
   * @param commentId - The ID of the comment to reply to
   * @param content - The text content of the reply
   */
  async replyToComment(commentId: string, content: string): Promise<void> {
    const { accessToken } = this.getConfig();

    const url = `${INSTAGRAM_API_BASE}/${commentId}/replies`;
    const body = {
      message: content,
    };

    await retryExternalCall('instagram', async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Instagram API error: ${response.status} - ${errorData}`
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Retrieves Instagram API configuration from environment variables.
   */
  private getConfig(): { accessToken: string; pageId: string } {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const pageId = process.env.INSTAGRAM_PAGE_ID;

    if (!accessToken || !pageId) {
      throw new Error(
        'Instagram API configuration missing: INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_PAGE_ID are required'
      );
    }

    return { accessToken, pageId };
  }
}

// -----------------------------------------------------------------------------
// Singleton Export
// -----------------------------------------------------------------------------

const instagramIntegration = new InstagramIntegrationImpl();

export { instagramIntegration };
export type { InstagramIntegrationImpl };
