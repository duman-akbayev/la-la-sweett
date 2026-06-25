// =============================================================================
// La La Sweett Sales System — Message Router Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MessageRouterService,
  normalizeWhatsApp,
  normalizeInstagram,
  normalizeChatWidget,
  type AIAssistantStub,
  type ChannelDeliveryAdapters,
  type ChatWidgetRawMessage,
  type RawChannelMessage,
} from './message-router';
import type {
  WhatsAppWebhookPayload,
  InstagramDMPayload,
  AIResponse,
  InboundMessage,
} from '@/types';

// -----------------------------------------------------------------------------
// Test fixtures
// -----------------------------------------------------------------------------

function createWhatsAppPayload(overrides?: Partial<{
  from: string;
  text: string;
  timestamp: string;
  name: string;
  messageId: string;
}>): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messages: [
                {
                  from: overrides?.from ?? '+15551234567',
                  id: overrides?.messageId ?? 'wamid.abc123',
                  timestamp: overrides?.timestamp ?? '1700000000',
                  type: 'text',
                  text: { body: overrides?.text ?? 'Hi, I want to order a cake' },
                },
              ],
              contacts: [
                {
                  profile: { name: overrides?.name ?? 'Jane Doe' },
                  wa_id: overrides?.from ?? '+15551234567',
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function createInstagramPayload(overrides?: Partial<{
  senderId: string;
  text: string;
  timestamp: number;
  mid: string;
}>): InstagramDMPayload {
  return {
    object: 'instagram',
    entry: [
      {
        id: 'ig-entry-1',
        messaging: [
          {
            sender: { id: overrides?.senderId ?? 'ig-user-123' },
            recipient: { id: 'ig-page-456' },
            timestamp: overrides?.timestamp ?? 1700000000000,
            message: {
              mid: overrides?.mid ?? 'mid.abc123',
              text: overrides?.text ?? 'How much for a birthday cake?',
            },
          },
        ],
      },
    ],
  };
}

function createChatWidgetPayload(overrides?: Partial<ChatWidgetRawMessage>): ChatWidgetRawMessage {
  return {
    sessionId: overrides?.sessionId ?? 'sess-abc',
    userId: overrides?.userId ?? 'user-789',
    userName: overrides?.userName ?? 'John Smith',
    text: overrides?.text ?? 'Do you deliver to downtown Austin?',
    sentAt: overrides?.sentAt ?? '2024-01-15T10:30:00Z',
  };
}

// -----------------------------------------------------------------------------
// Normalization tests
// -----------------------------------------------------------------------------

describe('Message Router — normalizeWhatsApp', () => {
  it('normalizes a valid WhatsApp text message', () => {
    const payload = createWhatsAppPayload();
    const result = normalizeWhatsApp(payload);

    expect(result).not.toBeNull();
    expect(result!.channel).toBe('whatsapp');
    expect(result!.senderId).toBe('+15551234567');
    expect(result!.senderName).toBe('Jane Doe');
    expect(result!.content).toBe('Hi, I want to order a cake');
    expect(result!.timestamp).toEqual(new Date(1700000000 * 1000));
    expect(result!.metadata).toMatchObject({
      whatsappMessageId: 'wamid.abc123',
      messageType: 'text',
      entryId: 'entry-1',
    });
  });

  it('returns null for payload with no messages', () => {
    const payload: WhatsAppWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {},
            },
          ],
        },
      ],
    };
    expect(normalizeWhatsApp(payload)).toBeNull();
  });

  it('returns null for payload with no text body', () => {
    const payload: WhatsAppWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    from: '+15551234567',
                    id: 'wamid.abc',
                    timestamp: '1700000000',
                    type: 'image',
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(normalizeWhatsApp(payload)).toBeNull();
  });

  it('handles missing contact name gracefully', () => {
    const payload: WhatsAppWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    from: '+15559999999',
                    id: 'wamid.xyz',
                    timestamp: '1700000000',
                    type: 'text',
                    text: { body: 'Hello' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const result = normalizeWhatsApp(payload);
    expect(result).not.toBeNull();
    expect(result!.senderName).toBeUndefined();
    expect(result!.content).toBe('Hello');
  });
});

