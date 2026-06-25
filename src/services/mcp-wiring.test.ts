// =============================================================================
// MCP Wiring Tests — Verifies all 6 MCP servers connect to AI Assistant
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type { MCPServer, MCPToolCall, MCPToolResult, MCPTool } from '@/types';
import { AIAssistantService, MCPRegistry } from './ai-assistant';
import { wireMCPServers, verifyMCPWiring, REQUIRED_MCP_SERVERS } from './mcp-wiring';

// -----------------------------------------------------------------------------
// Mock MCP Server factory — creates test servers with defined tools
// -----------------------------------------------------------------------------

function createMockMCPServer(
  name: string,
  toolNames: string[]
): MCPServer {
  const tools: MCPTool[] = toolNames.map((toolName) => ({
    name: toolName,
    description: `Mock tool: ${toolName}`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  }));

  return {
    name,
    tools,
    async handleToolCall(call: MCPToolCall): Promise<MCPToolResult> {
      if (!toolNames.includes(call.toolName)) {
        return { success: false, error: `Unknown tool: ${call.toolName}` };
      }
      return {
        success: true,
        data: { server: name, tool: call.toolName, args: call.arguments },
      };
    },
  };
}

// Create mock servers matching the real MCP server tool definitions
function createAllMockServers(): MCPServer[] {
  return [
    createMockMCPServer('catalog', [
      'get_categories',
      'get_products',
      'get_product_by_id',
      'search_products',
      'get_flavors',
      'get_pricing_range',
      'calculate_servings',
    ]),
    createMockMCPServer('orders', [
      'create_order_intent',
      'get_order_status',
      'update_order_state',
      'get_orders_by_customer',
      'validate_delivery_zone',
    ]),
    createMockMCPServer('customers', [
      'get_customer',
      'create_customer',
      'update_customer',
      'delete_customer_pii',
    ]),
    createMockMCPServer('calendar', [
      'check_availability',
      'get_lead_time',
      'get_booked_dates',
    ]),
    createMockMCPServer('notifications', [
      'send_owner_notification',
      'send_customer_message',
      'create_escalation',
    ]),
    createMockMCPServer('marketing', [
      'get_channel_metrics',
      'get_budget_allocation',
      'generate_content_suggestions',
    ]),
  ];
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('MCPRegistry', () => {
  let registry: MCPRegistry;

  beforeEach(() => {
    registry = new MCPRegistry();
  });

  it('should start with no registered servers', () => {
    expect(registry.size).toBe(0);
    expect(registry.getAllServers()).toEqual([]);
    expect(registry.getServerNames()).toEqual([]);
  });

  it('should register an MCP server', () => {
    const server = createMockMCPServer('catalog', ['get_categories']);
    registry.register(server);

    expect(registry.size).toBe(1);
    expect(registry.hasServer('catalog')).toBe(true);
    expect(registry.getServer('catalog')).toBe(server);
  });

  it('should unregister an MCP server', () => {
    const server = createMockMCPServer('catalog', ['get_categories']);
    registry.register(server);
    registry.unregister('catalog');

    expect(registry.size).toBe(0);
    expect(registry.hasServer('catalog')).toBe(false);
  });

  it('should return all tools with prefixed names', () => {
    const server = createMockMCPServer('catalog', ['get_categories', 'get_products']);
    registry.register(server);

    const tools = registry.getAllTools();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('catalog__get_categories');
    expect(tools[1].name).toBe('catalog__get_products');
  });

  it('should route tool calls to the correct server', async () => {
    const catalogServer = createMockMCPServer('catalog', ['get_categories']);
    const ordersServer = createMockMCPServer('orders', ['get_order_status']);
    registry.register(catalogServer);
    registry.register(ordersServer);

    const result = await registry.routeToolCall('catalog__get_categories', {});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      server: 'catalog',
      tool: 'get_categories',
      args: {},
    });
  });

  it('should return error for invalid tool name format', async () => {
    const result = await registry.routeToolCall('invalid_tool_name', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid tool name format');
  });

  it('should return error for unregistered server', async () => {
    const result = await registry.routeToolCall('unknown__tool', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('No MCP server registered');
  });

  it('should convert tools to Claude API format', () => {
    const server = createMockMCPServer('catalog', ['get_categories']);
    registry.register(server);

    const defs = registry.getClaudeToolDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0]).toEqual({
      name: 'catalog__get_categories',
      description: 'Mock tool: get_categories',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    });
  });
});

