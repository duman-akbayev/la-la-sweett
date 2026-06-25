/**
 * Tests for Instagram Comment Auto-Reply
 *
 * Validates: Requirement 9.2
 * - Purchase-intent keyword detection as case-insensitive whole words
 * - Auto-reply to comments containing purchase-intent keywords
 * - No reply when no purchase-intent keywords are found
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hasPurchaseIntent,
  PURCHASE_INTENT_KEYWORDS,
  COMMENT_AUTO_REPLY_MESSAGE,
  instagramIntegration,
} from './instagram';
import type { InstagramCommentPayload } from '@/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the retry module to skip delays
vi.mock('@/lib/retry', () => ({
  retryExternalCall: vi.fn(async (_apiName: string, fn: () => Promise<unknown>) => fn()),
}));

// Mock message-router (not used for comments but needed for module import)
vi.mock('@/services/message-router', () => ({
  messageRouter: {
    handleInbound: vi.fn(),
  },
}));

describe('Instagram Comment Auto-Reply', () => {
  beforeEach(() => {
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'test-token');
    vi.stubEnv('INSTAGRAM_PAGE_ID', 'page-123');
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ---------------------------------------------------------------------------
  // hasPurchaseIntent — Keyword Detection
  // ---------------------------------------------------------------------------

  describe('hasPurchaseIntent', () => {
    it('returns false for empty/null text', () => {
      expect(hasPurchaseIntent('')).toBe(false);
      expect(hasPurchaseIntent(null as unknown as string)).toBe(false);
      expect(hasPurchaseIntent(undefined as unknown as string)).toBe(false);
    });

    it('detects "order" as a whole word (case-insensitive)', () => {
      expect(hasPurchaseIntent('I want to order a cake')).toBe(true);
      expect(hasPurchaseIntent('ORDER please!')).toBe(true);
      expect(hasPurchaseIntent('Order')).toBe(true);
    });

    it('detects "price" as a whole word (case-insensitive)', () => {
      expect(hasPurchaseIntent('What is the price?')).toBe(true);
      expect(hasPurchaseIntent('PRICE check')).toBe(true);
      expect(hasPurchaseIntent('price')).toBe(true);
    });

    it('detects "how much" as a whole phrase (case-insensitive)', () => {
      expect(hasPurchaseIntent('How much does this cost?')).toBe(true);
      expect(hasPurchaseIntent('HOW MUCH is it?')).toBe(true);
      expect(hasPurchaseIntent('how much')).toBe(true);
    });

    it('detects "available" as a whole word (case-insensitive)', () => {
      expect(hasPurchaseIntent('Is this available?')).toBe(true);
      expect(hasPurchaseIntent('AVAILABLE for next week?')).toBe(true);
    });

    it('detects "book" as a whole word (case-insensitive)', () => {
      expect(hasPurchaseIntent('I want to book this')).toBe(true);
      expect(hasPurchaseIntent('Can I BOOK?')).toBe(true);
    });

    it('does NOT match keywords embedded in other words', () => {
      // "order" inside "disorder" or "reorder" — but "reorder" contains "order" at a word boundary
      // Testing truly embedded cases
      expect(hasPurchaseIntent('What a disorder!')).toBe(false);
      expect(hasPurchaseIntent('The booklet is nice')).toBe(false);
      expect(hasPurchaseIntent('She is priceless')).toBe(false);
      expect(hasPurchaseIntent('unavailable today')).toBe(false);
    });

    it('does NOT trigger on unrelated text', () => {
      expect(hasPurchaseIntent('This cake looks beautiful!')).toBe(false);
      expect(hasPurchaseIntent('Wow, amazing design')).toBe(false);
      expect(hasPurchaseIntent('Love this! 💕')).toBe(false);
      expect(hasPurchaseIntent('Happy birthday!')).toBe(false);
    });

    it('handles keywords with punctuation adjacent', () => {
      expect(hasPurchaseIntent('price?')).toBe(true);
      expect(hasPurchaseIntent('order!')).toBe(true);
      expect(hasPurchaseIntent('(available)')).toBe(true);
      expect(hasPurchaseIntent('book.')).toBe(true);
    });

    it('detects keywords at the start/end of text', () => {
      expect(hasPurchaseIntent('Order now')).toBe(true);
      expect(hasPurchaseIntent('I want to book')).toBe(true);
      expect(hasPurchaseIntent('price')).toBe(true);
    });

    it('handles multiple keywords in the same text', () => {
      expect(hasPurchaseIntent('What is the price and how much for delivery?')).toBe(true);
      expect(hasPurchaseIntent('order available book')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // handleCommentWebhook — Comment Processing
  // ---------------------------------------------------------------------------

  describe('handleCommentWebhook', () => {
    function createCommentPayload(text: string, commentId = 'comment-123'): InstagramCommentPayload {
      return {
        object: 'instagram',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                field: 'comments',
                value: {
                  id: commentId,
                  text,
                  from: { id: 'user-456', username: 'customer1' },
                  media: { id: 'media-789' },
                },
              },
            ],
          },
        ],
      };
    }

    it('auto-replies when comment contains purchase-intent keyword "order"', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const payload = createCommentPayload('I want to order this!');

      await instagramIntegration.handleCommentWebhook(payload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('comment-123/replies');
      expect(JSON.parse(options.body).message).toBe(COMMENT_AUTO_REPLY_MESSAGE);
    });

    it('auto-replies when comment contains "how much"', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const payload = createCommentPayload('How much is this cake?');

      await instagramIntegration.handleCommentWebhook(payload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('auto-replies when comment contains "price"', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const payload = createCommentPayload('What price?');

      await instagramIntegration.handleCommentWebhook(payload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('auto-replies when comment contains "available"', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const payload = createCommentPayload('Is this available for Saturday?');

      await instagramIntegration.handleCommentWebhook(payload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('auto-replies when comment contains "book"', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const payload = createCommentPayload('Can I book this for next week?');

      await instagramIntegration.handleCommentWebhook(payload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT reply when comment has no purchase-intent keywords', async () => {
      const payload = createCommentPayload('Beautiful cake! Love the design 💕');

      await instagramIntegration.handleCommentWebhook(payload);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('ignores payloads that are not from instagram', async () => {
      const payload: InstagramCommentPayload = {
        object: 'page',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                field: 'comments',
                value: {
                  id: 'comment-123',
                  text: 'I want to order',
                  from: { id: 'user-456', username: 'customer1' },
                  media: { id: 'media-789' },
                },
              },
            ],
          },
        ],
      };

      await instagramIntegration.handleCommentWebhook(payload);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('ignores payloads with non-comment field changes', async () => {
      const payload: InstagramCommentPayload = {
        object: 'instagram',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                field: 'feed',
                value: {
                  id: 'comment-123',
                  text: 'I want to order',
                  from: { id: 'user-456', username: 'customer1' },
                  media: { id: 'media-789' },
                },
              },
            ],
          },
        ],
      };

      await instagramIntegration.handleCommentWebhook(payload);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('ignores payloads with missing comment text', async () => {
      const payload: InstagramCommentPayload = {
        object: 'instagram',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                field: 'comments',
                value: {
                  id: 'comment-123',
                  text: '',
                  from: { id: 'user-456', username: 'customer1' },
                  media: { id: 'media-789' },
                },
              },
            ],
          },
        ],
      };

      await instagramIntegration.handleCommentWebhook(payload);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles case-insensitive keyword matching in comments', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const payload = createCommentPayload('PRICE please');

      await instagramIntegration.handleCommentWebhook(payload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // replyToComment — Graph API Reply
  // ---------------------------------------------------------------------------

  describe('replyToComment', () => {
    it('calls the Graph API with correct URL and body', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await instagramIntegration.replyToComment('comment-abc', 'Hello!');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://graph.facebook.com/v18.0/comment-abc/replies');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer test-token');
      expect(JSON.parse(options.body)).toEqual({ message: 'Hello!' });
    });

    it('throws on API error (retry exhausted)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(
        instagramIntegration.replyToComment('comment-abc', 'Hello!')
      ).rejects.toThrow('Instagram API error: 500');
    });
  });

  // ---------------------------------------------------------------------------
  // PURCHASE_INTENT_KEYWORDS constant
  // ---------------------------------------------------------------------------

  describe('PURCHASE_INTENT_KEYWORDS', () => {
    it('contains exactly the required keywords', () => {
      expect(PURCHASE_INTENT_KEYWORDS).toEqual([
        'order',
        'price',
        'how much',
        'available',
        'book',
      ]);
    });
  });
});
