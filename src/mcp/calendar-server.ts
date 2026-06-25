// =============================================================================
// MCP Calendar Server — Exposes calendar/availability tools for the AI Assistant
// =============================================================================

import type {
  MCPServer,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  Order,
  Product,
} from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default minimum lead time in days */
const DEFAULT_LEAD_TIME_DAYS = 7;

/** Maximum orders per day (capacity limit) */
const MAX_ORDERS_PER_DAY = 3;

// ---------------------------------------------------------------------------
// Dependency interfaces (injected for testability)
// ---------------------------------------------------------------------------

/** Subset of Order Service needed by the Calendar Server */
export interface CalendarOrderDataSource {
  getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]>;
}

/** Subset of Catalog Service needed by the Calendar Server */
export interface CalendarCatalogDataSource {
  getProduct(productId: string): Promise<Product>;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Parses a date string (YYYY-MM-DD) into a Date at midnight UTC.
 * Returns null if the string is not a valid date format.
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (!match) return null;
  const date = new Date(dateStr + 'T00:00:00.000Z');
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Formats a Date as YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Counts orders per day within a given set of orders.
 * Only counts orders that are NOT cancelled.
 */
function countOrdersByDate(orders: Order[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (order.state === 'Cancelled') continue;
    const dateKey = formatDate(order.eventDate);
    counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// MCP Calendar Server
// ---------------------------------------------------------------------------

/**
 * MCP Calendar Server provides tool access for the AI Assistant
 * to check availability, lead times, and booked dates.
 *
 * Tools:
 * - check_availability: Check if a given date is available for new orders
 * - get_lead_time: Return minimum lead time (7 days default, product-specific if available)
 * - get_booked_dates: Return list of dates that are at capacity within a range
 */
export class CalendarMCPServer implements MCPServer {
  name = 'calendar';
  tools: MCPTool[];

  private orderDataSource: CalendarOrderDataSource;
  private catalogDataSource: CalendarCatalogDataSource;

  constructor(
    orderDataSource: CalendarOrderDataSource,
    catalogDataSource: CalendarCatalogDataSource
  ) {
    this.orderDataSource = orderDataSource;
    this.catalogDataSource = catalogDataSource;
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'check_availability',
        description:
          'Check if a given date is available for new orders. Considers capacity limits and minimum lead time. Returns availability status and reason if unavailable.',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description:
                'The date to check availability for, in YYYY-MM-DD format.',
            },
          },
          required: ['date'],
          additionalProperties: false,
        },
      },
      {
        name: 'get_lead_time',
        description:
          'Return the minimum lead time in days. If a productId is provided, returns the product-specific lead time; otherwise returns the default minimum of 7 days.',
        inputSchema: {
          type: 'object',
          properties: {
            productId: {
              type: 'string',
              description:
                'Optional product ID to get product-specific lead time. If not provided, returns the default 7-day minimum.',
            },
          },
          required: [],
          additionalProperties: false,
        },
      },
      {
        name: 'get_booked_dates',
        description:
          'Return a list of dates within the specified range that are already at capacity (fully booked). Useful for showing unavailable dates on a calendar.',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Start of the date range to check, in YYYY-MM-DD format.',
            },
            endDate: {
              type: 'string',
              description: 'End of the date range to check, in YYYY-MM-DD format.',
            },
          },
          required: ['startDate', 'endDate'],
          additionalProperties: false,
        },
      },
    ];
  }

  async handleToolCall(call: MCPToolCall): Promise<MCPToolResult> {
    try {
      switch (call.toolName) {
        case 'check_availability':
          return await this.handleCheckAvailability(call.arguments);
        case 'get_lead_time':
          return await this.handleGetLeadTime(call.arguments);
        case 'get_booked_dates':
          return await this.handleGetBookedDates(call.arguments);
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

  private async handleCheckAvailability(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const dateStr = args.date as string;
    if (!dateStr) {
      return { success: false, error: 'date is required.' };
    }

    const date = parseDate(dateStr);
    if (!date) {
      return { success: false, error: 'date must be in YYYY-MM-DD format.' };
    }

    // Check lead time requirement (must be at least 7 days from now)
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const diffMs = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < DEFAULT_LEAD_TIME_DAYS) {
      return {
        success: true,
        data: {
          date: dateStr,
          available: false,
          reason: `Date is within the minimum lead time of ${DEFAULT_LEAD_TIME_DAYS} days. Please select a date at least ${DEFAULT_LEAD_TIME_DAYS} days from today.`,
        },
      };
    }

    // Check capacity for the requested date
    const orders = await this.orderDataSource.getOrdersByDateRange(date, date);
    const counts = countOrdersByDate(orders);
    const orderCount = counts.get(dateStr) ?? 0;

    if (orderCount >= MAX_ORDERS_PER_DAY) {
      return {
        success: true,
        data: {
          date: dateStr,
          available: false,
          reason: `Date is fully booked (${MAX_ORDERS_PER_DAY} orders at capacity).`,
        },
      };
    }

    return {
      success: true,
      data: {
        date: dateStr,
        available: true,
        remainingSlots: MAX_ORDERS_PER_DAY - orderCount,
      },
    };
  }

  private async handleGetLeadTime(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const productId = args.productId as string | undefined;

    if (!productId) {
      return {
        success: true,
        data: {
          leadTimeDays: DEFAULT_LEAD_TIME_DAYS,
          source: 'default',
          message: `Minimum lead time is ${DEFAULT_LEAD_TIME_DAYS} days for all custom orders.`,
        },
      };
    }

    // Get product-specific lead time
    const product = await this.catalogDataSource.getProduct(productId);
    const leadTime = Math.max(product.leadTimeDays, DEFAULT_LEAD_TIME_DAYS);

    return {
      success: true,
      data: {
        productId: product.id,
        productName: product.name,
        leadTimeDays: leadTime,
        source: 'product',
        message: `Lead time for "${product.name}" is ${leadTime} days.`,
      },
    };
  }

  private async handleGetBookedDates(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const startDateStr = args.startDate as string;
    const endDateStr = args.endDate as string;

    if (!startDateStr) {
      return { success: false, error: 'startDate is required.' };
    }
    if (!endDateStr) {
      return { success: false, error: 'endDate is required.' };
    }

    const startDate = parseDate(startDateStr);
    const endDate = parseDate(endDateStr);

    if (!startDate) {
      return { success: false, error: 'startDate must be in YYYY-MM-DD format.' };
    }
    if (!endDate) {
      return { success: false, error: 'endDate must be in YYYY-MM-DD format.' };
    }

    if (endDate < startDate) {
      return { success: false, error: 'endDate must be on or after startDate.' };
    }

    // Fetch orders in the date range
    const orders = await this.orderDataSource.getOrdersByDateRange(startDate, endDate);
    const counts = countOrdersByDate(orders);

    // Find dates that are at capacity
    const bookedDates: string[] = [];
    for (const [dateKey, count] of counts.entries()) {
      if (count >= MAX_ORDERS_PER_DAY) {
        bookedDates.push(dateKey);
      }
    }

    // Sort dates chronologically
    bookedDates.sort();

    return {
      success: true,
      data: {
        startDate: startDateStr,
        endDate: endDateStr,
        bookedDates,
        totalBookedDays: bookedDates.length,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Creates a CalendarMCPServer wired to the actual Order and Catalog services.
 * Uses dynamic imports to avoid triggering Supabase initialization at module load.
 */
export async function createCalendarMCPServer(): Promise<CalendarMCPServer> {
  const { getSupabaseAdmin } = await import('../lib/supabase');
  const catalogServiceModule = await import('../services/catalog.service');

  const orderDataSource: CalendarOrderDataSource = {
    async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .gte('event_date', formatDate(startDate))
        .lte('event_date', formatDate(endDate))
        .neq('state', 'Cancelled');

      if (error) {
        throw new Error(`Failed to fetch orders by date range: ${error.message}`);
      }

      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        customerId: row.customer_id as string,
        state: row.state as Order['state'],
        eventDate: new Date(row.event_date as string),
        servings: row.servings as number,
        flavorPreference: row.flavor_preference as string,
        designDescription: row.design_description as string,
        budgetRange: row.budget_range as string,
        quotedPrice: (row.quoted_price as number) ?? undefined,
        depositAmount: (row.deposit_amount as number) ?? undefined,
        deliveryPreference: row.delivery_preference as 'delivery' | 'pickup' | undefined,
        deliveryAddress: (row.delivery_address as string) ?? undefined,
        originatingChannel: row.originating_channel as Order['originatingChannel'],
        cancellationReason: (row.cancellation_reason as string) ?? undefined,
        refundFlagged: row.refund_flagged as boolean,
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
      }));
    },
  };

  const catalogDataSource: CalendarCatalogDataSource = {
    getProduct: catalogServiceModule.getProduct,
  };

  return new CalendarMCPServer(orderDataSource, catalogDataSource);
}
