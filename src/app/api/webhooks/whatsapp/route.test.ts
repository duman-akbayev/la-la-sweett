/**
 * Tests for WhatsApp Webhook Route Handler
 *
 * Validates: Requirements 7.1, 7.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';

// Mock the whatsapp integration module
vi.mock('@/integrations/whatsapp', () => ({
  whatsappIntegration: {
    handleWebhook: vi.fn().mockResolvedValue(undefined),
  },
}));

import { whatsappIntegration } from '@/integrations/whatsapp';

describe('WhatsApp Webhook Route', () => {
  beforeEach(() => {
    vi.stubEnv('WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'test-verify-token');
    vi.mocked(whatsappIntegration.handleWebhook).mockReset();
    vi.mocked(whatsappIntegration.handleWebhook).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('GET — Webhook Verification', () => {
    it('returns challenge when verification succeeds', async () => {
      const url = new URL(
        'http://localhost:3000/api/webhooks/whatsapp?' +
          'hub.mode=subscribe&' +
          'hub.verify_token=test-verify-token&' +
          'hub.challenge=1234567890'
      );
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toBe('1234567890');
    });

    it('returns 403 when verify token does not match', async () => {
      const url = new URL(
        'http://localhost:3000/api/webhooks/whatsapp?' +
          'hub.mode=subscribe&' +
          'hub.verify_token=wrong-token&' +
          'hub.challenge=1234567890'
      );
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 when hub.mode is not subscribe', async () => {
      const url = new URL(
        'http://localhost:3000/api/webhooks/whatsapp?' +
          'hub.mode=unsubscribe&' +
          'hub.verify_token=test-verify-token&' +
          'hub.challenge=1234567890'
      );
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('returns 503 when verify token env is not configured', async () => {
      vi.stubEnv('WHATSAPP_WEBHOOK_VERIFY_TOKEN', '');

      const url = new URL(
        'http://localhost:3000/api/webhooks/whatsapp?' +
          'hub.mode=subscribe&' +
          'hub.verify_token=test-verify-token&' +
          'hub.challenge=123'
      );
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(503);
      const json = await response.json();
      expect(json.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('returns 403 when query parameters are missing', async () => {
      const url = new URL('http://localhost:3000/api/webhooks/whatsapp');
      const request = new NextRequest(url);

      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('POST — Inbound Message Handling', () => {
    it('processes a valid webhook payload and returns 200', async () => {
      const payload = {
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
                      id: 'wamid.abc123',
                      timestamp: '1700000000',
                      type: 'text',
                      text: { body: 'Hi there!' },
                    },
                  ],
                  contacts: [
                    {
                      profile: { name: 'Customer' },
                      wa_id: '15551234567',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('received');
      expect(whatsappIntegration.handleWebhook).toHaveBeenCalledWith(payload);
    });

    it('returns 200 even when handleWebhook throws an error', async () => {
      vi.mocked(whatsappIntegration.handleWebhook).mockRejectedValue(
        new Error('Processing failed')
      );

      const payload = {
        object: 'whatsapp_business_account',
        entry: [],
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);

      // Must always return 200 to prevent Meta from retrying
      expect(response.status).toBe(200);
    });

    it('returns 200 for status update payloads (no messages)', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                field: 'messages',
                value: {
                  statuses: [
                    {
                      id: 'wamid.xyz',
                      status: 'delivered',
                      timestamp: '1700000001',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(whatsappIntegration.handleWebhook).toHaveBeenCalledWith(payload);
    });
  });
});
