// =============================================================================
// Unit Tests — MCP Orders Server
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrdersMCPServer, isWithinAustinDeliveryZone } from './orders-server';
import type { OrderService, Order, OrderState } from '../types';

function createMockOrderService(): OrderService {
  return {
    createOrderIntent: vi.fn(),
    transitionState: vi.fn(),
    getOrder: vi.fn(),
    getOrdersByCustomer: vi.fn(),
    cancelOrder: vi.fn(),
    verifyDeposit: vi.fn(),
  };
}

const mockOrder: Order = {
  id: 'order-1',
  customerId: 'cust-1',
  state: 'Inquiry' as OrderState,
  eventDate: new Date('2025-04-15'),
  servings: 50,
  flavorPreference: 'Vanilla Bean',
  designDescription: 'Three-tier white wedding cake with gold accents',
  budgetRange: '$200-$400',
  quotedPrice: undefined,
  depositAmount: undefined,
  deliveryPreference: undefined,
  deliveryAddress: undefined,
  originatingChannel: 'chat_widget',
  cancellationReason: undefined,
  refundFlagged: false,
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
};

describe('OrdersMCPServer', () => {
  let server: OrdersMCPServer;
  let mockService: OrderService;

  beforeEach(() => {
    mockService = createMockOrderService();
    server = new OrdersMCPServer(mockService);
  });

  describe('server metadata', () => {
    it('should have name "orders"', () => {
      expect(server.name).toBe('orders');
    });

    it('should expose 5 tools', () => {
      expect(server.tools).toHaveLength(5);
    });

    it('should define all expected tool names', () => {
      const toolNames = server.tools.map((t) => t.name);
      expect(toolNames).toContain('create_order_intent');
      expect(toolNames).toContain('get_order_status');
      expect(toolNames).toContain('update_order_state');
      expect(toolNames).toContain('get_orders_by_customer');
      expect(toolNames).toContain('validate_delivery_zone');
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

  describe('create_order_intent', () => {
    const validArgs = {
      eventDate: '2025-04-15',
      servings: 50,
      flavorPreference: 'Vanilla Bean',
      designDescription: 'Three-tier white wedding cake with gold accents',
      budgetRange: '$200-$400',
      customerName: 'Maria Garcia',
      customerEmail: 'maria@example.com',
      customerPhone: '5125551234',
    };

    it('should create an order intent with valid data', async () => {
      vi.mocked(mockService.createOrderIntent).mockResolvedValue(mockOrder);

      const result = await server.handleToolCall({
        toolName: 'create_order_intent',
        arguments: validArgs,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOrder);
      expect(mockService.createOrderIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          servings: 50,
          flavorPreference: 'Vanilla Bean',
          designDescription: 'Three-tier white wedding cake with gold accents',
          budgetRange: '$200-$400',
          customerName: 'Maria Garcia',
          customerEmail: 'maria@example.com',
          customerPhone: '5125551234',
        })
      );
    });

    it('should return error when eventDate is missing', async () => {
      const args = { ...validArgs, eventDate: '' };
      const result = await server.handleToolCall({
        toolName: 'create_order_intent',
        arguments: args,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('eventDate is required');
    });

    it('should return error when servings is missing', async () => {
      const args = { ...validArgs, servings: undefined };
      const result = await server.handleToolCall({
        toolName: 'create_order_intent',
        arguments: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('servings is required');
    });

    it('should return error when servings is below 10', async () => {
      const args = { ...validArgs, servings: 5 };
      const result = await server.handleToolCall({
        toolName: 'create_order_intent',
        arguments: args,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('servings must be between 10 and 500');
    });

    it('should return error when servings is above 500', async () => {
      const args = { ...validArgs, servings: 600 };
      const result = await server.handleToolCall({
        toolName: 'create_order_intent',
        arguments: args,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('servings must be between 10 and 500');
    });

    it('should return error when designDescription exceeds 1000 chars', async () => {
      const args = { ...validArgs, designDescription: 'a'.repeat(1001) };
      const result = await server.handleToolCall({
        toolName: 'create_order_intent',
        arguments: args,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('designDescription must be 1000 characters or fewer');
    });

    it('should return error when customerName is missing', async () => {
      const args = { ...validArgs, customerName: '' };
      const result = await server.handleToolCall({
        toolName: 'create_order_intent',
        arguments: args,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('customerName is required');
    });

    it('should return error when customerEmail is missing', async () => {
      const args = { ...validArgs, customerEmail: '' };
      const result = await server.handleToolCall({
        toolName: 'create_order_intent',
        arguments: args,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('customerEmail is required');
    });

    it('should return error when customerPhone is missing', async () => {
      const args = { ...validArgs, customerPhone: '' };
      const result = await server.handleToolCall({
        toolName: 'create_order_intent',
        arguments: args,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('customerPhone is required');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.createOrderIntent).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await server.handleToolCall({
        toolName: 'create_order_intent',
        arguments: validArgs,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('get_order_status', () => {
    it('should return order status by ID', async () => {
      vi.mocked(mockService.getOrder).mockResolvedValue(mockOrder);

      const result = await server.handleToolCall({
        toolName: 'get_order_status',
        arguments: { orderId: 'order-1' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          orderId: 'order-1',
          state: 'Inquiry',
          servings: 50,
        })
      );
      expect(mockService.getOrder).toHaveBeenCalledWith('order-1');
    });

    it('should return error when orderId is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_order_status',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('orderId is required');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.getOrder).mockRejectedValue(
        new Error('Order not found')
      );

      const result = await server.handleToolCall({
        toolName: 'get_order_status',
        arguments: { orderId: 'nonexistent' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });
  });

  describe('update_order_state', () => {
    it('should transition order to a valid state', async () => {
      const updatedOrder = { ...mockOrder, state: 'Quoted' as OrderState };
      vi.mocked(mockService.transitionState).mockResolvedValue(updatedOrder);

      const result = await server.handleToolCall({
        toolName: 'update_order_state',
        arguments: {
          orderId: 'order-1',
          newState: 'Quoted',
          triggeredBy: 'owner',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedOrder);
      expect(mockService.transitionState).toHaveBeenCalledWith(
        'order-1',
        'Quoted',
        expect.objectContaining({ triggeredBy: 'owner' })
      );
    });

    it('should use cancelOrder when transitioning to Cancelled', async () => {
      const cancelledOrder = {
        ...mockOrder,
        state: 'Cancelled' as OrderState,
        cancellationReason: 'Customer changed mind',
      };
      vi.mocked(mockService.cancelOrder).mockResolvedValue(cancelledOrder);

      const result = await server.handleToolCall({
        toolName: 'update_order_state',
        arguments: {
          orderId: 'order-1',
          newState: 'Cancelled',
          triggeredBy: 'customer',
          reason: 'Customer changed mind',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cancelledOrder);
      expect(mockService.cancelOrder).toHaveBeenCalledWith(
        'order-1',
        'Customer changed mind'
      );
    });

    it('should provide default reason for cancellation without reason', async () => {
      const cancelledOrder = { ...mockOrder, state: 'Cancelled' as OrderState };
      vi.mocked(mockService.cancelOrder).mockResolvedValue(cancelledOrder);

      await server.handleToolCall({
        toolName: 'update_order_state',
        arguments: {
          orderId: 'order-1',
          newState: 'Cancelled',
          triggeredBy: 'owner',
        },
      });

      expect(mockService.cancelOrder).toHaveBeenCalledWith(
        'order-1',
        'No reason provided'
      );
    });

    it('should return error when orderId is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'update_order_state',
        arguments: { newState: 'Quoted', triggeredBy: 'owner' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('orderId is required');
    });

    it('should return error when newState is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'update_order_state',
        arguments: { orderId: 'order-1', triggeredBy: 'owner' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('newState is required');
    });

    it('should return error when triggeredBy is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'update_order_state',
        arguments: { orderId: 'order-1', newState: 'Quoted' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('triggeredBy is required');
    });

    it('should return error for invalid state value', async () => {
      const result = await server.handleToolCall({
        toolName: 'update_order_state',
        arguments: {
          orderId: 'order-1',
          newState: 'InvalidState',
          triggeredBy: 'owner',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid state: "InvalidState"');
    });

    it('should handle service errors for invalid transitions', async () => {
      vi.mocked(mockService.transitionState).mockRejectedValue(
        new Error("Invalid state transition from 'Inquiry' to 'Confirmed'")
      );

      const result = await server.handleToolCall({
        toolName: 'update_order_state',
        arguments: {
          orderId: 'order-1',
          newState: 'Confirmed',
          triggeredBy: 'owner',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid state transition');
    });
  });

  describe('get_orders_by_customer', () => {
    it('should return orders for a customer', async () => {
      vi.mocked(mockService.getOrdersByCustomer).mockResolvedValue([mockOrder]);

      const result = await server.handleToolCall({
        toolName: 'get_orders_by_customer',
        arguments: { customerId: 'cust-1' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockOrder]);
      expect(mockService.getOrdersByCustomer).toHaveBeenCalledWith('cust-1');
    });

    it('should return empty array when customer has no orders', async () => {
      vi.mocked(mockService.getOrdersByCustomer).mockResolvedValue([]);

      const result = await server.handleToolCall({
        toolName: 'get_orders_by_customer',
        arguments: { customerId: 'cust-no-orders' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return error when customerId is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_orders_by_customer',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('customerId is required');
    });
  });

  describe('validate_delivery_zone', () => {
    it('should accept addresses within Austin metro area', async () => {
      const result = await server.handleToolCall({
        toolName: 'validate_delivery_zone',
        arguments: { address: '1234 Main St, Austin, TX 78701' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          withinDeliveryZone: true,
        })
      );
    });

    it('should accept addresses in Round Rock', async () => {
      const result = await server.handleToolCall({
        toolName: 'validate_delivery_zone',
        arguments: { address: '500 Oak Blvd, Round Rock, TX 78664' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          withinDeliveryZone: true,
        })
      );
    });

    it('should accept addresses in Cedar Park', async () => {
      const result = await server.handleToolCall({
        toolName: 'validate_delivery_zone',
        arguments: { address: '200 Cypress Creek Rd, Cedar Park, TX 78613' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          withinDeliveryZone: true,
        })
      );
    });

    it('should reject addresses outside the delivery zone', async () => {
      const result = await server.handleToolCall({
        toolName: 'validate_delivery_zone',
        arguments: { address: '100 Main St, Houston, TX 77001' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          withinDeliveryZone: false,
          message: expect.stringContaining('outside the delivery zone'),
        })
      );
    });

    it('should suggest pickup as alternative when outside zone', async () => {
      const result = await server.handleToolCall({
        toolName: 'validate_delivery_zone',
        arguments: { address: '456 Elm St, Dallas, TX 75201' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          withinDeliveryZone: false,
          message: expect.stringContaining('pickup'),
        })
      );
    });

    it('should be case-insensitive for address matching', async () => {
      const result = await server.handleToolCall({
        toolName: 'validate_delivery_zone',
        arguments: { address: '789 Congress Ave, AUSTIN, TX 78701' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          withinDeliveryZone: true,
        })
      );
    });

    it('should return error when address is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'validate_delivery_zone',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('address is required');
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

describe('isWithinAustinDeliveryZone', () => {
  it('should return true for Austin addresses', () => {
    expect(isWithinAustinDeliveryZone('123 Main St, Austin, TX 78701')).toBe(true);
  });

  it('should return true for Pflugerville addresses', () => {
    expect(isWithinAustinDeliveryZone('456 Oak Ave, Pflugerville, TX 78660')).toBe(true);
  });

  it('should return true for Lakeway addresses', () => {
    expect(isWithinAustinDeliveryZone('789 Lake Dr, Lakeway, TX 78734')).toBe(true);
  });

  it('should return false for Houston addresses', () => {
    expect(isWithinAustinDeliveryZone('100 Houston St, Houston, TX 77001')).toBe(false);
  });

  it('should return false for San Antonio addresses', () => {
    expect(isWithinAustinDeliveryZone('200 Alamo Plaza, San Antonio, TX 78205')).toBe(false);
  });

  it('should handle case-insensitive matching', () => {
    expect(isWithinAustinDeliveryZone('ROUND ROCK, TX')).toBe(true);
    expect(isWithinAustinDeliveryZone('Cedar Park')).toBe(true);
  });
});
