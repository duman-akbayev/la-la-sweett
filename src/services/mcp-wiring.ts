// =============================================================================
// La La Sweett Sales System — MCP Wiring Module
// =============================================================================
//
// Connects all 6 MCP servers (Catalog, Orders, Customers, Calendar,
// Notifications, Marketing) to the AI Assistant. Provides an initialization
// function that creates server instances and registers them with the
// AI Assistant's MCP registry.
//
// Requirements: 6.3, 6.4
// =============================================================================

import type { MCPServer } from '@/types';
import { AIAssistantService, aiAssistant } from './ai-assistant';

// Import MCP server factories
import { createCatalogMCPServer } from '@/mcp/catalog-server';
import { createOrdersMCPServer } from '@/mcp/orders-server';
import { createCustomersMCPServer } from '@/mcp/customers-server';
import { createCalendarMCPServer } from '@/mcp/calendar-server';
import { createNotificationsMCPServer } from '@/mcp/notifications-server';
import { createMarketingMCPServer } from '@/mcp/marketing-server';

// -----------------------------------------------------------------------------
// MCP Server Names
// -----------------------------------------------------------------------------

/** All required MCP server names */
export const REQUIRED_MCP_SERVERS = [
  'catalog',
  'orders',
  'customers',
  'calendar',
  'notifications',
  'marketing',
] as const;

export type MCPServerName = (typeof REQUIRED_MCP_SERVERS)[number];

// -----------------------------------------------------------------------------
// Wiring Results
// -----------------------------------------------------------------------------

/** Result of wiring a single MCP server */
export interface MCPWiringResult {
  serverName: string;
  success: boolean;
  error?: string;
}

/** Result of the full MCP wiring initialization */
export interface MCPWiringInitResult {
  totalServers: number;
  successCount: number;
  failureCount: number;
  results: MCPWiringResult[];
  fullyWired: boolean;
}

// -----------------------------------------------------------------------------
// Wiring Functions
// -----------------------------------------------------------------------------

/**
 * Initialize and connect all 6 MCP servers to the provided AI Assistant.
 *
 * Creates instances of each MCP server via their factory functions and
 * registers them with the AI Assistant's MCP registry. Each server is
 * initialized independently — if one fails, the others still connect.
 *
 * @param assistant - The AI Assistant instance to wire servers to. Defaults to singleton.
 * @returns Wiring result with success/failure status for each server.
 */
export async function initializeMCPWiring(
  assistant: AIAssistantService = aiAssistant
): Promise<MCPWiringInitResult> {
  const results: MCPWiringResult[] = [];

  // Create and register each MCP server
  const serverFactories: Array<{ name: MCPServerName; factory: () => Promise<MCPServer> }> = [
    { name: 'catalog', factory: createCatalogMCPServer },
    { name: 'orders', factory: createOrdersMCPServer },
    { name: 'customers', factory: createCustomersMCPServer },
    { name: 'calendar', factory: createCalendarMCPServer },
    { name: 'notifications', factory: createNotificationsMCPServer },
    { name: 'marketing', factory: createMarketingMCPServer },
  ];

  for (const { name, factory } of serverFactories) {
    try {
      const server = await factory();
      assistant.registerMCPServer(server);
      results.push({ serverName: name, success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push({ serverName: name, success: false, error: errorMessage });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return {
    totalServers: serverFactories.length,
    successCount,
    failureCount,
    results,
    fullyWired: assistant.isFullyWired(),
  };
}

/**
 * Wire specific MCP servers to an AI Assistant instance.
 * Useful for testing or partial initialization.
 *
 * @param assistant - The AI Assistant instance
 * @param servers - Array of MCP server instances to register
 */
export function wireMCPServers(
  assistant: AIAssistantService,
  servers: MCPServer[]
): void {
  for (const server of servers) {
    assistant.registerMCPServer(server);
  }
}

/**
 * Verify that all required MCP servers are connected to the AI Assistant.
 *
 * @param assistant - The AI Assistant instance to verify
 * @returns Object with connection status for each required server
 */
export function verifyMCPWiring(
  assistant: AIAssistantService = aiAssistant
): Record<MCPServerName, boolean> {
  const status: Record<string, boolean> = {};
  for (const name of REQUIRED_MCP_SERVERS) {
    status[name] = assistant.getMCPRegistry().hasServer(name);
  }
  return status as Record<MCPServerName, boolean>;
}
