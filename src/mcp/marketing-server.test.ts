// =============================================================================
// Unit Tests — MCP Marketing Server
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketingMCPServer } from './marketing-server';
import type {
  MarketingService,
  BudgetAllocation,
  ChannelROI,
  ContentSuggestion,
} from '../types';

function createMockMarketingService(): MarketingService {
  return {
    generateBudgetAllocation: vi.fn(),
    trackConversion: vi.fn(),
    getROIMetrics: vi.fn(),
    generateSeasonalRecommendations: vi.fn(),
    getWeeklyAnalytics: vi.fn(),
    generateContentSuggestions: vi.fn(),
    sendReviewSolicitation: vi.fn(),
  };
}

const mockBudgetAllocation: BudgetAllocation = {
  allocations: [
    { channelId: 'meta-ads', channelName: 'Meta Ads', amount: 30.0 },
    { channelId: 'google-local', channelName: 'Google local search', amount: 25.0 },
    { channelId: 'boosted-instagram', channelName: 'Boosted Instagram posts', amount: 20.0 },
    { channelId: 'organic-content', channelName: 'Organic content', amount: 15.0 },
    { channelId: 'review-generation', channelName: 'Review generation', amount: 10.0 },
  ],
  totalBudget: 100.0,
  month: '2024-06',
  generatedAt: new Date('2024-06-01T00:00:00Z'),
};

const mockChannelMetrics: ChannelROI[] = [
  {
    channelId: 'meta-ads',
    spend: 30.0,
    inquiryCount: 10,
    orderCount: 3,
    costPerInquiry: 3.0,
    costPerOrder: 10.0,
    insufficientData: false,
  },
  {
    channelId: 'google-local',
    spend: 25.0,
    inquiryCount: 2,
    orderCount: 0,
    costPerInquiry: 12.5,
    costPerOrder: undefined,
    insufficientData: true,
  },
];

const mockContentSuggestions: ContentSuggestion[] = [
  {
    topic: 'Summer wedding cake trends',
    format: 'post',
    caption: 'Love is in the air this summer! 🎂✨ Check out our latest wedding cake designs.',
  },
  {
    topic: 'Behind the scenes: Fondant work',
    format: 'story',
    caption: 'Ever wonder how we create those smooth finishes? Watch the magic happen! 🪄',
  },
  {
    topic: 'Customer spotlight: Baby shower cake',
    format: 'reel',
    caption: 'This adorable baby shower cake made everyone smile! 🍼💕',
  },
];

describe('MarketingMCPServer', () => {
  let server: MarketingMCPServer;
  let mockService: MarketingService;

  beforeEach(() => {
    mockService = createMockMarketingService();
    server = new MarketingMCPServer(mockService);
  });

  describe('server metadata', () => {
    it('should have name "marketing"', () => {
      expect(server.name).toBe('marketing');
    });

    it('should expose 3 tools', () => {
      expect(server.tools).toHaveLength(3);
    });

    it('should define all expected tool names', () => {
      const toolNames = server.tools.map((t) => t.name);
      expect(toolNames).toContain('get_channel_metrics');
      expect(toolNames).toContain('get_budget_allocation');
      expect(toolNames).toContain('generate_content_suggestions');
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

  describe('get_channel_metrics', () => {
    it('should return ROI metrics for a valid month', async () => {
      vi.mocked(mockService.getROIMetrics).mockResolvedValue(mockChannelMetrics);

      const result = await server.handleToolCall({
        toolName: 'get_channel_metrics',
        arguments: { month: '2024-06' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockChannelMetrics);
      expect(mockService.getROIMetrics).toHaveBeenCalledWith('2024-06');
    });

    it('should return error when month is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_channel_metrics',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('month is required');
    });

    it('should return error for invalid month format', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_channel_metrics',
        arguments: { month: 'June 2024' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('YYYY-MM format');
    });

    it('should return error for partial month format', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_channel_metrics',
        arguments: { month: '2024' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('YYYY-MM format');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.getROIMetrics).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await server.handleToolCall({
        toolName: 'get_channel_metrics',
        arguments: { month: '2024-06' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('get_budget_allocation', () => {
    it('should return budget allocation', async () => {
      vi.mocked(mockService.generateBudgetAllocation).mockResolvedValue(
        mockBudgetAllocation
      );

      const result = await server.handleToolCall({
        toolName: 'get_budget_allocation',
        arguments: {},
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBudgetAllocation);
      expect(mockService.generateBudgetAllocation).toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.generateBudgetAllocation).mockRejectedValue(
        new Error('Failed to generate allocation')
      );

      const result = await server.handleToolCall({
        toolName: 'get_budget_allocation',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate allocation');
    });
  });

  describe('generate_content_suggestions', () => {
    it('should return content suggestions with default count', async () => {
      vi.mocked(mockService.generateContentSuggestions).mockResolvedValue(
        mockContentSuggestions
      );

      const result = await server.handleToolCall({
        toolName: 'generate_content_suggestions',
        arguments: {},
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockContentSuggestions);
      expect(mockService.generateContentSuggestions).toHaveBeenCalledWith(3);
    });

    it('should return content suggestions with custom count', async () => {
      vi.mocked(mockService.generateContentSuggestions).mockResolvedValue(
        mockContentSuggestions.slice(0, 2)
      );

      const result = await server.handleToolCall({
        toolName: 'generate_content_suggestions',
        arguments: { count: 2 },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockContentSuggestions.slice(0, 2));
      expect(mockService.generateContentSuggestions).toHaveBeenCalledWith(2);
    });

    it('should return error when count is less than 1', async () => {
      const result = await server.handleToolCall({
        toolName: 'generate_content_suggestions',
        arguments: { count: 0 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('count must be between 1 and 20');
    });

    it('should return error when count exceeds 20', async () => {
      const result = await server.handleToolCall({
        toolName: 'generate_content_suggestions',
        arguments: { count: 25 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('count must be between 1 and 20');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.generateContentSuggestions).mockRejectedValue(
        new Error('Content generation unavailable')
      );

      const result = await server.handleToolCall({
        toolName: 'generate_content_suggestions',
        arguments: { count: 3 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Content generation unavailable');
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
