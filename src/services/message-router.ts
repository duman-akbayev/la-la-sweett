// =============================================================================
// La La Sweett Sales System — Message Router Implementation
// =============================================================================
//
// Normalizes inbound messages from WhatsApp, Instagram, and Chat Widget into
// a unified InboundMessage format. Routes normalized messages to the AI Assistant
// for processing and delivers responses back to the originating channel.
//
// Requirements: 7.1, 9.1, 6.2
// =============================================================================

import type {
  Channel,
  InboundMessage,
  OutboundMessage,
  AIResponse,
  WhatsAppWebhookPayload,
  InstagramDMPayload,
} from '@/types';

// -----------------------------------------------------------------------------
// Channel-specific raw message types
// -----------------------------------------------------------------------------

/** Raw message from Chat Widget (already fairly structured) */
export interface ChatWidgetRawMessage {
  sessionId: string;
  userId: string;
  userName?: string;
  text: string;
  sentAt: string | number;
}

/** Normalization input — raw payload from any channel */
export type RawChannelMessage =
  | { channel: 'whatsapp'; payload: WhatsAppWebhookPayload }
  | { channel: 'instagram'; payload: InstagramDMPayload }
  | { channel: 'chat_widget'; payload: ChatWidgetRawMessage };

// -----------------------------------------------------------------------------
// AI Assistant interface (stub — will be wired in task 9.2)
// -----------------------------------------------------------------------------

export interface AIAssistantStub {
  processMessage(message: InboundMessage): Promise<AIResponse>;
}

// -----------------------------------------------------------------------------
// Channel delivery interface (stubs — will be wired when integrations are ready)
// -----------------------------------------------------------------------------

export interface ChannelDeliveryAdapters {
  whatsapp?: {
    sendMessage(recipientId: string, content: string): Promise<void>;
  };
  instagram?: {
    sendDM(recipientId: string, content: string): Promise<void>;
  };
  chat_widget?: {
    sendMessage(recipientId: string, content: string): Promise<void>;
  };
}

// -----------------------------------------------------------------------------
// ID generation utility
// -----------------------------------------------------------------------------

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// -----------------------------------------------------------------------------
// Channel-specific normalization functions
// -----------------------------------------------------------------------------

/**
 * Normalize a WhatsApp webhook payload into an InboundMessage.
 * Extracts the first message from the webhook entry.
 */
export function normalizeWhatsApp(
  payload: WhatsAppWebhookPayload
): InboundMessage | null {
  const entry = payload.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message || !message.text?.body) {
    return null;
  }

  const contact = value?.contacts?.[0];
  const senderName = contact?.profile?.name;

  return {
    id: message.id || generateMessageId(),
    channel: 'whatsapp',
    senderId: message.from,
    senderName: senderName || undefined,
    content: message.text.body,
    timestamp: new Date(parseInt(message.timestamp, 10) * 1000),
    metadata: {
      whatsappMessageId: message.id,
      messageType: message.type,
      entryId: entry?.id,
    },
  };
}

/**
 * Normalize an Instagram DM webhook payload into an InboundMessage.
 * Extracts the first messaging event from the webhook entry.
 */
export function normalizeInstagram(
  payload: InstagramDMPayload
): InboundMessage | null {
  const entry = payload.entry?.[0];
  const messaging = entry?.messaging?.[0];

  if (!messaging || !messaging.message?.text) {
    return null;
  }

  return {
    id: messaging.message.mid || generateMessageId(),
    channel: 'instagram',
    senderId: messaging.sender.id,
    senderName: undefined,
    content: messaging.message.text,
    timestamp: new Date(messaging.timestamp),
    metadata: {
      instagramMessageId: messaging.message.mid,
      recipientId: messaging.recipient.id,
      entryId: entry?.id,
    },
  };
}

/**
 * Normalize a Chat Widget message into an InboundMessage.
 */
export function normalizeChatWidget(
  payload: ChatWidgetRawMessage
): InboundMessage | null {
  if (!payload.text || !payload.userId) {
    return null;
  }

  const timestamp =
    typeof payload.sentAt === 'string'
      ? new Date(payload.sentAt)
      : new Date(payload.sentAt);

  return {
    id: generateMessageId(),
    channel: 'chat_widget',
    senderId: payload.userId,
    senderName: payload.userName || undefined,
    content: payload.text,
    timestamp,
    metadata: {
      sessionId: payload.sessionId,
    },
  };
}

// -----------------------------------------------------------------------------
// Message Router Implementation
// -----------------------------------------------------------------------------

export class MessageRouterService {
  private aiAssistant: AIAssistantStub | null = null;
  private channelAdapters: ChannelDeliveryAdapters = {};

  /**
   * Register the AI Assistant for message processing.
   * This will be wired in task 9.2.
   */
  setAIAssistant(assistant: AIAssistantStub): void {
    this.aiAssistant = assistant;
  }

  /**
   * Register channel delivery adapters for outbound messages.
   */
  setChannelAdapters(adapters: ChannelDeliveryAdapters): void {
    this.channelAdapters = adapters;
  }

  /**
   * Handle an inbound raw message from any channel.
   * Normalizes the message and routes it to the AI Assistant.
   *
   * @returns The OutboundMessage response from the AI Assistant, or null if
   *          normalization failed or AI Assistant is not available.
   */
  async handleInbound(raw: RawChannelMessage): Promise<OutboundMessage | null> {
    // Normalize the raw message based on channel
    const normalized = this.normalize(raw);

    if (!normalized) {
      return null;
    }

    // Route to AI Assistant
    const response = await this.routeToAssistant(normalized);

    if (!response) {
      return null;
    }

    // Build outbound message for the originating channel
    const outbound: OutboundMessage = {
      channel: normalized.channel,
      recipientId: normalized.senderId,
      content: response.content,
      metadata: {
        inReplyTo: normalized.id,
        actions: response.actions,
      },
    };

    return outbound;
  }

  /**
   * Normalize a raw channel message into the unified InboundMessage format.
   */
  normalize(raw: RawChannelMessage): InboundMessage | null {
    switch (raw.channel) {
      case 'whatsapp':
        return normalizeWhatsApp(raw.payload);
      case 'instagram':
        return normalizeInstagram(raw.payload);
      case 'chat_widget':
        return normalizeChatWidget(raw.payload);
      default:
        return null;
    }
  }

  /**
   * Pass a normalized message to the AI Assistant for processing.
   * Returns the AI response or null if the assistant is not connected.
   */
  async routeToAssistant(
    message: InboundMessage
  ): Promise<AIResponse | null> {
    if (!this.aiAssistant) {
      return null;
    }

    return this.aiAssistant.processMessage(message);
  }

  /**
   * Deliver a response message back to the originating channel.
   * Uses the registered channel adapters for delivery.
   */
  async deliverResponse(message: OutboundMessage): Promise<void> {
    const adapter = this.channelAdapters[message.channel];

    if (!adapter) {
      throw new Error(
        `No delivery adapter registered for channel: ${message.channel}`
      );
    }

    switch (message.channel) {
      case 'whatsapp':
        await this.channelAdapters.whatsapp!.sendMessage(
          message.recipientId,
          message.content
        );
        break;
      case 'instagram':
        await this.channelAdapters.instagram!.sendDM(
          message.recipientId,
          message.content
        );
        break;
      case 'chat_widget':
        await this.channelAdapters.chat_widget!.sendMessage(
          message.recipientId,
          message.content
        );
        break;
    }
  }
}

// -----------------------------------------------------------------------------
// Singleton export for application-wide use
// -----------------------------------------------------------------------------

export const messageRouter = new MessageRouterService();
