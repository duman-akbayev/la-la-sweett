/**
 * Tests for WhatsApp Business API Integration
 *
 * Validates: Requirements 7.1, 7.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { whatsappIntegration } from './whatsapp';
import { messageRouter } from '@/services/message-router';
import type { WhatsAppWebhookPayload, OutboundMessage } from '@/types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock the message router
vi.mock('@/services/message-router', () => ({
  messageRouter: {
    handleInbound: vi.fn(),
  },
}));

// Mock the rate limiter to avoid real Redis connections
vi.mock('@/integrations/whatsapp-rate-limit', () => ({
  checkWhatsAppRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    shouldNotify: false,
  }),
  getRateLimitMessage: vi.fn().mockReturnValue('Rate limit reached. Please wait 60 seconds.'),
}));

// Mock the degradation module to avoid real Redis connections
vi.mock('@/integrations/whatsapp-degradation', () => ({
  handleWithTimeout: vi.fn(async (fn: () => Promise<unknown>, _phone: string) => {
    const result = await fn();
    return { success: true, timedOut: false, result };
  }),
  scheduleFollowUp: vi.fn().mockResolvedValue(undefined),
  cancelFollowUp: vi.fn().mockResolvedValue(undefined),
}));

// Mock the retry module to avoid actual delays
vi.mock('@/lib/retry', () => ({
  retryExternalCall: vi.fn((_api: string, fn: () => Promise<unknown>) => fn()),
}));

describe('WhatsApp Integration', () => {
  beforeEach(() => {
    vi.stubEnv('WHATSAPP_API_TOKEN', 'test-whatsapp-token');
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456789');
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"messages":[{"id":"wamid.123"}]}'),
    });
    vi.mocked(messageRouter.handleInbound).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('handleWebhook', () => {
    function createWebhookPayload(
      overrides?: Partial<{
        from: string;
        body: string;
        name: string;
        object: string;
      }>
    ): WhatsAppWebhookPayload {
      return {
        object: overrides?.object ?? 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    {
                      from: overrides?.from ?? '15551234567',
                      id: 'wamid.abc123',
                      timestamp: '1700000000',
                      type: 'text',
                      text: { body: overrides?.body ?? 'Hello, I want to order a cake!' },
                    },
                  ],
                  contacts: [
                    {
                      profile: { name: overrides?.name ?? 'Jane Doe' },
                      wa_id: overrides?.from ?? '15551234567',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
    }

    it('delivers inbound messages to the message router', async () => {
      vi.mocked(messageRouter.handleInbound).mockResolvedValue(null);

      const payload = createWebhookPayload();
      await whatsappIntegration.handleWebhook(payload);

      expect(messageRouter.handleInbound).toHaveBeenCalledWith({
        channel: 'whatsapp',
        payload,
      });
    });

    it('sends response back when message router returns an outbound message', async () => {
      const outbound: OutboundMessage = {
        channel: 'whatsapp',
        recipientId: '15551234567',
        content: 'Hi Jane! We would love to help you with your cake order! 🎂',
      };
      vi.mocked(messageRouter.handleInbound).mockResolvedValue(outbound);

      const payload = createWebhookPayload();
      await whatsappIntegration.handleWebhook(payload);

      // Should call WhatsApp API to send reply
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/123456789/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-whatsapp-token',
          }),
        })
      );

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.to).toBe('15551234567');
      expect(body.text.body).toBe(
        'Hi Jane! We would love to help you with your cake order! 🎂'
      );
    });

    it('ignores payloads with non-whatsapp_business_account object', async () => {
      const payload = createWebhookPayload({ object: 'page' });
      (payload as any).object = 'page';

      await whatsappIntegration.handleWebhook(payload);

      expect(messageRouter.handleInbound).not.toHaveBeenCalled();
    });

    it('ignores payloads without messages (status updates)', async () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                field: 'messages',
                value: {
                  // No messages array — this is a status update
                },
              },
            ],
          },
        ],
      };

      await whatsappIntegration.handleWebhook(payload);

      expect(messageRouter.handleInbound).not.toHaveBeenCalled();
    });

    it('ignores non-text messages (images, audio, etc.)', async () => {
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
                      from: '15551234567',
                      id: 'wamid.img123',
                      timestamp: '1700000000',
                      type: 'image',
                      // No text property
                    },
                  ],
                  contacts: [
                    {
                      profile: { name: 'Jane Doe' },
                      wa_id: '15551234567',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      await whatsappIntegration.handleWebhook(payload);

      expect(messageRouter.handleInbound).not.toHaveBeenCalled();
    });

    it('does not send a response when message router returns null', async () => {
      vi.mocked(messageRouter.handleInbound).mockResolvedValue(null);

      const payload = createWebhookPayload();
      await whatsappIntegration.handleWebhook(payload);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('sends a text message via WhatsApp Cloud API', async () => {
      await whatsappIntegration.sendMessage('15559876543', 'Your cake is ready!');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/123456789/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-whatsapp-token',
          },
        })
      );

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body).toEqual({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '15559876543',
        type: 'text',
        text: {
          preview_url: false,
          body: 'Your cake is ready!',
        },
      });
    });

    it('throws when API token is not configured', async () => {
      vi.stubEnv('WHATSAPP_API_TOKEN', '');

      await expect(
        whatsappIntegration.sendMessage('15559876543', 'Hello')
      ).rejects.toThrow('WhatsApp API configuration missing');
    });

    it('throws when phone number ID is not configured', async () => {
      vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '');

      await expect(
        whatsappIntegration.sendMessage('15559876543', 'Hello')
      ).rejects.toThrow('WhatsApp API configuration missing');
    });

    it('throws when WhatsApp API returns an error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error":{"message":"Invalid recipient"}}'),
      });

      await expect(
        whatsappIntegration.sendMessage('invalid', 'Hello')
      ).rejects.toThrow('WhatsApp API error: 400');
    });
  });

  describe('sendTemplate', () => {
    it('sends a template message with parameters', async () => {
      await whatsappIntegration.sendTemplate('15559876543', 'order_confirmation', {
        customer_name: 'Jane',
        order_id: 'ORD-123',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/123456789/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-whatsapp-token',
          },
        })
      );

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body).toEqual({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '15559876543',
        type: 'template',
        template: {
          name: 'order_confirmation',
          language: { code: 'en_US' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Jane' },
                { type: 'text', text: 'ORD-123' },
              ],
            },
          ],
        },
      });
    });

    it('sends a template message without parameters', async () => {
      await whatsappIntegration.sendTemplate('15559876543', 'welcome_message', {});

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.template.components).toEqual([]);
    });

    it('throws when WhatsApp API returns an error for templates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () =>
          Promise.resolve('{"error":{"message":"Template not found"}}'),
      });

      await expect(
        whatsappIntegration.sendTemplate('15559876543', 'nonexistent', {})
      ).rejects.toThrow('WhatsApp API error (template): 404');
    });
  });
});
