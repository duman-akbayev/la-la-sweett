// =============================================================================
// La La Sweett Sales System — AI Assistant Implementation
// =============================================================================
//
// Conversational AI agent using Claude API that answers customer queries,
// captures order intents, and escalates complex requests. Connects to all MCP
// servers for structured data access (catalog, orders, customers, calendar,
// notifications, marketing) — ensuring responses are grounded in real data
// with no fabrication.
//
// Requirements: 6.2, 6.3, 6.4, 6.8
// =============================================================================

import type {
  InboundMessage,
  AIResponse,
  MCPServer,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  ConversationSession,
} from '@/types';

// -----------------------------------------------------------------------------
// AI Assistant Configuration
// -----------------------------------------------------------------------------

/** La La Sweett brand voice system prompt */
const SYSTEM_PROMPT = `You are the AI assistant for La La Sweett, a custom cakes bakery in Austin, TX. 
You communicate in a warm, creative, personal, and enthusiastic tone — you love talking about cake art!

RULES:
1. ONLY respond with information from your available tools (catalog, orders, calendar, etc.)
2. NEVER fabricate product information, prices, or availability not present in tool responses.
3. If you don't have data to answer a question, say so and offer to connect the customer with the owner.
4. When a customer provides at least 2 order details (event date, servings, flavor, design, budget), capture the order intent.
5. If a request involves multi-tier >5, sculpted 3D, designs not in catalog, or pricing beyond ranges, escalate to the owner.
6. Maintain the La La Sweett brand voice in all responses.
7. Guide customers through the ordering process helpfully and enthusiastically.`;

/** Default response timeout in milliseconds */
const DEFAULT_MAX_RESPONSE_TIME = 5000;

/** Default session timeout in milliseconds (30 minutes) */
const DEFAULT_SESSION_TIMEOUT = 30 * 60 * 1000;

// -----------------------------------------------------------------------------
// Claude API Types (minimal interface for tool use)
// -----------------------------------------------------------------------------

/** A tool definition in Claude API format */
export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** A message in Claude API format */
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

/** Content block types */
export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

/** Claude API response */
export interface ClaudeAPIResponse {
  content: ClaudeContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
}

/** Interface for calling the Claude API */
export interface ClaudeAPIClient {
  createMessage(params: {
    model: string;
    max_tokens: number;
    system: string;
    tools: ClaudeToolDefinition[];
    messages: ClaudeMessage[];
  }): Promise<ClaudeAPIResponse>;
}

// -----------------------------------------------------------------------------
// MCP Registry — Manages all registered MCP servers
// -----------------------------------------------------------------------------

export class MCPRegistry {
  private servers: Map<string, MCPServer> = new Map();

  /** Register an MCP server */
  register(server: MCPServer): void {
    this.servers.set(server.name, server);
  }

  /** Unregister an MCP server */
  unregister(serverName: string): void {
    this.servers.delete(serverName);
  }

  /** Get a registered server by name */
  getServer(serverName: string): MCPServer | undefined {
    return this.servers.get(serverName);
  }

  /** Get all registered servers */
  getAllServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /** Get all registered server names */
  getServerNames(): string[] {
    return Array.from(this.servers.keys());
  }

  /** Check if a server is registered */
  hasServer(serverName: string): boolean {
    return this.servers.has(serverName);
  }

