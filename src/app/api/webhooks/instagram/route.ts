/**
 * Instagram Webhook Handler — API Route
 *
 * Handles two types of requests from the Meta/Instagram API:
 *
 * GET  — Webhook verification (challenge-response during setup)
 * POST — Inbound DM and comment delivery via Instagram integration
 *
 * Requirements: 9.1, 9.2, 9.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { instagramIntegration } from '@/integrations/instagram';
import { verifyMetaSignature } from '@/lib/webhook-verify';
import type { InstagramDMPayload, InstagramCommentPayload } from '@/types';

// -----------------------------------------------------------------------------
// GET /api/webhooks/instagram — Webhook Verification
// -----------------------------------------------------------------------------

/**
 * Instagram webhook verification endpoint.
 *
 * Meta sends a GET request with query parameters:
 * - hub.mode: should be "subscribe"
 * - hub.verify_token: must match our configured INSTAGRAM_WEBHOOK_VERIFY_TOKEN
 * - hub.challenge: an integer we must echo back to confirm ownership
 *
 * Returns the challenge value on success, or 403 on verification failure.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error('[Instagram Webhook] INSTAGRAM_WEBHOOK_VERIFY_TOKEN not configured');
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
// POST /api/webhooks/instagram — Inbound DM and Comment Handling
// -----------------------------------------------------------------------------

/**
 * Receives inbound Instagram DMs and comments, routing them appropriately.
 *
 * - DMs are delivered to the Message Router via the Instagram integration.
 * - Comments are checked for purchase-intent keywords and auto-replied.
 *
 * The webhook payload structure determines how it's routed:
 * - If the payload contains `entry[].messaging` → DM webhook
 * - If the payload contains `entry[].changes` → Comment/field change webhook
 *
 * Always returns 200 OK to Meta to acknowledge receipt (prevents retries).
 *
 * Requirements: 9.1, 9.2
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const appSecret = process.env.META_APP_SECRET;

    if (appSecret) {
      const signature = request.headers.get('x-hub-signature-256');
      if (!verifyMetaSignature(rawBody, signature, appSecret)) {
        console.error('[Instagram Webhook] Invalid signature');
        return NextResponse.json({ status: 'received' }, { status: 200 });
      }
    }

    const payload = JSON.parse(rawBody);
    const entry = payload.entry?.[0];

    if (entry?.messaging) {
      await instagramIntegration.handleDMWebhook(payload as InstagramDMPayload);
    } else if (entry?.changes) {
      await instagramIntegration.handleCommentWebhook(payload as InstagramCommentPayload);
    }

    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    console.error('[Instagram Webhook] Error processing webhook:', error);
    return NextResponse.json({ status: 'received' }, { status: 200 });
  }
}
