// =============================================================================
// MCP Marketing Server — Exposes marketing tools for the AI Assistant
// =============================================================================

import type {
  MCPServer,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MarketingService,
} from '../types';

/**
 * MCP Marketing Server provides tool access for the AI Assistant
 * to query marketing data via the MarketingService.
 *
 * Tools:
 * - get_channel_metrics: Get ROI metrics for a given month
 * - get_budget_allocation: Get monthly budget allocation across 5 channels
 * - generate_content_suggestions: Generate content suggestions for social media
 */
export class MarketingMCPServer implements MCPServer {
  name = 'marketing';
  tools: MCPTool[];

  private marketingService: MarketingService;

  constructor(marketingService: MarketingService) {
    this.marketingService = marketingService;
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'get_channel_metrics',
        description:
          'Returns ROI metrics per marketing channel for a given month, including cost-per-inquiry, cost-per-order, and insufficient data flags.',
        inputSchema: {
          type: 'object',
          properties: {
            month: {
              type: 'string',
              description:
                'The month to retrieve metrics for in YYYY-MM format (e.g., "2024-06").',
            },
          },
          required: ['month'],
          additionalProperties: false,
        },
      },
      {
        name: 'get_budget_allocation',
        description:
          'Returns the monthly budget allocation across 5 marketing channels (Meta Ads, Google local search, boosted Instagram posts, organic content, review generation). Total always sums to $100.00.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
      },
      {
        name: 'generate_content_suggestions',
        description:
          'Generates content suggestions for social media posts in La La Sweett brand voice. Each suggestion includes a topic, format (post/story/reel), and caption draft.',
        inputSchema: {
          type: 'object',
          properties: {
            count: {
              type: 'number',
              description:
                'Number of content suggestions to generate. Defaults to 3.',
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
    ];
  }

  async handleToolCall(call: MCPToolCall): Promise<MCPToolResult> {
    try {
      switch (call.toolName) {
        case 'get_channel_metrics':
          return await this.handleGetChannelMetrics(call.arguments);
        case 'get_budget_allocation':
          return await this.handleGetBudgetAllocation();
        case 'generate_content_suggestions':
          return await this.handleGenerateContentSuggestions(call.arguments);
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

  private async handleGetChannelMetrics(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const month = args.month as string;
    if (!month) {
      return {
        success: false,
        error: 'month is required.',
      };
    }

    // Validate month format (YYYY-MM)
    const monthPattern = /^\d{4}-\d{2}$/;
    if (!monthPattern.test(month)) {
      return {
        success: false,
        error: 'month must be in YYYY-MM format (e.g., "2024-06").',
      };
    }

    const metrics = await this.marketingService.getROIMetrics(month);
    return {
      success: true,
      data: metrics,
    };
  }

  private async handleGetBudgetAllocation(): Promise<MCPToolResult> {
    const allocation = await this.marketingService.generateBudgetAllocation();
    return {
      success: true,
      data: allocation,
    };
  }

  private async handleGenerateContentSuggestions(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const count = (args.count as number) ?? 3;

    if (count < 1 || count > 20) {
      return {
        success: false,
        error: 'count must be between 1 and 20.',
      };
    }

    const suggestions =
      await this.marketingService.generateContentSuggestions(count);
    return {
      success: true,
      data: suggestions,
    };
  }
}

/**
 * Creates a MarketingMCPServer wired to the actual Marketing Service module.
 * This is the default factory for production use.
 * Uses dynamic import to avoid triggering initialization at module load.
 */
export async function createMarketingMCPServer(): Promise<MarketingMCPServer> {
  const marketingServiceModule = await import('../services/marketing.service');
  const service: MarketingService = {
    generateBudgetAllocation:
      marketingServiceModule.marketingService.generateBudgetAllocation.bind(
        marketingServiceModule.marketingService
      ),
    trackConversion:
      marketingServiceModule.marketingService.trackConversion.bind(
        marketingServiceModule.marketingService
      ),
    getROIMetrics: marketingServiceModule.marketingService.getROIMetrics.bind(
      marketingServiceModule.marketingService
    ),
    generateSeasonalRecommendations:
      marketingServiceModule.marketingService.generateSeasonalRecommendations.bind(
        marketingServiceModule.marketingService
      ),
    getWeeklyAnalytics:
      marketingServiceModule.marketingService.getWeeklyAnalytics.bind(
        marketingServiceModule.marketingService
      ),
    generateContentSuggestions:
      marketingServiceModule.marketingService.generateContentSuggestions.bind(
        marketingServiceModule.marketingService
      ),
    sendReviewSolicitation:
      marketingServiceModule.marketingService.sendReviewSolicitation.bind(
        marketingServiceModule.marketingService
      ),
  };
  return new MarketingMCPServer(service);
}