describe('AIAssistantService - MCP Wiring', () => {
  let assistant: AIAssistantService;

  beforeEach(() => {
    assistant = new AIAssistantService();
  });

  it('should register all 6 MCP servers', () => {
    const servers = createAllMockServers();
    wireMCPServers(assistant, servers);

    expect(assistant.getRegisteredServerNames().sort()).toEqual(
      [...REQUIRED_MCP_SERVERS].sort()
    );
  });

  it('should report fully wired when all 6 servers are connected', () => {
    const servers = createAllMockServers();
    wireMCPServers(assistant, servers);

    expect(assistant.isFullyWired()).toBe(true);
  });

  it('should report not fully wired when servers are missing', () => {
    const partialServers = [
      createMockMCPServer('catalog', ['get_categories']),
      createMockMCPServer('orders', ['get_order_status']),
    ];
    wireMCPServers(assistant, partialServers);

    expect(assistant.isFullyWired()).toBe(false);
  });

  it('should expose all tools from all servers as Claude tool definitions', () => {
    const servers = createAllMockServers();
    wireMCPServers(assistant, servers);

    const toolDefs = assistant.getToolDefinitions();

    // Total tools: 7 catalog + 5 orders + 4 customers + 3 calendar + 3 notifications + 3 marketing = 25
    expect(toolDefs).toHaveLength(25);

    // Verify tool names are prefixed with server name
    const catalogTools = toolDefs.filter((t) => t.name.startsWith('catalog__'));
    expect(catalogTools).toHaveLength(7);

    const ordersTools = toolDefs.filter((t) => t.name.startsWith('orders__'));
    expect(ordersTools).toHaveLength(5);

    const customersTools = toolDefs.filter((t) => t.name.startsWith('customers__'));
    expect(customersTools).toHaveLength(4);

    const calendarTools = toolDefs.filter((t) => t.name.startsWith('calendar__'));
    expect(calendarTools).toHaveLength(3);

    const notificationsTools = toolDefs.filter((t) => t.name.startsWith('notifications__'));
    expect(notificationsTools).toHaveLength(3);

    const marketingTools = toolDefs.filter((t) => t.name.startsWith('marketing__'));
    expect(marketingTools).toHaveLength(3);
  });

  it('should route tool calls to correct MCP server and return response', async () => {
    const servers = createAllMockServers();
    wireMCPServers(assistant, servers);

    const registry = assistant.getMCPRegistry();

    // Test routing to catalog server
    const catalogResult = await registry.routeToolCall('catalog__get_categories', {});
    expect(catalogResult.success).toBe(true);
    expect(catalogResult.data).toEqual({
      server: 'catalog',
      tool: 'get_categories',
      args: {},
    });

    // Test routing to orders server
    const ordersResult = await registry.routeToolCall('orders__get_order_status', {
      orderId: 'order-123',
    });
    expect(ordersResult.success).toBe(true);
    expect(ordersResult.data).toEqual({
      server: 'orders',
      tool: 'get_order_status',
      args: { orderId: 'order-123' },
    });

    // Test routing to customers server
    const customersResult = await registry.routeToolCall('customers__get_customer', {
      customerId: 'cust-456',
    });
    expect(customersResult.success).toBe(true);
    expect(customersResult.data).toEqual({
      server: 'customers',
      tool: 'get_customer',
      args: { customerId: 'cust-456' },
    });

    // Test routing to calendar server
    const calendarResult = await registry.routeToolCall('calendar__check_availability', {
      date: '2025-08-15',
    });
    expect(calendarResult.success).toBe(true);
    expect(calendarResult.data).toEqual({
      server: 'calendar',
      tool: 'check_availability',
      args: { date: '2025-08-15' },
    });

    // Test routing to notifications server
    const notifResult = await registry.routeToolCall('notifications__send_owner_notification', {
      type: 'new_order',
      content: 'New order!',
    });
    expect(notifResult.success).toBe(true);
    expect(notifResult.data).toEqual({
      server: 'notifications',
      tool: 'send_owner_notification',
      args: { type: 'new_order', content: 'New order!' },
    });

    // Test routing to marketing server
    const marketingResult = await registry.routeToolCall('marketing__get_budget_allocation', {});
    expect(marketingResult.success).toBe(true);
    expect(marketingResult.data).toEqual({
      server: 'marketing',
      tool: 'get_budget_allocation',
      args: {},
    });
  });

  it('should return error when routing to unknown tool', async () => {
    const servers = createAllMockServers();
    wireMCPServers(assistant, servers);

    const registry = assistant.getMCPRegistry();
    const result = await registry.routeToolCall('catalog__nonexistent_tool', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tool');
  });
});

describe('verifyMCPWiring', () => {
  it('should show all servers as disconnected when none wired', () => {
    const assistant = new AIAssistantService();
    const status = verifyMCPWiring(assistant);

    expect(status.catalog).toBe(false);
    expect(status.orders).toBe(false);
    expect(status.customers).toBe(false);
    expect(status.calendar).toBe(false);
    expect(status.notifications).toBe(false);
    expect(status.marketing).toBe(false);
  });

  it('should show all servers as connected when fully wired', () => {
    const assistant = new AIAssistantService();
    const servers = createAllMockServers();
    wireMCPServers(assistant, servers);

    const status = verifyMCPWiring(assistant);

    expect(status.catalog).toBe(true);
    expect(status.orders).toBe(true);
    expect(status.customers).toBe(true);
    expect(status.calendar).toBe(true);
    expect(status.notifications).toBe(true);
    expect(status.marketing).toBe(true);
  });

  it('should correctly report partial wiring', () => {
    const assistant = new AIAssistantService();
    wireMCPServers(assistant, [
      createMockMCPServer('catalog', ['get_categories']),
      createMockMCPServer('notifications', ['send_owner_notification']),
    ]);

    const status = verifyMCPWiring(assistant);

    expect(status.catalog).toBe(true);
    expect(status.orders).toBe(false);
    expect(status.customers).toBe(false);
    expect(status.calendar).toBe(false);
    expect(status.notifications).toBe(true);
    expect(status.marketing).toBe(false);
  });
});

describe('AIAssistantService - Data-Only Response Guarantee', () => {
  let assistant: AIAssistantService;

  beforeEach(() => {
    assistant = new AIAssistantService();
    const servers = createAllMockServers();
    wireMCPServers(assistant, servers);
  });

  it('should return fallback response when Claude client is not configured', async () => {
    const message = {
      id: 'msg-1',
      channel: 'chat_widget' as const,
      senderId: 'user-1',
      content: 'What flavors do you have?',
      timestamp: new Date(),
      metadata: {},
    };

    const response = await assistant.processMessage(message);

    // Should return a graceful fallback, not fabricated data
    expect(response.content).toBeTruthy();
    expect(response.actions).toBeDefined();
    expect(response.actions![0].type).toBe('escalate');
  });

  it('should process messages through Claude when client is configured', async () => {
    // Mock Claude client that returns a tool_use response then a final text response
    const mockClient = {
      createMessage: async (params: Record<string, unknown>) => {
        const messages = params.messages as Array<{ role: string; content: unknown }>;
        const lastMessage = messages[messages.length - 1];

        // If it's a tool_result message, return final text
        if (
          typeof lastMessage.content !== 'string' &&
          Array.isArray(lastMessage.content) &&
          lastMessage.content[0]?.type === 'tool_result'
        ) {
          return {
            content: [{ type: 'text', text: 'We have Vanilla, Chocolate, and Red Velvet flavors available!' }],
            stop_reason: 'end_turn',
          };
        }

        // First call — request a tool use
        return {
          content: [
            { type: 'tool_use', id: 'call-1', name: 'catalog__get_flavors', input: {} },
          ],
          stop_reason: 'tool_use',
        };
      },
    };

    assistant.setClaudeClient(mockClient);

    const message = {
      id: 'msg-2',
      channel: 'whatsapp' as const,
      senderId: 'user-2',
      content: 'What flavors do you have?',
      timestamp: new Date(),
      metadata: {},
    };

    const response = await assistant.processMessage(message);

    // Response should be from Claude (grounded in tool results)
    expect(response.content).toContain('Vanilla');
    expect(response.content).toContain('Chocolate');
  });

  it('should pass tool arguments correctly during tool use loop', async () => {
    const capturedToolCalls: Array<{ name: string; input: Record<string, unknown> }> = [];

    const mockClient = {
      createMessage: async (params: Record<string, unknown>) => {
        const messages = params.messages as Array<{ role: string; content: unknown }>;
        const lastMessage = messages[messages.length - 1];

        if (
          typeof lastMessage.content !== 'string' &&
          Array.isArray(lastMessage.content) &&
          lastMessage.content[0]?.type === 'tool_result'
        ) {
          return {
            content: [{ type: 'text', text: 'The order status is: In Production' }],
            stop_reason: 'end_turn',
          };
        }

        return {
          content: [
            {
              type: 'tool_use',
              id: 'call-2',
              name: 'orders__get_order_status',
              input: { orderId: 'order-abc' },
            },
          ],
          stop_reason: 'tool_use',
        };
      },
    };

    // Wrap the mock server to capture calls
    const ordersServer = createMockMCPServer('orders', ['get_order_status']);
    const originalHandleToolCall = ordersServer.handleToolCall.bind(ordersServer);
    ordersServer.handleToolCall = async (call: MCPToolCall) => {
      capturedToolCalls.push({ name: call.toolName, input: call.arguments });
      return originalHandleToolCall(call);
    };

    // Replace the orders server
    const serversWithoutOrders = createAllMockServers().filter((s) => s.name !== 'orders');
    const freshAssistant = new AIAssistantService();
    wireMCPServers(freshAssistant, [...serversWithoutOrders, ordersServer]);
    freshAssistant.setClaudeClient(mockClient);

    const message = {
      id: 'msg-3',
      channel: 'instagram' as const,
      senderId: 'user-3',
      content: 'What is the status of my order?',
      timestamp: new Date(),
      metadata: {},
    };

    await freshAssistant.processMessage(message);

    // Verify the tool call was routed with correct arguments
    expect(capturedToolCalls).toHaveLength(1);
    expect(capturedToolCalls[0].name).toBe('get_order_status');
    expect(capturedToolCalls[0].input).toEqual({ orderId: 'order-abc' });
  });
});
