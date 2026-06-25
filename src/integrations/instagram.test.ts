/**
 * Tests for Instagram DM Integration
 *
 * Validates: Requirements 9.1, 9.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { instagramIntegration, hasCakeKeywords, CAKE_KEYWORDS } from './instagram';
import { messageRouter } from '@/services/message-router';
import type { InstagramDMPayload, OutboundMessage } from '@/types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock the message router
vi.mock('@/services/message-router', () => ({
  messageRouter: {
    handleInbound: vi.fn(),
  },
}));

// Mock the retry module to avoid actual delays
vi.mock('@/lib/retry', () => ({
  retryExternalCall: vi.fn((_api: string, fn: () => Promise<unknown>) => fn()),
}));

describe('Instagram Integration', () => {
  beforeEach(() => {
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'test-ig-token');
    vi.stubEnv('INSTAGRAM_PAGE_ID', 'ig-page-123');
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"message_id":"mid.123"}'),
    });
    vi.mocked(messageRouter.handleInbound).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('hasCakeKeywords', () => {
    it('returns true when text contains a cake keyword', () => {
      expect(hasCakeKeywords('I want to order a cake')).toBe(true);
      expect(hasCakeKeywords('What is the price?')).toBe(true);
      expect(hasCakeKeywords('I need a custom design')).toBe(true);
      expect(hasCakeKeywords('Planning a birthday party')).toBe(true);
      expect(hasCakeKeywords('Need cupcakes for wedding')).toBe(true);
    });

    it('returns true for case-insensitive matches', () => {
      expect(hasCakeKeywords('I want to ORDER a CAKE')).toBe(true);
      expect(hasCakeKeywords('BIRTHDAY celebration')).toBe(true);
      expect(hasCakeKeywords('Wedding Dessert ideas')).toBe(true);
    });

    it('returns false when text contains no keywords', () => {
      expect(hasCakeKeywords('Hello there!')).toBe(false);
      expect(hasCakeKeywords('How are you doing?')).toBe(false);
      expect(hasCakeKeywords('Nice photos!')).toBe(false);
    });

    it('returns false for empty or falsy text', () => {
      expect(hasCakeKeywords('')).toBe(false);
      expect(hasCakeKeywords(null as unknown as string)).toBe(false);
      expect(hasCakeKeywords(undefined as unknown as string)).toBe(false);
    });

    it('matches all defined cake keywords', () => {
      for (const keyword of CAKE_KEYWORDS) {
        expect(hasCakeKeywords(`I need ${keyword} info`)).toBe(true);
      }
    });
  });

  describe('handleDMWebhook', () => {
    function createDMPayload(
      overrides?: Partial<{
        senderId: string;
        recipientId: string;
        text: string;
        object: string;
        mid: string;
        timestamp: number;
      }>
    ): InstagramDMPayload {
      return {
        object: overrides?.object ?? 'instagram',
        entry: [
          {
            id: 'entry-1',
            messaging: [
              {
                sender: { id: overrides?.senderId ?? 'user-123' },
                recipient: { id: overrides?.recipientId ?? 'page-456' },
                timestamp: overrides?.timestamp ?? 1700000000000,
                message: {
                  mid: overrides?.mid ?? 'mid.abc123',
                  text: overrides?.text ?? 'I want to order a cake for my birthday!',
                },
              },
            ],
          },
        ],
      };
    }

    it('delivers inbound DMs to the message router', async () => {
      vi.mocked(messageRouter.handleInbound).mockResolvedValue(null);

      const payload = createDMPayload();
      await instagramIntegration.handleDMWebhook(payload);

      expect(messageRouter.handleInbound).toHaveBeenCalledWith({
        channel: 'instagram',
        payload,
      });
    });

    it('routes DMs with cake keywords to AI_Assistant via message router', async () => {
      vi.mocked(messageRouter.handleInbound).mockResolvedValue(null);

      const payload = createDMPayload({ text: 'What is the price for a wedding cake?' });
      await instagramIntegration.handleDMWebhook(payload);

      expect(messageRouter.handleInbound).toHaveBeenCalledWith({
        channel: 'instagram',
        payload,
      });
    });

    it('routes DMs without keywords to AI_Assistant for greeting response', async () => {
      vi.mocked(messageRouter.handleInbound).mockResolvedValue(null);

      const payload = createDMPayload({ text: 'Hey! Love your feed!' });
      await instagramIntegration.handleDMWebhook(payload);

      // Non-keyword DMs are still routed to AI_Assistant
      expect(messageRouter.handleInbound).toHaveBeenCalledWith({
        channel: 'instagram',
        payload,
      });
    });

    it('sends response back when message router returns an outbound message', async () => {
      const outbound: OutboundMessage = {
        channel: 'instagram',
        recipientId: 'user-123',
        content: 'Hi! 🎂 Thanks for reaching out! How can I help with your cake order?',
      };
      vi.mocked(messageRouter.handleInbound).mockResolvedValue(outbound);

      const payload = createDMPayload();
      await instagramIntegration.handleDMWebhook(payload);

      // Should call Instagram API to send DM reply
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/ig-page-123/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-ig-token',
          }),
        })
      );

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.recipient.id).toBe('user-123');
      expect(body.message.text).toBe(
        'Hi! 🎂 Thanks for reaching out! How can I help with your cake order?'
      );
    });

    it('ignores payloads with non-instagram object', async () => {
      const payload = createDMPayload({ object: 'page' });

      await instagramIntegration.handleDMWebhook(payload);

      expect(messageRouter.handleInbound).not.toHaveBeenCalled();
    });

    it('ignores payloads without message text', async () => {
      const payload: InstagramDMPayload = {
        object: 'instagram',
        entry: [
          {
            id: 'entry-1',
            messaging: [
              {
                sender: { id: 'user-123' },
                recipient: { id: 'page-456' },
                timestamp: 1700000000000,
                // No message property
              },
            ],
          },
        ],
      };

      await instagramIntegration.handleDMWebhook(payload);

      expect(messageRouter.handleInbound).not.toHaveBeenCalled();
    });

    it('ignores payloads with empty messaging array', async () => {
      const payload: InstagramDMPayload = {
        object: 'instagram',
        entry: [
          {
            id: 'entry-1',
            messaging: [],
          },
        ],
      };

      await instagramIntegration.handleDMWebhook(payload);

      expect(messageRouter.handleInbound).not.toHaveBeenCalled();
    });

    it('does not send a response when message router returns null', async () => {
      vi.mocked(messageRouter.handleInbound).mockResolvedValue(null);

      const payload = createDMPayload();
      await instagramIntegration.handleDMWebhook(payload);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('sendDM', () => {
    it('sends a DM via Instagram Graph API', async () => {
      await instagramIntegration.sendDM('user-789', 'Your cake is ready for pickup!');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/ig-page-123/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-ig-token',
          },
        })
      );

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body).toEqual({
        recipient: { id: 'user-789' },
        message: { text: 'Your cake is ready for pickup!' },
      });
    });

    it('throws when access token is not configured', async () => {
      vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', '');

      await expect(
        instagramIntegration.sendDM('user-789', 'Hello')
      ).rejects.toThrow('Instagram API configuration missing');
    });

    it('throws when page ID is not configured', async () => {
      vi.stubEnv('INSTAGRAM_PAGE_ID', '');

      await expect(
        instagramIntegration.sendDM('user-789', 'Hello')
      ).rejects.toThrow('Instagram API configuration missing');
    });

    it('throws when Instagram API returns an error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"error":{"message":"Invalid recipient"}}'),
      });

      await expect(
        instagramIntegration.sendDM('invalid', 'Hello')
      ).rejects.toThrow('Instagram API error: 400');
    });
  });
});
