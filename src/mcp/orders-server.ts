// =============================================================================
// MCP Orders Server — Exposes order tools for the AI Assistant
// =============================================================================

import type {
  MCPServer,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  OrderService,
  OrderState,
  OrderIntentData,
  TransitionContext,
} from '../types';

/**
 * MCP Orders Server provides tool access for the AI Assistant
 * to manage orders via the OrderService.
 *
 * Tools:
 * - create_order_intent: Create a new order intent from captured data
 * - get_order_status: Get current status of an order by ID
 * - update_order_state: Transition an order to a new state
 * - get_orders_by_customer: Get all orders for a customer
 * - validate_delivery_zone: Check if an address is within delivery zone
 */
export class OrdersMCPServer implements MCPServer {
  name = 'orders';
  tools: MCPTool[];

  private orderService: OrderService;

  constructor(orderService: OrderService) {
    this.orderService = orderService;
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'create_order_intent',
        description:
          'Creates a new order intent from captured customer data. Requires event date, servings, flavor preference, design description, budget range, and customer contact info. Returns the created order in Inquiry state.',
        inputSchema: {
          type: 'object',
          properties: {
            eventDate: {
              type: 'string',
              description: 'ISO 8601 date string for the event (e.g., "2025-03-15").',
            },
            servings: {
              type: 'number',
              description: 'Number of servings needed (10–500).',
            },
            flavorPreference: {
              type: 'string',
              description: 'Preferred cake flavor (e.g., "Vanilla Bean", "Chocolate Fudge").',
            },
            designDescription: {
              type: 'string',
              description: 'Description of the desired cake design (max 1000 characters).',
            },
            budgetRange: {
              type: 'string',
              description: 'Customer budget range (e.g., "$50-$100", "$100-$200").',
            },
            customerName: {
              type: 'string',
              description: 'Customer full name.',
            },
            customerEmail: {
              type: 'string',
              description: 'Customer email address.',
            },
            customerPhone: {
              type: 'string',
              description: 'Customer phone number.',
            },
          },
          required: [
            'eventDate',
            'servings',
            'flavorPreference',
            'designDescription',
            'budgetRange',
            'customerName',
            'customerEmail',
            'customerPhone',
          ],
          additionalProperties: false,
        },
      },
      {
        name: 'get_order_status',
        description:
          'Retrieves the current status and details of an order by its unique ID. Returns the full order record including state, event date, servings, and pricing information.',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              description: 'The unique identifier of the order.',
            },
          },
          required: ['orderId'],
          additionalProperties: false,
        },
      },
      {
        name: 'update_order_state',
        description:
          'Transitions an order to a new state. Only valid transitions are allowed (e.g., Inquiry→Quoted, Quoted→Deposit_Received). Returns the updated order on success or an error for invalid transitions.',
        inputSchema: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              description: 'The unique identifier of the order to update.',
            },
            newState: {
              type: 'string',
              description:
                'The target state to transition to. Valid states: Inquiry, Quoted, Deposit_Received, Confirmed, In_Production, Ready, Delivered, Picked_Up, Cancelled.',
            },
            triggeredBy: {
              type: 'string',
              description: 'Who or what triggered this transition (e.g., "owner", "system", "customer").',
            },
            reason: {
              type: 'string',
              description: 'Optional reason for the transition (required for cancellations).',
            },
          },
          required: ['orderId', 'newState', 'triggeredBy'],
          additionalProperties: false,
        },
      },
      {
        name: 'get_orders_by_customer',
        description:
          'Retrieves all orders for a given customer, sorted by most recent first. Returns an array of order records.',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: 'The unique identifier of the customer.',
            },
          },
          required: ['customerId'],
          additionalProperties: false,
        },
      },
      {
        name: 'validate_delivery_zone',
        description:
          'Checks whether a delivery address is within the Austin metro delivery zone. Returns whether the address is valid for delivery, and suggests pickup as an alternative if outside the zone.',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'The delivery address to validate (full street address with city and state).',
            },
          },
          required: ['address'],
          additionalProperties: false,
        },
      },
    ];
  }

  async handleToolCall(call: MCPToolCall): Promise<MCPToolResult> {
    try {
      switch (call.toolName) {
        case 'create_order_intent':
          return await this.handleCreateOrderIntent(call.arguments);
        case 'get_order_status':
          return await this.handleGetOrderStatus(call.arguments);
        case 'update_order_state':
          return await this.handleUpdateOrderState(call.arguments);
        case 'get_orders_by_customer':
          return await this.handleGetOrdersByCustomer(call.arguments);
        case 'validate_delivery_zone':
          return await this.handleValidateDeliveryZone(call.arguments);
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

  private async handleCreateOrderIntent(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const eventDate = args.eventDate as string;
    const servings = args.servings as number;
    const flavorPreference = args.flavorPreference as string;
    const designDescription = args.designDescription as string;
    const budgetRange = args.budgetRange as string;
    const customerName = args.customerName as string;
    const customerEmail = args.customerEmail as string;
    const customerPhone = args.customerPhone as string;

    // Validate required fields
    if (!eventDate) {
      return { success: false, error: 'eventDate is required.' };
    }
    if (servings === undefined || servings === null) {
      return { success: false, error: 'servings is required.' };
    }
    if (!flavorPreference) {
      return { success: false, error: 'flavorPreference is required.' };
    }
    if (!designDescription) {
      return { success: false, error: 'designDescription is required.' };
    }
    if (!budgetRange) {
      return { success: false, error: 'budgetRange is required.' };
    }
    if (!customerName) {
      return { success: false, error: 'customerName is required.' };
    }
    if (!customerEmail) {
      return { success: false, error: 'customerEmail is required.' };
    }
    if (!customerPhone) {
      return { success: false, error: 'customerPhone is required.' };
    }

    // Validate servings range
    if (servings < 10 || servings > 500) {
      return { success: false, error: 'servings must be between 10 and 500.' };
    }

    // Validate design description length
    if (designDescription.length > 1000) {
      return { success: false, error: 'designDescription must be 1000 characters or fewer.' };
    }

    const intentData: OrderIntentData = {
      eventDate: new Date(eventDate),
      servings,
      flavorPreference,
      designDescription,
      budgetRange,
      customerName,
      customerEmail,
      customerPhone,
    };

    const order = await this.orderService.createOrderIntent(intentData);
    return {
      success: true,
      data: order,
    };
  }

  private async handleGetOrderStatus(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const orderId = args.orderId as string;
    if (!orderId) {
      return { success: false, error: 'orderId is required.' };
    }

    const order = await this.orderService.getOrder(orderId);
    return {
      success: true,
      data: {
        orderId: order.id,
        state: order.state,
        eventDate: order.eventDate,
        servings: order.servings,
        flavorPreference: order.flavorPreference,
        designDescription: order.designDescription,
        budgetRange: order.budgetRange,
        quotedPrice: order.quotedPrice,
        depositAmount: order.depositAmount,
        deliveryPreference: order.deliveryPreference,
        deliveryAddress: order.deliveryAddress,
        refundFlagged: order.refundFlagged,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    };
  }

  private async handleUpdateOrderState(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const orderId = args.orderId as string;
    const newState = args.newState as string;
    const triggeredBy = args.triggeredBy as string;
    const reason = args.reason as string | undefined;

    if (!orderId) {
      return { success: false, error: 'orderId is required.' };
    }
    if (!newState) {
      return { success: false, error: 'newState is required.' };
    }
    if (!triggeredBy) {
      return { success: false, error: 'triggeredBy is required.' };
    }

    // Validate state value
    const validStates: OrderState[] = [
      'Inquiry',
      'Quoted',
      'Deposit_Received',
      'Confirmed',
      'In_Production',
      'Ready',
      'Delivered',
      'Picked_Up',
      'Cancelled',
    ];
    if (!validStates.includes(newState as OrderState)) {
      return {
        success: false,
        error: `Invalid state: "${newState}". Valid states are: ${validStates.join(', ')}`,
      };
    }

    // Handle cancellation separately (uses cancelOrder with reason)
    if (newState === 'Cancelled') {
      const order = await this.orderService.cancelOrder(orderId, reason ?? 'No reason provided');
      return {
        success: true,
        data: order,
      };
    }

    const context: TransitionContext = {
      triggeredBy,
      timestamp: new Date(),
      metadata: reason ? { reason } : undefined,
    };

    const order = await this.orderService.transitionState(
      orderId,
      newState as OrderState,
      context
    );
    return {
      success: true,
      data: order,
    };
  }

  private async handleGetOrdersByCustomer(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const customerId = args.customerId as string;
    if (!customerId) {
      return { success: false, error: 'customerId is required.' };
    }

    const orders = await this.orderService.getOrdersByCustomer(customerId);
    return {
      success: true,
      data: orders,
    };
  }

  private async handleValidateDeliveryZone(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const address = args.address as string;
    if (!address) {
      return { success: false, error: 'address is required.' };
    }

    // Austin metro area delivery zone validation
    // Checks if the address contains Austin-area city/area identifiers
    const isInZone = isWithinAustinDeliveryZone(address);

    return {
      success: true,
      data: {
        address,
        withinDeliveryZone: isInZone,
        message: isInZone
          ? 'Address is within the Austin metro delivery zone.'
          : 'Address is outside the delivery zone. Free pickup is available at our bakery location as an alternative.',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Austin metro delivery zone validation helper
// ---------------------------------------------------------------------------

/** Austin metro area cities and neighborhoods within delivery zone */
const AUSTIN_DELIVERY_ZONE_AREAS = [
  'austin',
  'round rock',
  'cedar park',
  'pflugerville',
  'georgetown',
  'leander',
  'lakeway',
  'bee cave',
  'west lake hills',
  'westlake',
  'rollingwood',
  'sunset valley',
  'manchaca',
  'manor',
  'del valle',
  'dripping springs',
  'kyle',
  'buda',
  'hutto',
  'taylor',
];

/**
 * Checks if an address is within the Austin metro delivery zone.
 * Uses simple text matching against known Austin-area localities.
 */
export function isWithinAustinDeliveryZone(address: string): boolean {
  const normalizedAddress = address.toLowerCase().trim();

  // Check if any Austin-area locality is mentioned in the address
  return AUSTIN_DELIVERY_ZONE_AREAS.some((area) =>
    normalizedAddress.includes(area)
  );
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Creates an OrdersMCPServer wired to the actual Order Service module.
 * This is the default factory for production use.
 * Uses dynamic import to avoid triggering Supabase initialization at module load.
 */
export async function createOrdersMCPServer(): Promise<OrdersMCPServer> {
  const orderServiceModule = await import('../services/order.service');
  const service: OrderService = {
    createOrderIntent: orderServiceModule.createOrderIntent,
    transitionState: orderServiceModule.transitionState,
    getOrder: orderServiceModule.getOrder,
    getOrdersByCustomer: orderServiceModule.getOrdersByCustomer,
    cancelOrder: orderServiceModule.cancelOrder,
    verifyDeposit: orderServiceModule.verifyDeposit,
  };
  return new OrdersMCPServer(service);
}
