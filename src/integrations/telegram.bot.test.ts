/**
 * Tests for Telegram Bot Integration
 *
 * Validates: Requirements 8.1, 8.4, 8.6, 14.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  telegramBot,
  createOrderActionButtons,
} from './telegram.bot';
import type {
  OwnerNotification,
  DailySummary,
  TelegramCommand,
  TelegramCallbackQuery,
  ContentSuggestion,
  WeeklyReport,
  Channel,
} from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Telegram Bot Integration', () => {
  beforeEach(() => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-bot-token');
    vi.stubEnv('TELEGRAM_OWNER_CHAT_ID', '12345');
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"ok":true}'),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('sendNotification', () => {
    it('sends a notification with HTML formatting', async () => {
      const notification: OwnerNotification = {
        type: 'new_order',
        content: '🎂 New order from Jane Doe',
        priority: 'high',
      };

      await telegramBot.sendNotification(notification);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.chat_id).toBe('12345');
      expect(body.text).toBe('🎂 New order from Jane Doe');
      expect(body.parse_mode).toBe('HTML');
    });

    it('includes inline keyboard when actions are provided', async () => {
      const notification: OwnerNotification = {
        type: 'new_order',
        content: 'New order #123',
        priority: 'high',
        actions: [
          { text: '✅ Approve', callbackData: 'approve_order_123' },
          { text: '❌ Reject', callbackData: 'reject_order_123' },
          { text: '💬 Reply', callbackData: 'reply_order_123' },
        ],
      };

      await telegramBot.sendNotification(notification);

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.reply_markup).toBeDefined();
      expect(body.reply_markup.inline_keyboard).toHaveLength(3);
      expect(body.reply_markup.inline_keyboard[0][0]).toEqual({
        text: '✅ Approve',
        callback_data: 'approve_order_123',
      });
      expect(body.reply_markup.inline_keyboard[1][0]).toEqual({
        text: '❌ Reject',
        callback_data: 'reject_order_123',
      });
      expect(body.reply_markup.inline_keyboard[2][0]).toEqual({
        text: '💬 Reply',
        callback_data: 'reply_order_123',
      });
    });

    it('does not include reply_markup when no actions are provided', async () => {
      const notification: OwnerNotification = {
        type: 'daily_summary',
        content: 'Daily summary content',
        priority: 'normal',
      };

      await telegramBot.sendNotification(notification);

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.reply_markup).toBeUndefined();
    });

    it('throws when bot token is not configured', async () => {
      vi.stubEnv('TELEGRAM_BOT_TOKEN', '');

      const notification: OwnerNotification = {
        type: 'new_order',
        content: 'Test',
        priority: 'normal',
      };

      await expect(telegramBot.sendNotification(notification)).rejects.toThrow(
        'Telegram bot token or owner chat ID not configured'
      );
    });

    it('throws when Telegram API returns an error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      });

      const notification: OwnerNotification = {
        type: 'new_order',
        content: 'Test',
        priority: 'normal',
      };

      await expect(telegramBot.sendNotification(notification)).rejects.toThrow(
        'Telegram API error: 400 - Bad Request'
      );
    });
  });

  describe('handleCommand', () => {
    describe('/content command', () => {
      it('returns 3 content suggestions', async () => {
        const command: TelegramCommand = {
          command: '/content',
          chatId: 12345,
        };

        const result = await telegramBot.handleCommand(command);

        expect(result.command).toBe('/content');
        expect(result.chatId).toBe(12345);
        expect(result.response).toContain('Content Suggestions');
        // Default stub returns 3 suggestions
        expect(result.response).toContain('1.');
        expect(result.response).toContain('2.');
        expect(result.response).toContain('3.');
      });

      it('uses custom content provider when set', async () => {
        const customSuggestions: ContentSuggestion[] = [
          { topic: 'Custom topic 1', format: 'post', caption: 'Caption 1' },
          { topic: 'Custom topic 2', format: 'story', caption: 'Caption 2' },
          { topic: 'Custom topic 3', format: 'reel', caption: 'Caption 3' },
        ];

        (telegramBot as any)._contentProvider = vi
          .fn()
          .mockResolvedValue(customSuggestions);

        const command: TelegramCommand = {
          command: '/content',
          chatId: 12345,
        };

        const result = await telegramBot.handleCommand(command);

        expect(result.response).toContain('Custom topic 1');
        expect(result.response).toContain('Custom topic 2');
        expect(result.response).toContain('Custom topic 3');

        // Clean up
        (telegramBot as any)._contentProvider = null;
      });

      it('sends response message to the chat', async () => {
        const command: TelegramCommand = {
          command: '/content',
          chatId: 12345,
        };

        await telegramBot.handleCommand(command);

        // Should call sendMessage to the chat
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.telegram.org/bottest-bot-token/sendMessage',
          expect.anything()
        );

        const body = JSON.parse(
          (mockFetch.mock.calls[0][1] as RequestInit).body as string
        );
        expect(body.chat_id).toBe(12345);
      });
    });

    describe('/analytics command', () => {
      it('returns weekly metrics', async () => {
        const command: TelegramCommand = {
          command: '/analytics',
          chatId: 12345,
        };

        const result = await telegramBot.handleCommand(command);

        expect(result.command).toBe('/analytics');
        expect(result.response).toContain('Weekly Analytics');
        expect(result.response).toContain('Conversations by Channel');
        expect(result.response).toContain('Conversion Rate');
      });

      it('uses custom analytics provider when set', async () => {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);

        const customReport: WeeklyReport = {
          weekStarting: weekStart,
          weekEnding: now,
          totalConversationsByChannel: {
            whatsapp: 15,
            instagram: 8,
            chat_widget: 22,
          } as Record<Channel, number>,
          topTopics: [
            { topic: 'Wedding cakes', count: 12 },
            { topic: 'Pricing', count: 8 },
          ],
          conversionRate: 0.35,
          averageResponseTimeByChannel: {
            whatsapp: 3200,
            instagram: 4100,
            chat_widget: 2800,
          } as Record<Channel, number>,
        };

        (telegramBot as any)._analyticsProvider = vi
          .fn()
          .mockResolvedValue(customReport);

        const command: TelegramCommand = {
          command: '/analytics',
          chatId: 12345,
        };

        const result = await telegramBot.handleCommand(command);

        expect(result.response).toContain('whatsapp: 15');
        expect(result.response).toContain('instagram: 8');
        expect(result.response).toContain('chat_widget: 22');
        expect(result.response).toContain('Wedding cakes');
        expect(result.response).toContain('35.0%');

        // Clean up
        (telegramBot as any)._analyticsProvider = null;
      });
    });

    describe('unknown command', () => {
      it('returns an error message for unknown commands', async () => {
        const command: TelegramCommand = {
          command: '/unknown',
          chatId: 12345,
        };

        const result = await telegramBot.handleCommand(command);

        expect(result.response).toContain('Unknown command: /unknown');
        expect(result.response).toContain('/content');
        expect(result.response).toContain('/analytics');
      });
    });
  });

  describe('handleCallbackQuery', () => {
    it('handles approve_order callback', async () => {
      const query: TelegramCallbackQuery = {
        id: 'callback-1',
        chatId: 12345,
        data: 'approve_order_abc123',
        messageId: 100,
      };

      const result = await telegramBot.handleCallbackQuery(query);

      expect(result.action).toBe('approve');
      expect(result.orderId).toBe('abc123');
      expect(result.answerText).toContain('approved');
    });

    it('handles reject_order callback', async () => {
      const query: TelegramCallbackQuery = {
        id: 'callback-2',
        chatId: 12345,
        data: 'reject_order_def456',
        messageId: 101,
      };

      const result = await telegramBot.handleCallbackQuery(query);

      expect(result.action).toBe('reject');
      expect(result.orderId).toBe('def456');
      expect(result.answerText).toContain('rejected');
    });

    it('handles reply_order callback', async () => {
      const query: TelegramCallbackQuery = {
        id: 'callback-3',
        chatId: 12345,
        data: 'reply_order_ghi789',
        messageId: 102,
      };

      const result = await telegramBot.handleCallbackQuery(query);

      expect(result.action).toBe('reply');
      expect(result.orderId).toBe('ghi789');
      expect(result.answerText).toContain('Reply mode');
    });

    it('calls answerCallbackQuery API', async () => {
      const query: TelegramCallbackQuery = {
        id: 'callback-1',
        chatId: 12345,
        data: 'approve_order_abc123',
        messageId: 100,
      };

      await telegramBot.handleCallbackQuery(query);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/answerCallbackQuery',
        expect.objectContaining({
          method: 'POST',
        })
      );

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.callback_query_id).toBe('callback-1');
    });

    it('handles order IDs with underscores', async () => {
      const query: TelegramCallbackQuery = {
        id: 'callback-4',
        chatId: 12345,
        data: 'approve_order_order_with_underscores',
        messageId: 103,
      };

      const result = await telegramBot.handleCallbackQuery(query);

      expect(result.action).toBe('approve');
      expect(result.orderId).toBe('order_with_underscores');
    });

    it('throws for invalid callback data format', async () => {
      const query: TelegramCallbackQuery = {
        id: 'callback-5',
        chatId: 12345,
        data: 'invalid_data',
        messageId: 104,
      };

      await expect(telegramBot.handleCallbackQuery(query)).rejects.toThrow(
        'Invalid callback data format'
      );
    });
  });

  describe('sendDailySummary', () => {
    it('formats and sends the daily summary', async () => {
      const summary: DailySummary = {
        date: new Date('2024-06-15'),
        totalInquiries: 12,
        ordersReceived: 4,
        estimatedRevenue: 1250.0,
        topCakeTypes: [
          { type: 'Birthday Cake', count: 5 },
          { type: 'Wedding Cake', count: 3 },
          { type: 'Cupcakes', count: 2 },
        ],
      };

      await telegramBot.sendDailySummary(summary);

      expect(mockFetch).toHaveBeenCalled();

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.text).toContain('Daily Summary');
      expect(body.text).toContain('Inquiries: 12');
      expect(body.text).toContain('Orders: 4');
      expect(body.text).toContain('$1250.00');
      expect(body.text).toContain('Birthday Cake');
      expect(body.text).toContain('Wedding Cake');
      expect(body.text).toContain('Cupcakes');
    });

    it('handles empty top cake types', async () => {
      const summary: DailySummary = {
        date: new Date('2024-06-15'),
        totalInquiries: 0,
        ordersReceived: 0,
        estimatedRevenue: 0,
        topCakeTypes: [],
      };

      await telegramBot.sendDailySummary(summary);

      const body = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.text).toContain('No cake inquiries today.');
    });
  });

  describe('createOrderActionButtons', () => {
    it('creates approve, reject, and reply buttons', () => {
      const buttons = createOrderActionButtons('order-123');

      expect(buttons).toHaveLength(3);
      expect(buttons[0]).toEqual({
        text: '✅ Approve',
        callbackData: 'approve_order_order-123',
      });
      expect(buttons[1]).toEqual({
        text: '❌ Reject',
        callbackData: 'reject_order_order-123',
      });
      expect(buttons[2]).toEqual({
        text: '💬 Reply',
        callbackData: 'reply_order_order-123',
      });
    });

    it('encodes the order ID in callback data', () => {
      const buttons = createOrderActionButtons('abc-def-ghi');

      expect(buttons[0].callbackData).toBe('approve_order_abc-def-ghi');
      expect(buttons[1].callbackData).toBe('reject_order_abc-def-ghi');
      expect(buttons[2].callbackData).toBe('reply_order_abc-def-ghi');
    });
  });
});
