/**
 * WhatsApp Business API Integration
 *
 * Implements the WhatsAppIntegration interface for:
 * - Webhook handling: Parsing inbound WhatsApp webhook payloads
 * - Message delivery: Sending text messages via WhatsApp Cloud API
 * - Template messaging: Sending template messages with parameters
 *
 * Inbound messages are delivered to the Message Router within 3 seconds.
 *
 * Requirements: 7.1, 7.2
 */

import type { WhatsAppIntegration, WhatsAppWebhookPayload } from '@/types';
import { messageRouter, type RawChannelMessage } from '@/services/message-router';
import { retryExternalCall } from '@/lib/retry';
import {
  handleWithTimeout,
  scheduleFollowUp,
  cancelFollowUp,
} from '@/integrations/whatsapp-degradation';
import {
  checkWhatsAppRateLimit,
  getRateLimitMessage,
} from '@/integrations/whatsapp-rate-limit';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const WHATSAPP_API_BASE = 'https://graph.facebook.com/v18.0';

// -----------------------------------------------------------------------------
// WhatsApp Integration Implementation
// -----------------------------------------------------------------------------

class WhatsAppIntegrationImpl implements WhatsAppIntegration {
  /**
   * Handles an inbound WhatsApp webhook payload.
   *
   * Parses the webhook payload and delivers the message to the Message Router
   * for AI processing. Must complete within 3 seconds per Requirement 7.1.
   */
  async handleWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    // Validate the payload has the expected structure
    if (payload.object !== 'whatsapp_business_account') {
      return;
    }

    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messages = value?.messages;

    // Only process if there are actual messages (not status updates)
    if (!messages || messages.length === 0) {
      return;
    }

    // Process the first message in the payload
    const message = messages[0];

    // Only handle text messages for now
    if (!message.text?.body) {
      return;
    }

    // Check rate limit for this phone number (20 messages/min)
    const senderPhone = message.from;
    const rateLimitCheck = await checkWhatsAppRateLimit(senderPhone);

    if (!rateLimitCheck.allowed) {
      // Rate limit exceeded — send ONE notification on first rejection, then silently drop
      if (rateLimitCheck.shouldNotify) {
        await this.sendMessage(
          senderPhone,
          getRateLimitMessage(rateLimitCheck.retryAfter)
        );
      }
      return;
    }

    // Cancel any pending follow-up since customer is active
    await cancelFollowUp(senderPhone);

    // Deliver to Message Router as a raw channel message
    const rawMessage: RawChannelMessage = {
      channel: 'whatsapp',
      payload,
    };

    // Route through message router with timeout-based graceful degradation
    // If AI response takes >10s, sends predefined acknowledgment (Requirement 12.2)
    const timeoutResult = await handleWithTimeout(
      () => messageRouter.handleInbound(rawMessage),
      senderPhone
    );

    if (timeoutResult.success && timeoutResult.result) {
      // AI responded in time — send the response
      await this.sendMessage(timeoutResult.result.recipientId, timeoutResult.result.content);
    } else if (timeoutResult.timedOut) {
      // AI timed out — acknowledgment already sent by handleWithTimeout
      // Schedule a 24-hour follow-up for the potentially abandoned intake flow (Requirement 7.7)
      await scheduleFollowUp(senderPhone);
    }
  }

  /**
   * Sends a text message to a WhatsApp recipient via the Cloud API.
   *
   * Uses retry with exponential backoff (1s, 2s, 4s) for resilience.
   *
   * @param recipientPhone - The recipient's phone number (with country code)
   * @param content - The text message content to send
   */
  async sendMessage(recipientPhone: string, content: string): Promise<void> {
    const { apiToken, phoneNumberId } = this.getConfig();

    const url = `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: content,
      },
    };

    await retryExternalCall('whatsapp', async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `WhatsApp API error: ${response.status} - ${errorData}`
        );
      }
    });
  }

  /**
   * Sends a template message to a WhatsApp recipient.
   *
   * Template messages are pre-approved by Meta and used for notifications,
   * follow-ups, and other structured communications.
   *
   * @param recipientPhone - The recipient's phone number (with country code)
   * @param templateName - The approved template name
   * @param params - Key-value pairs for template parameter substitution
   */
  async sendTemplate(
    recipientPhone: string,
    templateName: string,
    params: Record<string, string>
  ): Promise<void> {
    const { apiToken, phoneNumberId } = this.getConfig();

    const url = `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`;

    // Build template components from params
    const components = this.buildTemplateComponents(params);

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en_US' },
        components,
      },
    };

    await retryExternalCall('whatsapp', async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `WhatsApp API error (template): ${response.status} - ${errorData}`
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Retrieves WhatsApp API configuration from environment variables.
   */
  private getConfig(): { apiToken: string; phoneNumberId: string } {
    const apiToken = process.env.WHATSAPP_API_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!apiToken || !phoneNumberId) {
      throw new Error(
        'WhatsApp API configuration missing: WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required'
      );
    }

    return { apiToken, phoneNumberId };
  }

  /**
   * Builds template components array from key-value params.
   * Parameters are passed as body components with positional text parameters.
   */
  private buildTemplateComponents(
    params: Record<string, string>
  ): Array<{ type: string; parameters: Array<{ type: string; text: string }> }> {
    const paramValues = Object.values(params);

    if (paramValues.length === 0) {
      return [];
    }

    return [
      {
        type: 'body',
        parameters: paramValues.map((text) => ({
          type: 'text',
          text,
        })),
      },
    ];
  }
}

// -----------------------------------------------------------------------------
// Singleton Export
// -----------------------------------------------------------------------------

const whatsappIntegration = new WhatsAppIntegrationImpl();

export { whatsappIntegration };
export type { WhatsAppIntegrationImpl };
