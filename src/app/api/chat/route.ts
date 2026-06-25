// =============================================================================
// La La Sweett Sales System — Chat API Endpoint
// =============================================================================
//
// Receives messages from the Chat Widget and routes them through the
// Message Router with channel='chat_widget'. Implements server-side rate
// limiting (10 messages per minute per session) and graceful degradation
// with a 10-second AI timeout.
//
// Requirements: 6.1, 11.4, 12.1, 6.8
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  messageRouter,
  type ChatWidgetRawMessage,
} from '@/services/message-router';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** AI response timeout in milliseconds (10 seconds per Requirement 12.1) */
const AI_TIMEOUT_MS = 10_000;

/** Fallback message shown when AI times out */
const TIMEOUT_FALLBACK_MESSAGE =
  'Our assistant is temporarily unavailable. Please submit your inquiry through our [order form](/order) and we will get back to you shortly!';

// ---------------------------------------------------------------------------
// In-memory rate limiter (client-side is primary; this is a secondary guard)
// In production, this would use Redis via the rate-limit lib.
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

/** Map of sessionId -> array of request timestamps */
const rateLimitStore = new Map<string, number[]>();

function checkSessionRateLimit(sessionId: string): {
  allowed: boolean;
  retryAfter?: number;
} {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  let timestamps = rateLimitStore.get(sessionId) || [];
  // Prune old entries
  timestamps = timestamps.filter((ts) => ts > windowStart);
  rateLimitStore.set(sessionId, timestamps);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    // Calculate retry-after from oldest entry in window
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  // Record this request
  timestamps.push(now);
  rateLimitStore.set(sessionId, timestamps);
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message } = body as {
      sessionId?: string;
      message?: string;
    };

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'sessionId is required',
          },
        },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'message is required and must be non-empty',
          },
        },
        { status: 400 }
      );
    }

    // Enforce max message length (2000 chars per input validation requirements)
    if (message.length > 2000) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Message must be 2000 characters or fewer',
          },
        },
        { status: 400 }
      );
    }

    // Rate limit check
    const rateLimitResult = checkSessionRateLimit(sessionId);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded. Please wait before sending more messages.',
            retryAfter: rateLimitResult.retryAfter,
          },
        },
        { status: 429 }
      );
    }

    // Build raw message for the Message Router
    const rawMessage: ChatWidgetRawMessage = {
      sessionId,
      userId: sessionId, // Use sessionId as userId for anonymous chat users
      text: message.trim(),
      sentAt: Date.now(),
    };

    // Route through Message Router with 10-second timeout
    let outbound: Awaited<ReturnType<typeof messageRouter.handleInbound>>;
    try {
      outbound = await Promise.race([
        messageRouter.handleInbound({
          channel: 'chat_widget',
          payload: rawMessage,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT_MS)
        ),
      ]);
    } catch (timeoutError) {
      if (
        timeoutError instanceof Error &&
        timeoutError.message === 'AI_TIMEOUT'
      ) {
        // Graceful degradation: AI timed out, return fallback with order form link
        return NextResponse.json({
          content: TIMEOUT_FALLBACK_MESSAGE,
          timestamp: new Date().toISOString(),
          timeout: true,
        });
      }
      throw timeoutError;
    }

    if (outbound) {
      return NextResponse.json({
        content: outbound.content,
        timestamp: new Date().toISOString(),
      });
    }

    // If the message router returns null (no AI assistant connected),
    // return a helpful fallback response
    return NextResponse.json({
      content:
        "Hi! Thanks for reaching out to La La Sweett. Our assistant is currently being set up. In the meantime, feel free to browse our catalog or submit an order inquiry through our order form!",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Chat API] Error processing message:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred processing your message. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}