  /** Get all tools from all registered servers, with prefixed names */
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const server of this.servers.values()) {
      for (const tool of server.tools) {
        tools.push({
          name: `${server.name}__${tool.name}`,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }
    }
    return tools;
  }

  /** Convert all MCP tools to Claude API tool definitions */
  getClaudeToolDefinitions(): ClaudeToolDefinition[] {
    return this.getAllTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  /** Route a tool call to the correct MCP server */
  async routeToolCall(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    // Tool names are in format "serverName__toolName"
    const separatorIndex = toolName.indexOf('__');
    if (separatorIndex === -1) {
      return {
        success: false,
        error: `Invalid tool name format: "${toolName}". Expected "serverName__toolName".`,
      };
    }

    const serverName = toolName.slice(0, separatorIndex);
    const actualToolName = toolName.slice(separatorIndex + 2);

    const server = this.servers.get(serverName);
    if (!server) {
      return {
        success: false,
        error: `No MCP server registered with name: "${serverName}".`,
      };
    }

    const call: MCPToolCall = {
      toolName: actualToolName,
      arguments: args,
    };

    return server.handleToolCall(call);
  }

  /** Get the number of registered servers */
  get size(): number {
    return this.servers.size;
  }
}

// -----------------------------------------------------------------------------
// AI Assistant Service
// -----------------------------------------------------------------------------

export class AIAssistantService {
  private mcpRegistry: MCPRegistry;
  private claudeClient: ClaudeAPIClient | null = null;
  private systemPrompt: string;
  private maxResponseTime: number;
  private sessionTimeout: number;
  private model: string;

  constructor(options?: {
    systemPrompt?: string;
    maxResponseTime?: number;
    sessionTimeout?: number;
    model?: string;
  }) {
    this.mcpRegistry = new MCPRegistry();
    this.systemPrompt = options?.systemPrompt ?? SYSTEM_PROMPT;
    this.maxResponseTime = options?.maxResponseTime ?? DEFAULT_MAX_RESPONSE_TIME;
    this.sessionTimeout = options?.sessionTimeout ?? DEFAULT_SESSION_TIMEOUT;
    this.model = options?.model ?? 'claude-sonnet-4-20250514';
  }

  /** Set the Claude API client */
  setClaudeClient(client: ClaudeAPIClient): void {
    this.claudeClient = client;
  }

  /** Get the MCP registry for registering servers */
  getMCPRegistry(): MCPRegistry {
    return this.mcpRegistry;
  }

  /** Register an MCP server */
  registerMCPServer(server: MCPServer): void {
    this.mcpRegistry.register(server);
  }

  /** Get all Claude tool definitions from registered MCP servers */
  getToolDefinitions(): ClaudeToolDefinition[] {
    return this.mcpRegistry.getClaudeToolDefinitions();
  }

  /** Get all registered server names */
  getRegisteredServerNames(): string[] {
    return this.mcpRegistry.getServerNames();
  }

  /** Check if all required MCP servers are connected */
  isFullyWired(): boolean {
    const required = ['catalog', 'orders', 'customers', 'calendar', 'notifications', 'marketing'];
    return required.every((name) => this.mcpRegistry.hasServer(name));
  }

  /**
   * Process a customer message through the AI Assistant.
   * Uses Claude API with MCP tools to generate a grounded response.
   *
   * The AI Assistant:
   * 1. Sends the message to Claude with all MCP tools available
   * 2. If Claude requests tool calls, routes them to the appropriate MCP server
   * 3. Returns the final response based solely on tool results (no fabrication)
   */
  async processMessage(
    message: InboundMessage,
    session?: ConversationSession
  ): Promise<AIResponse> {
    if (!this.claudeClient) {
      return {
        content: "I'm having a moment — let me connect you with our baker! She'll be with you shortly. 🎂",
        actions: [{ type: 'escalate', reason: 'ai_unavailable', summary: 'Claude API client not configured' }],
      };
    }

    const tools = this.getToolDefinitions();

    // Build message history from session if available
    const messages: ClaudeMessage[] = [];
    if (session?.messages) {
      for (const msg of session.messages) {
        messages.push({
          role: msg.role === 'customer' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    // Add the current message
    messages.push({
      role: 'user',
      content: message.content,
    });

    try {
      // Call Claude API with timeout
      const response = await this.callClaudeWithTimeout(tools, messages);
      return this.processClaudeResponse(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: "I'm having a little hiccup right now! Let me connect you with our amazing baker who can help you personally. 🎂",
        actions: [{ type: 'escalate', reason: 'ai_error', summary: `Claude API error: ${errorMessage}` }],
      };
    }
  }

  /**
   * Call Claude API with a timeout.
   * Implements the tool use loop: if Claude returns tool_use, execute the tools
   * and continue the conversation until we get a final text response.
   */
  private async callClaudeWithTimeout(
    tools: ClaudeToolDefinition[],
    messages: ClaudeMessage[]
  ): Promise<ClaudeAPIResponse> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Response timeout')), this.maxResponseTime);
    });

    const responsePromise = this.callClaudeWithToolLoop(tools, messages);
    return Promise.race([responsePromise, timeoutPromise]);
  }

  /**
   * Execute the Claude tool use loop.
   * Keeps calling Claude until it returns a final text response (no more tool calls).
   */
  private async callClaudeWithToolLoop(
    tools: ClaudeToolDefinition[],
    messages: ClaudeMessage[]
  ): Promise<ClaudeAPIResponse> {
    const currentMessages = [...messages];
    let maxIterations = 10; // Safety limit for tool call loops

    while (maxIterations > 0) {
      maxIterations--;

      const response = await this.claudeClient!.createMessage({
        model: this.model,
        max_tokens: 1024,
        system: this.systemPrompt,
        tools,
        messages: currentMessages,
      });

      // If no tool use requested, return the final response
      if (response.stop_reason !== 'tool_use') {
        return response;
      }

      // Process tool calls
      const toolUseBlocks = response.content.filter(
        (block): block is Extract<ClaudeContentBlock, { type: 'tool_use' }> =>
          block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) {
        return response;
      }

      // Add assistant's response (including tool_use blocks) to messages
      currentMessages.push({
        role: 'assistant',
        content: response.content,
      });

      // Execute tool calls and add results
      const toolResults: ClaudeContentBlock[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await this.mcpRegistry.routeToolCall(
          toolUse.name,
          toolUse.input
        );
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Add tool results as user message
      currentMessages.push({
        role: 'user',
        content: toolResults,
      });
    }

    // If we hit the iteration limit, return a fallback
    throw new Error('Too many tool call iterations');
  }

  /**
   * Process the final Claude response into an AIResponse.
   * Extracts text content from the response blocks.
   */
  private processClaudeResponse(response: ClaudeAPIResponse): AIResponse {
    const textBlocks = response.content.filter(
      (block): block is Extract<ClaudeContentBlock, { type: 'text' }> =>
        block.type === 'text'
    );

    const content = textBlocks.map((b) => b.text).join('\n') || '';

    return {
      content,
      actions: undefined,
    };
  }
}

// -----------------------------------------------------------------------------
// Singleton instance and exports
// -----------------------------------------------------------------------------

export const aiAssistant = new AIAssistantService();
