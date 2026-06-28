/**
 * WhatsApp Webhook Handler — API Route
 *
 * Handles two types of requests from the WhatsApp Business API:
 *
 * GET  — Webhook verification (challenge-response during setup)
 * POST — Inbound message delivery to Message Router
 *
 * Requirements: 7.1, 7.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { whatsappIntegration } from '@/integrations/whatsapp';
import { verifyMetaSignature } from '@/lib/webhook-verify';
import type { WhatsAppWebhookPayload } from '@/types';

// -----------------------------------------------------------------------------
// GET /api/webhooks/whatsapp — Webhook Verification
// -----------------------------------------------------------------------------

/**
 * WhatsApp webhook verification endpoint.
 *
 * Meta sends a GET request with query parameters:
 * - hub.mode: should be "subscribe"
 * - hub.verify_token: must match our configured WHATSAPP_WEBHOOK_VERIFY_TOKEN
 * - hub.challenge: an integer we must echo back to confirm ownership
 *
 * Returns the challenge value on success, or 403 on verification failure.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error('[WhatsApp Webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured');
    return NextResponse.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Webhook not configured' } },
      { status: 503 }
    );
  }

  // Verify the request matches expected parameters
  if (mode === 'subscribe' && token === verifyToken && challenge) {
    const sanitizedChallenge = challenge.replace(/[^a-zA-Z0-9_-]/g, "");
    return new NextResponse(sanitizedChallenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Verification failed
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Webhook verification failed' } },
    { status: 403 }
  );
}

// -----------------------------------------------------------------------------
// POST /api/webhooks/whatsapp — Inbound Message Handling
// -----------------------------------------------------------------------------

/**
 * Receives inbound WhatsApp messages and delivers them to the Message Router.
 *
 * The webhook payload is parsed and passed to the WhatsApp integration module
 * which normalizes and routes it to the AI Assistant. Delivery must complete
 * within 3 seconds (Requirement 7.1).
 *
 * Always returns 200 OK to Meta to acknowledge receipt (prevents retries).
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const appSecret = process.env.META_APP_SECRET;

    if (appSecret) {
      const signature = request.headers.get('x-hub-signature-256');
      if (!verifyMetaSignature(rawBody, signature, appSecret)) {
        console.error('[WhatsApp Webhook] Invalid signature');
        return NextResponse.json({ status: 'received' }, { status: 200 });
      }
    }

    const payload: WhatsAppWebhookPayload = JSON.parse(rawBody);
    await whatsappIntegration.handleWebhook(payload);

    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    console.error('[WhatsApp Webhook] Error processing message:', error);
    return NextResponse.json({ status: 'received' }, { status: 200 });
  }
}
