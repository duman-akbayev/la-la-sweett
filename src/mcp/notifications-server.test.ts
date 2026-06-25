// =============================================================================
// Unit Tests — MCP Notifications Server
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsMCPServer } from './notifications-server';
import type { NotificationService } from '../types';

function createMockNotificationService(): NotificationService {
  return {
    notifyOwner: vi.fn().mockResolvedValue(undefined),
    notifyCustomer: vi.fn().mockResolvedValue(undefined),
    queueNotification: vi.fn().mockResolvedValue(undefined),
    processQueue: vi.fn().mockResolvedValue(undefined),
    sendDailySummary: vi.fn().mockResolvedValue(undefined),
  };
}

describe('NotificationsMCPServer', () => {
  let server: NotificationsMCPServer;
  let mockService: NotificationService;

  beforeEach(() => {
    mockService = createMockNotificationService();
    server = new NotificationsMCPServer(mockService);
  });

  describe('server metadata', () => {
    it('should have name "notifications"', () => {
      expect(server.name).toBe('notifications');
    });

    it('should expose 3 tools', () => {
      expect(server.tools).toHaveLength(3);
    });

    it('should define all expected tool names', () => {
      const toolNames = server.tools.map((t) => t.name);
      expect(toolNames).toContain('send_owner_notification');
      expect(toolNames).toContain('send_customer_message');
      expect(toolNames).toContain('create_escalation');
    });

    it('should have descriptions for all tools', () => {
      for (const tool of server.tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.description.length).toBeGreaterThan(10);
      }
    });

    it('should have inputSchema for all tools', () => {
      for (const tool of server.tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });
  });

  describe('send_owner_notification', () => {
    it('should send notification to owner via notification service', async () => {
      const result = await server.handleToolCall({
        toolName: 'send_owner_notification',
        arguments: {
          type: 'new_order',
          content: 'New order from John: Birthday Cake, 50 servings',
          priority: 'high',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: 'Owner notification sent successfully.',
        type: 'new_order',
        priority: 'high',
      });
      expect(mockService.notifyOwner).toHaveBeenCalledWith({
        type: 'new_order',
        content: 'New order from John: Birthday Cake, 50 servings',
        priority: 'high',
        actions: undefined,
      });
    });

    it('should default priority to "normal" when not provided', async () => {
      const result = await server.handleToolCall({
        toolName: 'send_owner_notification',
        arguments: {
          type: 'daily_summary',
          content: 'Daily summary content',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: 'Owner notification sent successfully.',
        type: 'daily_summary',
        priority: 'normal',
      });
      expect(mockService.notifyOwner).toHaveBeenCalledWith({
        type: 'daily_summary',
        content: 'Daily summary content',
        priority: 'normal',
        actions: undefined,
      });
    });

    it('should pass inline action buttons to notification service', async () => {
      const actions = [
        { text: 'Approve', callbackData: 'approve:order-1' },
        { text: 'Reject', callbackData: 'reject:order-1' },
      ];

      const result = await server.handleToolCall({
        toolName: 'send_owner_notification',
        arguments: {
          type: 'new_order',
          content: 'New order received',
          priority: 'high',
          actions,
        },
      });

      expect(result.success).toBe(true);
      expect(mockService.notifyOwner).toHaveBeenCalledWith({
        type: 'new_order',
        content: 'New order received',
        priority: 'high',
        actions,
      });
    });

    it('should return error when type is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'send_owner_notification',
        arguments: { content: 'Some content' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('type is required');
    });

    it('should return error when content is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'send_owner_notification',
        arguments: { type: 'new_order' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('content is required');
    });

    it('should return error for invalid type', async () => {
      const result = await server.handleToolCall({
        toolName: 'send_owner_notification',
        arguments: { type: 'invalid_type', content: 'test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid type');
    });

    it('should return error for invalid priority', async () => {
      const result = await server.handleToolCall({
        toolName: 'send_owner_notification',
        arguments: { type: 'new_order', content: 'test', priority: 'urgent' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('priority must be "high" or "normal"');
    });

    it('should handle all valid notification types', async () => {
      const types = ['new_order', 'escalation', 'unresponded_alert', 'daily_summary'];

      for (const type of types) {
        const result = await server.handleToolCall({
          toolName: 'send_owner_notification',
          arguments: { type, content: `Test ${type}` },
        });
        expect(result.success).toBe(true);
      }
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.notifyOwner).mockRejectedValue(
        new Error('Telegram API unavailable')
      );

      const result = await server.handleToolCall({
        toolName: 'send_owner_notification',
        arguments: { type: 'new_order', content: 'test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Telegram API unavailable');
    });
  });

  describe('send_customer_message', () => {
    it('should send message to customer via notification service', async () => {
      const result = await server.handleToolCall({
        toolName: 'send_customer_message',
        arguments: {
          customerId: 'cust-123',
          channel: 'whatsapp',
          content: 'Your cake is ready for pickup!',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: 'Customer message sent successfully.',
        customerId: 'cust-123',
        channel: 'whatsapp',
      });
      expect(mockService.notifyCustomer).toHaveBeenCalledWith({
        customerId: 'cust-123',
        channel: 'whatsapp',
        content: 'Your cake is ready for pickup!',
      });
    });

    it('should support all valid channels', async () => {
      const channels = ['whatsapp', 'instagram', 'chat_widget'] as const;

      for (const channel of channels) {
        const result = await server.handleToolCall({
          toolName: 'send_customer_message',
          arguments: {
            customerId: 'cust-1',
            channel,
            content: 'Hello!',
          },
        });
        expect(result.success).toBe(true);
      }
    });

    it('should return error when customerId is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'send_customer_message',
        arguments: { channel: 'whatsapp', content: 'Hello' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('customerId is required');
    });

    it('should return error when channel is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'send_customer_message',
        arguments: { customerId: 'cust-1', content: 'Hello' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('channel is required');
    });

    it('should return error when content is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'send_customer_message',
        arguments: { customerId: 'cust-1', channel: 'whatsapp' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('content is required');
    });

    it('should return error for invalid channel', async () => {
      const result = await server.handleToolCall({
        toolName: 'send_customer_message',
        arguments: {
          customerId: 'cust-1',
          channel: 'email',
          content: 'Hello',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid channel');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.notifyCustomer).mockRejectedValue(
        new Error('Channel delivery failed')
      );

      const result = await server.handleToolCall({
        toolName: 'send_customer_message',
        arguments: {
          customerId: 'cust-1',
          channel: 'whatsapp',
          content: 'Hello',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel delivery failed');
    });
  });

  describe('create_escalation', () => {
    it('should create escalation record and notify owner', async () => {
      const result = await server.handleToolCall({
        toolName: 'create_escalation',
        arguments: {
          reason: 'complex custom design',
          contextSummary: 'Customer wants a 6-tier sculpted dragon cake',
          originatingChannel: 'whatsapp',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        reason: 'complex custom design',
        contextSummary: 'Customer wants a 6-tier sculpted dragon cake',
        originatingChannel: 'whatsapp',
        status: 'pending',
      });
      expect(result.data.id).toBeDefined();
      expect(result.data.createdAt).toBeDefined();

      // Should notify owner with escalation details
      expect(mockService.notifyOwner).toHaveBeenCalledWith({
        type: 'escalation',
        content: expect.stringContaining('complex custom design'),
        priority: 'high',
      });
    });

    it('should store escalation records for retrieval', async () => {
      await server.handleToolCall({
        toolName: 'create_escalation',
        arguments: {
          reason: 'customer requested human',
          contextSummary: 'Customer explicitly asked for owner',
          originatingChannel: 'instagram',
        },
      });

      const escalations = server.getEscalations();
      expect(escalations).toHaveLength(1);
      expect(escalations[0].reason).toBe('customer requested human');
      expect(escalations[0].originatingChannel).toBe('instagram');
    });

    it('should return error when reason is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'create_escalation',
        arguments: {
          contextSummary: 'Some summary',
          originatingChannel: 'whatsapp',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('reason is required');
    });

    it('should return error when contextSummary is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'create_escalation',
        arguments: {
          reason: 'complex design',
          originatingChannel: 'whatsapp',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('contextSummary is required');
    });

    it('should return error when contextSummary exceeds 500 characters', async () => {
      const result = await server.handleToolCall({
        toolName: 'create_escalation',
        arguments: {
          reason: 'complex design',
          contextSummary: 'x'.repeat(501),
          originatingChannel: 'whatsapp',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('500 characters or fewer');
    });

    it('should accept contextSummary at exactly 500 characters', async () => {
      const result = await server.handleToolCall({
        toolName: 'create_escalation',
        arguments: {
          reason: 'complex design',
          contextSummary: 'x'.repeat(500),
          originatingChannel: 'whatsapp',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should return error when originatingChannel is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'create_escalation',
        arguments: {
          reason: 'complex design',
          contextSummary: 'Summary',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('originatingChannel is required');
    });

    it('should return error for invalid originating channel', async () => {
      const result = await server.handleToolCall({
        toolName: 'create_escalation',
        arguments: {
          reason: 'complex design',
          contextSummary: 'Summary',
          originatingChannel: 'email',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid originatingChannel');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.notifyOwner).mockRejectedValue(
        new Error('Notification delivery failed')
      );

      const result = await server.handleToolCall({
        toolName: 'create_escalation',
        arguments: {
          reason: 'complex design',
          contextSummary: 'Summary',
          originatingChannel: 'chat_widget',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Notification delivery failed');
    });
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool name', async () => {
      const result = await server.handleToolCall({
        toolName: 'nonexistent_tool',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool: nonexistent_tool');
    });
  });
});
