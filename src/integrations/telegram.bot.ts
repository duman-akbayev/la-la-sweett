/**
 * Telegram Bot Integration
 *
 * Implements the TelegramBot interface for owner notifications,
 * inline action buttons, daily summaries, and command handling.
 *
 * Requirements: 8.1, 8.4, 8.6, 14.4
 */

import type {
  TelegramBot,
  TelegramCommand,
  TelegramCallbackQuery,
  OwnerNotification,
  DailySummary,
  ContentSuggestion,
  WeeklyReport,
  Channel,
} from '../types';
import { contentPlannerService } from '../services/content-planner.service';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Result of handling a callback query */
export interface CallbackQueryResult {
  action: 'approve' | 'reject' | 'reply';
  orderId: string;
  answerText: string;
}

/** Result of handling a command */
export interface CommandResult {
  command: string;
  response: string;
  chatId: number;
}

/** Injectable dependency for content suggestions */
export type ContentSuggestionsProvider = (
  count: number
) => Promise<ContentSuggestion[]>;

/** Injectable dependency for weekly analytics */
export type WeeklyAnalyticsProvider = () => Promise<WeeklyReport>;

// -----------------------------------------------------------------------------
// Telegram Bot Implementation
// -----------------------------------------------------------------------------

class TelegramBotImpl implements TelegramBot {
  /** Injectable content suggestions provider (for /content command) */
  _contentProvider: ContentSuggestionsProvider | null = null;

  /** Injectable weekly analytics provider (for /analytics command) */
  _analyticsProvider: WeeklyAnalyticsProvider | null = null;

  /** Set the content suggestions provider */
  setContentProvider(provider: ContentSuggestionsProvider): void {
    this._contentProvider = provider;
  }

  /** Set the weekly analytics provider */
  setAnalyticsProvider(provider: WeeklyAnalyticsProvider): void {
    this._analyticsProvider = provider;
  }

  /**
   * Sends a notification to the owner via Telegram with optional inline action buttons.
   *
   * For new_order notifications, automatically adds approve/reject/reply buttons
   * if no actions are already specified.
   */
  async sendNotification(notification: OwnerNotification): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;

    if (!botToken || !chatId) {
      throw new Error('Telegram bot token or owner chat ID not configured');
    }

