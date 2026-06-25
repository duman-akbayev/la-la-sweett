// =============================================================================
// La La Sweett Sales System — Telegram Webhook Handler Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the telegram bot
vi.mock('@/integrations/telegram.bot', () => ({
  telegramBot: {
    handleCallbackQuery: vi.fn(),
    handleCommand: vi.fn(),
  },
}));

// Mock the order service
vi.mock('@/services/order.service', () => ({
  transitionState: vi.fn(),
  cancelOrder: vi.fn(),
}));

import { telegramBot } from '@/integrations/telegram.bot';
import { transitionState, cancelOrder } from '@/services/order.service';

// Helper to create a NextRequest from a body payload
function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/webhooks/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/webhooks/telegram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('callback queries', () => {
    it('handles approve_order callback and transitions to Confirmed', async () => {
      vi.mocked(telegramBot.handleCallbackQuery).mockResolvedValue({
        action: 'approve',
        orderId: 'order-123',
        answerText: '✅ Order order-123 approved',
      });
      vi.mocked(transitionState).mockResolvedValue({} as never);

      const request = createRequest({
        update_id: 1,
        callback_query: {
          id: 'cb-1',
          from: { id: 999, first_name: 'Owner' },
          message: { message_id: 100, chat: { id: 123 } },
          data: 'approve_order_order-123',
        },
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ ok: true });
      expect(telegramBot.handleCallbackQuery).toHaveBeenCalledWith({
        id: 'cb-1',
        chatId: 123,
        data: 'approve_order_order-123',
        messageId: 100,
      });
      expect(transitionState).toHaveBeenCalledWith(
        'order-123',
        'Confirmed',
        expect.objectContaining({
          triggeredBy: 'owner_telegram',
          metadata: { action: 'approve', callbackQueryId: 'cb-1' },
        })
      );
    });

    it('handles reject_order callback and cancels the order', async () => {
      vi.mocked(telegramBot.handleCallbackQuery).mockResolvedValue({
        action: 'reject',
        orderId: 'order-456',
        answerText: '❌ Order order-456 rejected',
      });
      vi.mocked(cancelOrder).mockResolvedValue({} as never);

      const request = createRequest({
        update_id: 2,
        callback_query: {
          id: 'cb-2',
          from: { id: 999, first_name: 'Owner' },
          message: { message_id: 101, chat: { id: 123 } },
          data: 'reject_order_order-456',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(cancelOrder).toHaveBeenCalledWith('order-456', 'Rejected by owner');
      expect(transitionState).not.toHaveBeenCalled();
    });

    it('handles reply_order callback without state transition', async () => {
      vi.mocked(telegramBot.handleCallbackQuery).mockResolvedValue({
        action: 'reply',
        orderId: 'order-789',
        answerText: '💬 Reply mode for order order-789',
      });

      const request = createRequest({
        update_id: 3,
        callback_query: {
          id: 'cb-3',
          from: { id: 999, first_name: 'Owner' },
          message: { message_id: 102, chat: { id: 123 } },
          data: 'reply_order_order-789',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(transitionState).not.toHaveBeenCalled();
      expect(cancelOrder).not.toHaveBeenCalled();
    });

    it('uses from.id as chatId when message is missing', async () => {
      vi.mocked(telegramBot.handleCallbackQuery).mockResolvedValue({
        action: 'approve',
        orderId: 'order-abc',
        answerText: '✅ Order order-abc approved',
      });
      vi.mocked(transitionState).mockResolvedValue({} as never);

      const request = createRequest({
        update_id: 4,
        callback_query: {
          id: 'cb-4',
          from: { id: 555, first_name: 'Owner' },
          data: 'approve_order_order-abc',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(telegramBot.handleCallbackQuery).toHaveBeenCalledWith(
        expect.objectContaining({ chatId: 555 })
      );
    });
  });

  describe('commands', () => {
    it('handles /content command', async () => {
      vi.mocked(telegramBot.handleCommand).mockResolvedValue({
        command: '/content',
        response: 'Content suggestions...',
        chatId: 123,
      });

      const request = createRequest({
        update_id: 5,
        message: {
          message_id: 200,
          from: { id: 999, first_name: 'Owner' },
          chat: { id: 123 },
          text: '/content',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(telegramBot.handleCommand).toHaveBeenCalledWith({
        command: '/content',
        chatId: 123,
        args: undefined,
      });
    });

    it('handles /analytics command', async () => {
      vi.mocked(telegramBot.handleCommand).mockResolvedValue({
        command: '/analytics',
        response: 'Weekly analytics...',
        chatId: 123,
      });

      const request = createRequest({
        update_id: 6,
        message: {
          message_id: 201,
          from: { id: 999, first_name: 'Owner' },
          chat: { id: 123 },
          text: '/analytics',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(telegramBot.handleCommand).toHaveBeenCalledWith({
        command: '/analytics',
        chatId: 123,
        args: undefined,
      });
    });

    it('passes command arguments correctly', async () => {
      vi.mocked(telegramBot.handleCommand).mockResolvedValue({
        command: '/content',
        response: 'Content suggestions...',
        chatId: 123,
      });

      const request = createRequest({
        update_id: 7,
        message: {
          message_id: 202,
          from: { id: 999, first_name: 'Owner' },
          chat: { id: 123 },
          text: '/content extra args here',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(telegramBot.handleCommand).toHaveBeenCalledWith({
        command: '/content',
        chatId: 123,
        args: 'extra args here',
      });
    });
  });

  describe('non-command messages', () => {
    it('ignores regular messages (no callback_query, no command)', async () => {
      const request = createRequest({
        update_id: 8,
        message: {
          message_id: 300,
          from: { id: 999, first_name: 'Owner' },
          chat: { id: 123 },
          text: 'Hello there',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(telegramBot.handleCallbackQuery).not.toHaveBeenCalled();
      expect(telegramBot.handleCommand).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('returns 200 even when callback query processing throws', async () => {
      vi.mocked(telegramBot.handleCallbackQuery).mockRejectedValue(
        new Error('Bot error')
      );

      const request = createRequest({
        update_id: 9,
        callback_query: {
          id: 'cb-err',
          from: { id: 999, first_name: 'Owner' },
          message: { message_id: 103, chat: { id: 123 } },
          data: 'approve_order_bad-id',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('returns 200 even when command processing throws', async () => {
      vi.mocked(telegramBot.handleCommand).mockRejectedValue(
        new Error('Command error')
      );

      const request = createRequest({
        update_id: 10,
        message: {
          message_id: 301,
          from: { id: 999, first_name: 'Owner' },
          chat: { id: 123 },
          text: '/content',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('returns 200 for malformed JSON body', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/webhooks/telegram',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not valid json{{{',
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });
});
