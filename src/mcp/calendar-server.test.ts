// =============================================================================
// Unit Tests — MCP Calendar Server
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CalendarMCPServer } from './calendar-server';
import type { CalendarOrderDataSource, CalendarCatalogDataSource } from './calendar-server';
import type { Order, Product } from '../types';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockOrderDataSource(): CalendarOrderDataSource {
  return {
    getOrdersByDateRange: vi.fn().mockResolvedValue([]),
  };
}

function createMockCatalogDataSource(): CalendarCatalogDataSource {
  return {
    getProduct: vi.fn(),
  };
}

function createMockOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    customerId: 'cust-1',
    state: 'Confirmed',
    eventDate: new Date('2025-03-15T00:00:00.000Z'),
    servings: 30,
    flavorPreference: 'Vanilla',
    designDescription: 'Floral birthday cake',
    budgetRange: '$100-$200',
    originatingChannel: 'chat_widget',
    refundFlagged: false,
    createdAt: new Date('2025-01-10T00:00:00.000Z'),
    updatedAt: new Date('2025-01-10T00:00:00.000Z'),
    ...overrides,
  };
}

function createMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    categoryId: 'cat-1',
    name: 'Classic Birthday Cake',
    descriptionShort: 'A beautiful layered birthday cake.',
    priceMin: 45,
    priceMax: 120,
    minServings: 10,
    maxServings: 50,
    leadTimeDays: 10,
    imageUrl: 'https://example.com/cake.jpg',
    allergenTags: ['nut-free'],
    structuredData: {},
    active: true,
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CalendarMCPServer', () => {
  let server: CalendarMCPServer;
  let mockOrderSource: CalendarOrderDataSource;
  let mockCatalogSource: CalendarCatalogDataSource;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    mockOrderSource = createMockOrderDataSource();
    mockCatalogSource = createMockCatalogDataSource();
    server = new CalendarMCPServer(mockOrderSource, mockCatalogSource);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('server metadata', () => {
    it('should have name "calendar"', () => {
      expect(server.name).toBe('calendar');
    });

    it('should expose 3 tools', () => {
      expect(server.tools).toHaveLength(3);
    });

    it('should define all expected tool names', () => {
      const toolNames = server.tools.map((t) => t.name);
      expect(toolNames).toContain('check_availability');
      expect(toolNames).toContain('get_lead_time');
      expect(toolNames).toContain('get_booked_dates');
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

  describe('check_availability', () => {
    it('should return available for a date with no orders and sufficient lead time', async () => {
      vi.mocked(mockOrderSource.getOrdersByDateRange).mockResolvedValue([]);

      const result = await server.handleToolCall({
        toolName: 'check_availability',
        arguments: { date: '2025-02-01' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        date: '2025-02-01',
        available: true,
        remainingSlots: 3,
      });
    });

    it('should return unavailable when date is within minimum lead time (< 7 days)', async () => {
      const result = await server.handleToolCall({
        toolName: 'check_availability',
        arguments: { date: '2025-01-18' }, // 3 days from 2025-01-15
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        date: '2025-01-18',
        available: false,
      });
      expect((result.data as Record<string, unknown>).reason).toContain('minimum lead time');
    });

    it('should return available when date is exactly 7 days away', async () => {
      vi.mocked(mockOrderSource.getOrdersByDateRange).mockResolvedValue([]);

      const result = await server.handleToolCall({
        toolName: 'check_availability',
        arguments: { date: '2025-01-22' }, // exactly 7 days from 2025-01-15
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).available).toBe(true);
    });

    it('should return unavailable when at capacity (3 orders)', async () => {
      const orders = [
        createMockOrder({ id: 'o-1', eventDate: new Date('2025-02-01T00:00:00.000Z') }),
        createMockOrder({ id: 'o-2', eventDate: new Date('2025-02-01T00:00:00.000Z') }),
        createMockOrder({ id: 'o-3', eventDate: new Date('2025-02-01T00:00:00.000Z') }),
      ];
      vi.mocked(mockOrderSource.getOrdersByDateRange).mockResolvedValue(orders);

      const result = await server.handleToolCall({
        toolName: 'check_availability',
        arguments: { date: '2025-02-01' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        date: '2025-02-01',
        available: false,
      });
      expect((result.data as Record<string, unknown>).reason).toContain('fully booked');
    });

    it('should not count cancelled orders toward capacity', async () => {
      const orders = [
        createMockOrder({ id: 'o-1', eventDate: new Date('2025-02-01T00:00:00.000Z'), state: 'Confirmed' }),
        createMockOrder({ id: 'o-2', eventDate: new Date('2025-02-01T00:00:00.000Z'), state: 'Cancelled' }),
        createMockOrder({ id: 'o-3', eventDate: new Date('2025-02-01T00:00:00.000Z'), state: 'In_Production' }),
      ];
      vi.mocked(mockOrderSource.getOrdersByDateRange).mockResolvedValue(orders);

      const result = await server.handleToolCall({
        toolName: 'check_availability',
        arguments: { date: '2025-02-01' },
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).available).toBe(true);
      expect((result.data as Record<string, unknown>).remainingSlots).toBe(1);
    });

    it('should return error when date is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'check_availability',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('date is required');
    });

    it('should return error for invalid date format', async () => {
      const result = await server.handleToolCall({
        toolName: 'check_availability',
        arguments: { date: '01-15-2025' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('YYYY-MM-DD format');
    });
  });

  describe('get_lead_time', () => {
    it('should return default 7-day lead time when no productId is given', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_lead_time',
        arguments: {},
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        leadTimeDays: 7,
        source: 'default',
      });
    });

    it('should return product-specific lead time when productId is provided', async () => {
      const product = createMockProduct({ leadTimeDays: 14 });
      vi.mocked(mockCatalogSource.getProduct).mockResolvedValue(product);

      const result = await server.handleToolCall({
        toolName: 'get_lead_time',
        arguments: { productId: 'prod-1' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        productId: 'prod-1',
        productName: 'Classic Birthday Cake',
        leadTimeDays: 14,
        source: 'product',
      });
      expect(mockCatalogSource.getProduct).toHaveBeenCalledWith('prod-1');
    });

    it('should enforce minimum 7 days even if product has lower lead time', async () => {
      const product = createMockProduct({ leadTimeDays: 3 });
      vi.mocked(mockCatalogSource.getProduct).mockResolvedValue(product);

      const result = await server.handleToolCall({
        toolName: 'get_lead_time',
        arguments: { productId: 'prod-1' },
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).leadTimeDays).toBe(7);
    });

    it('should handle product not found error', async () => {
      vi.mocked(mockCatalogSource.getProduct).mockRejectedValue(
        new Error('Product not found: No data returned')
      );

      const result = await server.handleToolCall({
        toolName: 'get_lead_time',
        arguments: { productId: 'nonexistent' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Product not found');
    });
  });

  describe('get_booked_dates', () => {
    it('should return empty array when no dates are at capacity', async () => {
      vi.mocked(mockOrderSource.getOrdersByDateRange).mockResolvedValue([
        createMockOrder({ eventDate: new Date('2025-02-01T00:00:00.000Z') }),
      ]);

      const result = await server.handleToolCall({
        toolName: 'get_booked_dates',
        arguments: { startDate: '2025-02-01', endDate: '2025-02-28' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        startDate: '2025-02-01',
        endDate: '2025-02-28',
        bookedDates: [],
        totalBookedDays: 0,
      });
    });

    it('should return dates that are at capacity', async () => {
      const orders = [
        createMockOrder({ id: 'o-1', eventDate: new Date('2025-02-10T00:00:00.000Z') }),
        createMockOrder({ id: 'o-2', eventDate: new Date('2025-02-10T00:00:00.000Z') }),
        createMockOrder({ id: 'o-3', eventDate: new Date('2025-02-10T00:00:00.000Z') }),
        createMockOrder({ id: 'o-4', eventDate: new Date('2025-02-15T00:00:00.000Z') }),
      ];
      vi.mocked(mockOrderSource.getOrdersByDateRange).mockResolvedValue(orders);

      const result = await server.handleToolCall({
        toolName: 'get_booked_dates',
        arguments: { startDate: '2025-02-01', endDate: '2025-02-28' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        bookedDates: ['2025-02-10'],
        totalBookedDays: 1,
      });
    });

    it('should not count cancelled orders', async () => {
      const orders = [
        createMockOrder({ id: 'o-1', eventDate: new Date('2025-02-10T00:00:00.000Z'), state: 'Confirmed' }),
        createMockOrder({ id: 'o-2', eventDate: new Date('2025-02-10T00:00:00.000Z'), state: 'Cancelled' }),
        createMockOrder({ id: 'o-3', eventDate: new Date('2025-02-10T00:00:00.000Z'), state: 'Cancelled' }),
      ];
      vi.mocked(mockOrderSource.getOrdersByDateRange).mockResolvedValue(orders);

      const result = await server.handleToolCall({
        toolName: 'get_booked_dates',
        arguments: { startDate: '2025-02-01', endDate: '2025-02-28' },
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).bookedDates).toEqual([]);
    });

    it('should return sorted booked dates', async () => {
      const orders = [
        createMockOrder({ id: 'o-1', eventDate: new Date('2025-02-20T00:00:00.000Z') }),
        createMockOrder({ id: 'o-2', eventDate: new Date('2025-02-20T00:00:00.000Z') }),
        createMockOrder({ id: 'o-3', eventDate: new Date('2025-02-20T00:00:00.000Z') }),
        createMockOrder({ id: 'o-4', eventDate: new Date('2025-02-10T00:00:00.000Z') }),
        createMockOrder({ id: 'o-5', eventDate: new Date('2025-02-10T00:00:00.000Z') }),
        createMockOrder({ id: 'o-6', eventDate: new Date('2025-02-10T00:00:00.000Z') }),
      ];
      vi.mocked(mockOrderSource.getOrdersByDateRange).mockResolvedValue(orders);

      const result = await server.handleToolCall({
        toolName: 'get_booked_dates',
        arguments: { startDate: '2025-02-01', endDate: '2025-02-28' },
      });

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).bookedDates).toEqual([
        '2025-02-10',
        '2025-02-20',
      ]);
    });

    it('should return error when startDate is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_booked_dates',
        arguments: { endDate: '2025-02-28' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('startDate is required');
    });

    it('should return error when endDate is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_booked_dates',
        arguments: { startDate: '2025-02-01' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('endDate is required');
    });

    it('should return error when endDate is before startDate', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_booked_dates',
        arguments: { startDate: '2025-03-01', endDate: '2025-02-01' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('endDate must be on or after startDate');
    });

    it('should return error for invalid date formats', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_booked_dates',
        arguments: { startDate: 'invalid', endDate: '2025-02-28' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('YYYY-MM-DD format');
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
