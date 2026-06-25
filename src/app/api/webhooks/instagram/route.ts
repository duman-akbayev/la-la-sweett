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
  if (mode === 'subscribe' && token === verifyToken) {
    // Return the challenge as plain text (required by Meta)
    return new NextResponse(challenge, {
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
    const payload = await request.json();

    // Determine if this is a DM or comment webhook based on payload structure
    const entry = payload.entry?.[0];

    if (entry?.messaging) {
      // DM webhook — route through Message Router to AI Assistant
      await instagramIntegration.handleDMWebhook(payload as InstagramDMPayload);
    } else if (entry?.changes) {
      // Comment/field change webhook — check for purchase-intent and auto-reply
      await instagramIntegration.handleCommentWebhook(payload as InstagramCommentPayload);
    }

    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    // Log error but still return 200 to avoid Meta retrying
    console.error('[Instagram Webhook] Error processing webhook:', error);
    return NextResponse.json({ status: 'received' }, { status: 200 });
  }
}