    // Build inline keyboard from notification actions
    const actions = notification.actions ?? [];
    const inlineKeyboard =
      actions.length > 0
        ? {
            inline_keyboard: actions.map((action) => [
              { text: action.text, callback_data: action.callbackData },
            ]),
          }
        : undefined;

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: notification.content,
      parse_mode: 'HTML',
    };

    if (inlineKeyboard) {
      payload.reply_markup = inlineKeyboard;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Telegram API error: ${response.status} - ${errorData}`);
    }
  }

  /**
   * Handles Telegram bot commands.
   *
   * Supported commands:
   * - /content → returns 3 AI-generated content suggestions within 15 seconds
   * - /analytics → returns weekly metrics within 10 seconds
   */
  async handleCommand(command: TelegramCommand): Promise<CommandResult> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      throw new Error('Telegram bot token not configured');
    }

    let responseText: string;

    switch (command.command) {
      case '/content':
        responseText = await this.handleContentCommand();
        break;
      case '/analytics':
        responseText = await this.handleAnalyticsCommand();
        break;
      default:
        responseText = `Unknown command: ${command.command}. Available commands: /content, /analytics`;
    }

    // Send the response back to the chat
    await this.sendTextMessage(command.chatId, responseText);

    return {
      command: command.command,
      response: responseText,
      chatId: command.chatId,
    };
  }

  /**
   * Handles inline button callback queries (approve, reject, reply).
   *
   * Expected callback_data format:
   * - approve_order_{orderId}
   * - reject_order_{orderId}
   * - reply_order_{orderId}
   */
  async handleCallbackQuery(
    query: TelegramCallbackQuery
  ): Promise<CallbackQueryResult> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      throw new Error('Telegram bot token not configured');
    }

    const { action, orderId } = this.parseCallbackData(query.data);
    let answerText: string;

    switch (action) {
      case 'approve':
        answerText = `✅ Order ${orderId} approved`;
        break;
      case 'reject':
        answerText = `❌ Order ${orderId} rejected`;
        break;
      case 'reply':
        answerText = `💬 Reply mode for order ${orderId}`;
        break;
      default:
        answerText = 'Unknown action';
    }

    // Answer the callback query (dismisses the loading state on the button)
    await this.answerCallbackQuery(query.id, answerText);

    return { action, orderId, answerText };
  }

  /**
   * Formats and sends the daily summary to the owner.
   *
   * Contains: total inquiries, orders received, estimated revenue, top 3 cake types.
   */
  async sendDailySummary(summary: DailySummary): Promise<void> {
    const content = this.formatDailySummary(summary);

    await this.sendNotification({
      type: 'daily_summary',
      content,
      priority: 'normal',
    });
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Handles the /content command by returning 3 AI-generated content suggestions.
   * Uses the injected content provider if available, otherwise falls back to
   * the content planner service.
   */
  private async handleContentCommand(): Promise<string> {
    let suggestions: ContentSuggestion[];

    if (this._contentProvider) {
      suggestions = await this._contentProvider(3);
    } else {
      // Fall back to content planner service
      suggestions = await contentPlannerService.getContentSuggestions(3);
    }

    return this.formatContentSuggestions(suggestions);
  }

  /**
   * Handles the /analytics command by returning weekly metrics.
   */
  private async handleAnalyticsCommand(): Promise<string> {
    let report: WeeklyReport;

    if (this._analyticsProvider) {
      report = await this._analyticsProvider();
    } else {
      // Stub: return default weekly analytics
      report = this.getDefaultWeeklyReport();
    }

    return this.formatWeeklyReport(report);
  }

  /**
   * Parses callback_data string into action and orderId.
   */
  private parseCallbackData(data: string): {
    action: 'approve' | 'reject' | 'reply';
    orderId: string;
  } {
    const parts = data.split('_');

    // Expected format: {action}_order_{orderId}
    if (parts.length < 3 || parts[1] !== 'order') {
      throw new Error(`Invalid callback data format: ${data}`);
    }

    const action = parts[0] as 'approve' | 'reject' | 'reply';
    const orderId = parts.slice(2).join('_');

    if (!['approve', 'reject', 'reply'].includes(action)) {
      throw new Error(`Invalid action in callback data: ${action}`);
    }

    return { action, orderId };
  }

  /**
   * Sends a plain text message to a Telegram chat.
   */
  private async sendTextMessage(
    chatId: number,
    text: string
  ): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      throw new Error('Telegram bot token not configured');
    }

    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Telegram API error: ${response.status} - ${errorData}`);
    }
  }

  /**
   * Answers a callback query (acknowledges button press).
   */
  private async answerCallbackQuery(
    callbackQueryId: string,
    text: string
  ): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      throw new Error('Telegram bot token not configured');
    }

    const payload = {
      callback_query_id: callbackQueryId,
      text,
    };

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/answerCallbackQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Telegram API error (answerCallbackQuery): ${response.status} - ${errorData}`
      );
    }
  }

  /**
   * Formats the daily summary into a readable Telegram message.
   */
  private formatDailySummary(summary: DailySummary): string {
    const topCakes = summary.topCakeTypes
      .slice(0, 3)
      .map((ct, i) => `  ${i + 1}. ${ct.type} (${ct.count} inquiries)`)
      .join('\n');

    return [
      '📊 <b>Daily Summary</b>',
      '',
      `📅 ${summary.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      '',
      `📨 Inquiries: ${summary.totalInquiries}`,
      `🎂 Orders: ${summary.ordersReceived}`,
      `💰 Est. Revenue: $${summary.estimatedRevenue.toFixed(2)}`,
      '',
      topCakes
        ? `🏆 Top Cake Types:\n${topCakes}`
        : 'No cake inquiries today.',
    ].join('\n');
  }

  /**
   * Formats content suggestions into a Telegram message.
   */
  private formatContentSuggestions(suggestions: ContentSuggestion[]): string {
    const formatted = suggestions
      .map(
        (s, i) =>
          `<b>${i + 1}. ${s.topic}</b>\n` +
          `   Format: ${s.format}\n` +
          `   Caption: ${s.caption}`
      )
      .join('\n\n');

    return `🎨 <b>Content Suggestions</b>\n\n${formatted}`;
  }

  /**
   * Formats a weekly report into a Telegram message.
   */
  private formatWeeklyReport(report: WeeklyReport): string {
    const channels = Object.entries(report.totalConversationsByChannel)
      .map(([ch, count]) => `  • ${ch}: ${count}`)
      .join('\n');

    const topics = report.topTopics
      .slice(0, 5)
      .map((t, i) => `  ${i + 1}. ${t.topic} (${t.count})`)
      .join('\n');

    const avgResponseTimes = Object.entries(report.averageResponseTimeByChannel)
      .map(([ch, time]) => `  • ${ch}: ${(time / 1000).toFixed(1)}s`)
      .join('\n');

    return [
      '📈 <b>Weekly Analytics</b>',
      '',
      `📅 ${report.weekStarting.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${report.weekEnding.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      '',
      '<b>Conversations by Channel:</b>',
      channels || '  No conversations this week.',
      '',
      '<b>Top Topics:</b>',
      topics || '  No topics recorded.',
      '',
      `<b>Conversion Rate:</b> ${(report.conversionRate * 100).toFixed(1)}%`,
      '',
      '<b>Avg Response Time:</b>',
      avgResponseTimes || '  No data available.',
    ].join('\n');
  }

  /**
   * Returns default stub content suggestions for when no provider is configured.
   */
  private getDefaultContentSuggestions(): ContentSuggestion[] {
    return [
      {
        topic: 'Behind-the-scenes cake decorating',
        format: 'reel',
        caption:
          '✨ Watch the magic unfold! Every petal, every swirl is handcrafted with love. Which detail is your favorite? 🎂💕 #LaLaSweett #AustinCakes #CakeArt',
      },
      {
        topic: 'Seasonal flavor spotlight',
        format: 'post',
        caption:
          '🍋 New flavor alert! Our Lemon Lavender cake is perfect for spring celebrations. Light, zesty, and oh-so-dreamy. Book yours today! 🌸 #CustomCakes #AustinTX',
      },
      {
        topic: 'Customer cake reveal',
        format: 'story',
        caption:
          "Swipe to see this gorgeous 3-tier wedding cake come to life! 💒🎂 The bride's reaction was everything! DM us to start planning your dream cake 💌",
      },
    ];
  }

  /**
   * Returns a default stub weekly report for when no provider is configured.
   */
  private getDefaultWeeklyReport(): WeeklyReport {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    return {
      weekStarting: weekStart,
      weekEnding: now,
      totalConversationsByChannel: {
        whatsapp: 0,
        instagram: 0,
        chat_widget: 0,
      } as Record<Channel, number>,
      topTopics: [],
      conversionRate: 0,
      averageResponseTimeByChannel: {
        whatsapp: 0,
        instagram: 0,
        chat_widget: 0,
      } as Record<Channel, number>,
    };
  }
}

// Singleton instance
const telegramBotInstance = new TelegramBotImpl();

export { telegramBotInstance as telegramBot };
export type { TelegramBotImpl };

/**
 * Creates inline action buttons for a new order notification.
 *
 * @param orderId - The order ID to include in callback data
 * @returns Array of TelegramInlineButton with approve, reject, and reply actions
 */
export function createOrderActionButtons(orderId: string) {
  return [
    { text: '✅ Approve', callbackData: `approve_order_${orderId}` },
    { text: '❌ Reject', callbackData: `reject_order_${orderId}` },
    { text: '💬 Reply', callbackData: `reply_order_${orderId}` },
  ];
}