describe('Message Router — normalizeInstagram', () => {
  it('normalizes a valid Instagram DM', () => {
    const payload = createInstagramPayload();
    const result = normalizeInstagram(payload);

    expect(result).not.toBeNull();
    expect(result!.channel).toBe('instagram');
    expect(result!.senderId).toBe('ig-user-123');
    expect(result!.content).toBe('How much for a birthday cake?');
    expect(result!.timestamp).toEqual(new Date(1700000000000));
    expect(result!.metadata).toMatchObject({
      instagramMessageId: 'mid.abc123',
      recipientId: 'ig-page-456',
      entryId: 'ig-entry-1',
    });
  });

  it('returns null for payload with no message text', () => {
    const payload: InstagramDMPayload = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-entry-1',
          messaging: [
            {
              sender: { id: 'ig-user-123' },
              recipient: { id: 'ig-page-456' },
              timestamp: 1700000000000,
            },
          ],
        },
      ],
    };
    expect(normalizeInstagram(payload)).toBeNull();
  });

  it('returns null for payload with empty messaging array', () => {
    const payload: InstagramDMPayload = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-entry-1',
          messaging: [],
        },
      ],
    };
    expect(normalizeInstagram(payload)).toBeNull();
  });
});

describe('Message Router — normalizeChatWidget', () => {
  it('normalizes a valid Chat Widget message', () => {
    const payload = createChatWidgetPayload();
    const result = normalizeChatWidget(payload);

    expect(result).not.toBeNull();
    expect(result!.channel).toBe('chat_widget');
    expect(result!.senderId).toBe('user-789');
    expect(result!.senderName).toBe('John Smith');
    expect(result!.content).toBe('Do you deliver to downtown Austin?');
    expect(result!.timestamp).toEqual(new Date('2024-01-15T10:30:00Z'));
    expect(result!.metadata).toMatchObject({
      sessionId: 'sess-abc',
    });
  });

  it('returns null for empty text', () => {
    const payload = createChatWidgetPayload({ text: '' });
    expect(normalizeChatWidget(payload)).toBeNull();
  });

  it('returns null for missing userId', () => {
    const payload = createChatWidgetPayload({ userId: '' });
    expect(normalizeChatWidget(payload)).toBeNull();
  });

  it('handles numeric timestamp', () => {
    const payload = createChatWidgetPayload({ sentAt: 1700000000000 });
    const result = normalizeChatWidget(payload);
    expect(result).not.toBeNull();
    expect(result!.timestamp).toEqual(new Date(1700000000000));
  });

  it('handles missing userName', () => {
    const payload: ChatWidgetRawMessage = {
      sessionId: 'sess-abc',
      userId: 'user-789',
      text: 'Hello there',
      sentAt: '2024-01-15T10:30:00Z',
    };
    const result = normalizeChatWidget(payload);
    expect(result).not.toBeNull();
    expect(result!.senderName).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// MessageRouterService tests
// -----------------------------------------------------------------------------

describe('MessageRouterService', () => {
  let router: MessageRouterService;
  let mockAI: AIAssistantStub;
  let mockAdapters: ChannelDeliveryAdapters;

  beforeEach(() => {
    router = new MessageRouterService();

    mockAI = {
      processMessage: vi.fn().mockResolvedValue({
        content: 'Hello! I can help you with that.',
        actions: [],
      } as AIResponse),
    };

    mockAdapters = {
      whatsapp: { sendMessage: vi.fn().mockResolvedValue(undefined) },
      instagram: { sendDM: vi.fn().mockResolvedValue(undefined) },
      chat_widget: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    };

    router.setAIAssistant(mockAI);
    router.setChannelAdapters(mockAdapters);
  });

  describe('handleInbound', () => {
    it('normalizes and routes a WhatsApp message to AI Assistant', async () => {
      const raw: RawChannelMessage = {
        channel: 'whatsapp',
        payload: createWhatsAppPayload(),
      };

      const result = await router.handleInbound(raw);

      expect(result).not.toBeNull();
      expect(result!.channel).toBe('whatsapp');
      expect(result!.recipientId).toBe('+15551234567');
      expect(result!.content).toBe('Hello! I can help you with that.');
      expect(mockAI.processMessage).toHaveBeenCalledTimes(1);

      const calledWith = (mockAI.processMessage as ReturnType<typeof vi.fn>).mock.calls[0][0] as InboundMessage;
      expect(calledWith.channel).toBe('whatsapp');
      expect(calledWith.content).toBe('Hi, I want to order a cake');
    });

    it('normalizes and routes an Instagram DM to AI Assistant', async () => {
      const raw: RawChannelMessage = {
        channel: 'instagram',
        payload: createInstagramPayload(),
      };

      const result = await router.handleInbound(raw);

      expect(result).not.toBeNull();
      expect(result!.channel).toBe('instagram');
      expect(result!.recipientId).toBe('ig-user-123');
      expect(result!.content).toBe('Hello! I can help you with that.');
    });

    it('normalizes and routes a Chat Widget message to AI Assistant', async () => {
      const raw: RawChannelMessage = {
        channel: 'chat_widget',
        payload: createChatWidgetPayload(),
      };

      const result = await router.handleInbound(raw);

      expect(result).not.toBeNull();
      expect(result!.channel).toBe('chat_widget');
      expect(result!.recipientId).toBe('user-789');
      expect(result!.content).toBe('Hello! I can help you with that.');
    });

    it('returns null when normalization fails', async () => {
      const raw: RawChannelMessage = {
        channel: 'chat_widget',
        payload: createChatWidgetPayload({ text: '' }),
      };

      const result = await router.handleInbound(raw);
      expect(result).toBeNull();
      expect(mockAI.processMessage).not.toHaveBeenCalled();
    });

    it('returns null when AI Assistant is not connected', async () => {
      const routerNoAI = new MessageRouterService();
      const raw: RawChannelMessage = {
        channel: 'whatsapp',
        payload: createWhatsAppPayload(),
      };

      const result = await routerNoAI.handleInbound(raw);
      expect(result).toBeNull();
    });
  });

  describe('deliverResponse', () => {
    it('delivers to WhatsApp via the whatsapp adapter', async () => {
      await router.deliverResponse({
        channel: 'whatsapp',
        recipientId: '+15551234567',
        content: 'Your cake will be ready next week!',
      });

      expect(mockAdapters.whatsapp!.sendMessage).toHaveBeenCalledWith(
        '+15551234567',
        'Your cake will be ready next week!'
      );
    });

    it('delivers to Instagram via the instagram adapter', async () => {
      await router.deliverResponse({
        channel: 'instagram',
        recipientId: 'ig-user-123',
        content: 'Thanks for your interest!',
      });

      expect(mockAdapters.instagram!.sendDM).toHaveBeenCalledWith(
        'ig-user-123',
        'Thanks for your interest!'
      );
    });

    it('delivers to Chat Widget via the chat_widget adapter', async () => {
      await router.deliverResponse({
        channel: 'chat_widget',
        recipientId: 'user-789',
        content: 'Yes, we deliver downtown!',
      });

      expect(mockAdapters.chat_widget!.sendMessage).toHaveBeenCalledWith(
        'user-789',
        'Yes, we deliver downtown!'
      );
    });

    it('throws when no adapter is registered for the channel', async () => {
      const routerNoAdapters = new MessageRouterService();

      await expect(
        routerNoAdapters.deliverResponse({
          channel: 'whatsapp',
          recipientId: '+15551234567',
          content: 'Hello',
        })
      ).rejects.toThrow('No delivery adapter registered for channel: whatsapp');
    });
  });

  describe('normalize', () => {
    it('delegates to normalizeWhatsApp for whatsapp channel', () => {
      const raw: RawChannelMessage = {
        channel: 'whatsapp',
        payload: createWhatsAppPayload({ text: 'Test WA' }),
      };
      const result = router.normalize(raw);
      expect(result).not.toBeNull();
      expect(result!.channel).toBe('whatsapp');
      expect(result!.content).toBe('Test WA');
    });

    it('delegates to normalizeInstagram for instagram channel', () => {
      const raw: RawChannelMessage = {
        channel: 'instagram',
        payload: createInstagramPayload({ text: 'Test IG' }),
      };
      const result = router.normalize(raw);
      expect(result).not.toBeNull();
      expect(result!.channel).toBe('instagram');
      expect(result!.content).toBe('Test IG');
    });

    it('delegates to normalizeChatWidget for chat_widget channel', () => {
      const raw: RawChannelMessage = {
        channel: 'chat_widget',
        payload: createChatWidgetPayload({ text: 'Test CW' }),
      };
      const result = router.normalize(raw);
      expect(result).not.toBeNull();
      expect(result!.channel).toBe('chat_widget');
      expect(result!.content).toBe('Test CW');
    });
  });

  describe('routeToAssistant', () => {
    it('passes the message to the AI Assistant and returns the response', async () => {
      const message: InboundMessage = {
        id: 'msg-1',
        channel: 'whatsapp',
        senderId: '+15551234567',
        content: 'What flavors do you have?',
        timestamp: new Date(),
        metadata: {},
      };

      const response = await router.routeToAssistant(message);

      expect(response).not.toBeNull();
      expect(response!.content).toBe('Hello! I can help you with that.');
      expect(mockAI.processMessage).toHaveBeenCalledWith(message);
    });

    it('returns null when AI Assistant is not set', async () => {
      const routerNoAI = new MessageRouterService();
      const message: InboundMessage = {
        id: 'msg-1',
        channel: 'whatsapp',
        senderId: '+15551234567',
        content: 'Hello',
        timestamp: new Date(),
        metadata: {},
      };

      const response = await routerNoAI.routeToAssistant(message);
      expect(response).toBeNull();
    });
  });
});
