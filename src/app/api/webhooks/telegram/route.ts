// =============================================================================
// La La Sweett Sales System — Telegram Webhook Handler
// =============================================================================
// Validates: Requirements 8.4
//
// Handles Telegram Bot webhook updates:
// - Callback queries (inline button presses): approve/reject/reply order actions
// - Commands (/content, /analytics)
// Always returns 200 OK to Telegram to acknowledge receipt.

import { NextRequest, NextResponse } from 'next/server';
import { telegramBot } from '@/integrations/telegram.bot';
import { transitionState, cancelOrder } from '@/services/order.service';
import type { TelegramCallbackQuery, TelegramCommand } from '@/types';

// -----------------------------------------------------------------------------
// Types for Telegram webhook payload
// -----------------------------------------------------------------------------

interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string };
    chat: { id: number };
    text?: string;
    entities?: Array<{ type: string; offset: number; length: number }>;
  };
}

// -----------------------------------------------------------------------------
// POST /api/webhooks/telegram
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();

    // Handle callback queries (inline button presses)
    if (update.callback_query) {
      await handleCallbackQueryUpdate(update.callback_query);
    }
    // Handle commands (messages starting with /)
    else if (update.message?.text?.startsWith('/')) {
      await handleCommandUpdate(update.message);
    }

    // Always return 200 OK to Telegram
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    // Log error but still return 200 to avoid Telegram retrying
    console.error('[Telegram Webhook] Error processing update:', error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

// -----------------------------------------------------------------------------
// Callback Query Handler
// -----------------------------------------------------------------------------

async function handleCallbackQueryUpdate(
  callbackQuery: NonNullable<TelegramUpdate['callback_query']>
): Promise<void> {
  const query: TelegramCallbackQuery = {
    id: callbackQuery.id,
    chatId: callbackQuery.message?.chat.id ?? callbackQuery.from.id,
    data: callbackQuery.data ?? '',
    messageId: callbackQuery.message?.message_id ?? 0,
  };

  // Let the telegram bot handle the callback (answers the query, shows feedback)
  const result = await telegramBot.handleCallbackQuery(query);

  // Now perform the actual order state transition based on action
  switch (result.action) {
    case 'approve':
      await transitionState(result.orderId, 'Confirmed', {
        triggeredBy: 'owner_telegram',
        timestamp: new Date(),
        metadata: { action: 'approve', callbackQueryId: callbackQuery.id },
      });
      break;

    case 'reject':
      await cancelOrder(result.orderId, 'Rejected by owner');
      break;

    case 'reply':
      // Reply action prepares a reply mode — no state transition needed.
      // The owner will send a follow-up message that gets routed to the customer.
      // This is handled by the message router in subsequent interactions.
      break;
  }
}

// -----------------------------------------------------------------------------
// Command Handler
// -----------------------------------------------------------------------------

async function handleCommandUpdate(
  message: NonNullable<TelegramUpdate['message']>
): Promise<void> {
  const text = message.text ?? '';
  const parts = text.split(' ');
  const commandText = parts[0]; // e.g., "/content"
  const args = parts.slice(1).join(' ');

  const command: TelegramCommand = {
    command: commandText,
    chatId: message.chat.id,
    args: args || undefined,
  };

  await telegramBot.handleCommand(command);
}
