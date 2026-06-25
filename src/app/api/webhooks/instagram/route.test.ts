/**
 * Tests for Instagram Webhook API Route
 *
 * Validates: Requirements 9.1, 9.2, 9.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import type { InstagramDMPayload, InstagramCommentPayload } from '@/types';

// Mock the instagram integration
vi.mock('@/integrations/instagram', () => ({
  instagramIntegration: {
    handleDMWebhook: vi.fn(),
    handleCommentWebhook: vi.fn(),
  },
}));

import { instagramIntegration } from '@/integrations/instagram';

describe('Instagram Webhook Route', () => {
  beforeEach(() => {
    vi.stubEnv('INSTAGRAM_WEBHOOK_VERIFY_TOKEN', 'test-verify-token');
    vi.mocked(instagramIntegration.handleDMWebhook).mockReset();
    vi.mocked(instagramIntegration.handleDMWebhook).mockResolvedValue(undefined);
    vi.mocked(instagramIntegration.handleCommentWebhook).mockReset();
    vi.mocked(instagramIntegration.handleCommentWebhook).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('GET — Webhook Verification', () => {
    it('returns challenge when verification succeeds', async () => {
      const url = new URL(
        'http://localhost:3000/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=12345'
      );
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('12345');
    });

    it('returns 403 when verify token does not match', async () => {
      const url = new URL(
        'http://localhost:3000/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=12345'
      );
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 when mode is not subscribe', async () => {
      const url = new URL(
        'http://localhost:3000/api/webhooks/instagram?hub.mode=unsubscribe&hub.verify_token=test-verify-token&hub.challenge=12345'
      );
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('returns 503 when verify token env var is not configured', async () => {
      vi.stubEnv('INSTAGRAM_WEBHOOK_VERIFY_TOKEN', '');

      const url = new URL(
        'http://localhost:3000/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=12345'
      );
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(503);
      const json = await response.json();
      expect(json.error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('POST — Inbound DM Handling', () => {
    function createDMPayload(): InstagramDMPayload {
      return {
        object: 'instagram',
        entry: [
          {
            id: 'entry-1',
            messaging: [
              {
                sender: { id: 'user-123' },
                recipient: { id: 'page-456' },
                timestamp: 1700000000000,
                message: {
                  mid: 'mid.abc123',
                  text: 'I want to order a birthday cake!',
                },
              },
            ],
          },
        ],
      };
    }

    it('returns 200 and processes the DM payload', async () => {
      const payload = createDMPayload();
      const request = new NextRequest('http://localhost:3000/api/webhooks/instagram', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('received');
      expect(instagramIntegration.handleDMWebhook).toHaveBeenCalledWith(payload);
    });

    it('returns 200 even when handler throws an error', async () => {
      vi.mocked(instagramIntegration.handleDMWebhook).mockRejectedValue(
        new Error('Processing failed')
      );

      const payload = createDMPayload();
      const request = new NextRequest('http://localhost:3000/api/webhooks/instagram', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      // Always return 200 to prevent Meta retries
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('received');
    });
  });

  describe('POST — Comment Webhook Handling', () => {
    function createCommentPayload(): InstagramCommentPayload {
      return {
        object: 'instagram',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                field: 'comments',
                value: {
                  id: 'comment-123',
                  text: 'How much is this cake?',
                  from: { id: 'user-789', username: 'customer2' },
                  media: { id: 'media-456' },
                },
              },
            ],
          },
        ],
      };
    }

    it('returns 200 and routes comment payload to handleCommentWebhook', async () => {
      const payload = createCommentPayload();
      const request = new NextRequest('http://localhost:3000/api/webhooks/instagram', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('received');
      expect(instagramIntegration.handleCommentWebhook).toHaveBeenCalledWith(payload);
      expect(instagramIntegration.handleDMWebhook).not.toHaveBeenCalled();
    });

    it('returns 200 even when comment handler throws', async () => {
      vi.mocked(instagramIntegration.handleCommentWebhook).mockRejectedValue(
        new Error('Comment processing failed')
      );

      const payload = createCommentPayload();
      const request = new NextRequest('http://localhost:3000/api/webhooks/instagram', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('received');
    });
  });
});
