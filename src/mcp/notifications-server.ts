// =============================================================================
// MCP Notifications Server — Exposes notification tools for the AI Assistant
// =============================================================================

import type {
  MCPServer,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  NotificationService,
  Channel,
  OwnerNotificationType,
  EscalationStatus,
} from '../types';

/** Escalation record created by the create_escalation tool */
export interface EscalationRecord {
  id: string;
  reason: string;
  contextSummary: string;
  originatingChannel: Channel;
  status: EscalationStatus;
  createdAt: string;
}

/**
 * MCP Notifications Server provides tool access for the AI Assistant
 * to send notifications to the owner, message customers, and create
 * escalation records via the NotificationService.
 *
 * Tools:
 * - send_owner_notification: Send a notification to the owner (Telegram)
 * - send_customer_message: Send a message to a customer via their channel
 * - create_escalation: Create an escalation record and notify the owner
 */
export class NotificationsMCPServer implements MCPServer {
  name = 'notifications';
  tools: MCPTool[];

  private notificationService: NotificationService;
  private escalations: EscalationRecord[] = [];

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'send_owner_notification',
        description:
          'Sends a notification to the bakery owner via Telegram. Includes type, content, priority, and optional inline action buttons.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description:
                'Notification type: "new_order", "escalation", "unresponded_alert", or "daily_summary".',
              enum: ['new_order', 'escalation', 'unresponded_alert', 'daily_summary'],
            },
            content: {
              type: 'string',
              description: 'The notification message content.',
            },
            priority: {
              type: 'string',
              description: 'Priority level: "high" or "normal". Defaults to "normal".',
              enum: ['high', 'normal'],
            },
            actions: {
              type: 'array',
              description:
                'Optional inline action buttons for the Telegram message.',
              items: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    description: 'Button label text.',
                  },
                  callbackData: {
                    type: 'string',
                    description: 'Callback data string for the button action.',
                  },
                },
                required: ['text', 'callbackData'],
              },
            },
          },
          required: ['type', 'content'],
          additionalProperties: false,
        },
      },
      {
        name: 'send_customer_message',
        description:
          'Sends a message to a customer via their originating channel (WhatsApp, Instagram, or Chat Widget).',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: 'The unique identifier of the customer to message.',
            },
            channel: {
              type: 'string',
              description:
                'The channel to send the message through: "whatsapp", "instagram", or "chat_widget".',
              enum: ['whatsapp', 'instagram', 'chat_widget'],
            },
            content: {
              type: 'string',
              description: 'The message content to send to the customer.',
            },
          },
          required: ['customerId', 'channel', 'content'],
          additionalProperties: false,
        },
      },
      {
        name: 'create_escalation',
        description:
          'Creates an escalation record when the AI Assistant cannot handle a request. Notifies the owner with a summary, reason, and originating channel.',
        inputSchema: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description:
                'The reason for escalation (e.g., "complex custom design", "pricing exception", "customer requested human").',
            },
            contextSummary: {
              type: 'string',
              description:
                'A summary of the conversation context, maximum 500 characters.',
            },
            originatingChannel: {
              type: 'string',
              description:
                'The channel where the conversation originated: "whatsapp", "instagram", or "chat_widget".',
              enum: ['whatsapp', 'instagram', 'chat_widget'],
            },
          },
          required: ['reason', 'contextSummary', 'originatingChannel'],
          additionalProperties: false,
        },
      },
    ];
  }

  async handleToolCall(call: MCPToolCall): Promise<MCPToolResult> {
    try {
      switch (call.toolName) {
        case 'send_owner_notification':
          return await this.handleSendOwnerNotification(call.arguments);
        case 'send_customer_message':
          return await this.handleSendCustomerMessage(call.arguments);
        case 'create_escalation':
          return await this.handleCreateEscalation(call.arguments);
        default:
          return {
            success: false,
            error: `Unknown tool: ${call.toolName}`,
          };
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      return {
        success: false,
        error: message,
      };
    }
  }

  private async handleSendOwnerNotification(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const type = args.type as string;
    if (!type) {
      return {
        success: false,
        error: 'type is required.',
      };
    }

    const validTypes: OwnerNotificationType[] = [
      'new_order',
      'escalation',
      'unresponded_alert',
      'daily_summary',
    ];
    if (!validTypes.includes(type as OwnerNotificationType)) {
      return {
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}.`,
      };
    }

    const content = args.content as string;
    if (!content) {
      return {
        success: false,
        error: 'content is required.',
      };
    }

    const priority = (args.priority as 'high' | 'normal') ?? 'normal';
    if (priority !== 'high' && priority !== 'normal') {
      return {
        success: false,
        error: 'priority must be "high" or "normal".',
      };
    }

    const actions = args.actions as
      | { text: string; callbackData: string }[]
      | undefined;

    await this.notificationService.notifyOwner({
      type: type as OwnerNotificationType,
      content,
      priority,
      actions,
    });

    return {
      success: true,
      data: {
        message: 'Owner notification sent successfully.',
        type,
        priority,
      },
    };
  }

  private async handleSendCustomerMessage(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const customerId = args.customerId as string;
    if (!customerId) {
      return {
        success: false,
        error: 'customerId is required.',
      };
    }

    const channel = args.channel as string;
    if (!channel) {
      return {
        success: false,
        error: 'channel is required.',
      };
    }

    const validChannels: Channel[] = ['whatsapp', 'instagram', 'chat_widget'];
    if (!validChannels.includes(channel as Channel)) {
      return {
        success: false,
        error: `Invalid channel. Must be one of: ${validChannels.join(', ')}.`,
      };
    }

    const content = args.content as string;
    if (!content) {
      return {
        success: false,
        error: 'content is required.',
      };
    }

    await this.notificationService.notifyCustomer({
      customerId,
      channel: channel as Channel,
      content,
    });

    return {
      success: true,
      data: {
        message: 'Customer message sent successfully.',
        customerId,
        channel,
      },
    };
  }

  private async handleCreateEscalation(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const reason = args.reason as string;
    if (!reason) {
      return {
        success: false,
        error: 'reason is required.',
      };
    }

    const contextSummary = args.contextSummary as string;
    if (!contextSummary) {
      return {
        success: false,
        error: 'contextSummary is required.',
      };
    }

    if (contextSummary.length > 500) {
      return {
        success: false,
        error: 'contextSummary must be 500 characters or fewer.',
      };
    }

    const originatingChannel = args.originatingChannel as string;
    if (!originatingChannel) {
      return {
        success: false,
        error: 'originatingChannel is required.',
      };
    }

    const validChannels: Channel[] = ['whatsapp', 'instagram', 'chat_widget'];
    if (!validChannels.includes(originatingChannel as Channel)) {
      return {
        success: false,
        error: `Invalid originatingChannel. Must be one of: ${validChannels.join(', ')}.`,
      };
    }

    // Create escalation record
    const escalation: EscalationRecord = {
      id: crypto.randomUUID(),
      reason,
      contextSummary,
      originatingChannel: originatingChannel as Channel,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.escalations.push(escalation);

    // Notify owner about the escalation
    await this.notificationService.notifyOwner({
      type: 'escalation',
      content: `⚠️ Escalation: ${reason}\n\nContext: ${contextSummary}\n\nChannel: ${originatingChannel}`,
      priority: 'high',
    });

    return {
      success: true,
      data: escalation,
    };
  }

  /** Returns all escalation records (useful for testing and querying) */
  getEscalations(): EscalationRecord[] {
    return [...this.escalations];
  }
}

/**
 * Creates a NotificationsMCPServer wired to the actual Notification Service module.
 * Uses dynamic import to avoid triggering initialization at module load.
 */
export async function createNotificationsMCPServer(): Promise<NotificationsMCPServer> {
  const { notificationService } = await import('../services/notification.service');
  return new NotificationsMCPServer(notificationService);
}
