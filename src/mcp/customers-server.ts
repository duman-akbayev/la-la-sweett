// =============================================================================
// MCP Customers Server — Exposes customer tools for the AI Assistant
// =============================================================================

import type {
  MCPServer,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  CustomerService,
} from '../types';

/**
 * MCP Customers Server provides tool access for the AI Assistant
 * to manage customer records via the CustomerService.
 *
 * Tools:
 * - get_customer: Retrieve a customer by ID
 * - create_customer: Create a new customer record
 * - update_customer: Update customer details
 * - delete_customer_pii: Remove PII while preserving order records
 */
export class CustomersMCPServer implements MCPServer {
  name = 'customers';
  tools: MCPTool[];

  private customerService: CustomerService;

  constructor(customerService: CustomerService) {
    this.customerService = customerService;
    this.tools = this.defineTools();
  }

  private defineTools(): MCPTool[] {
    return [
      {
        name: 'get_customer',
        description:
          'Retrieves a customer record by their unique ID. Returns all stored customer fields including name, email, phone, delivery address, and marketing consent status.',
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
        name: 'create_customer',
        description:
          'Creates a new customer record. Only allowed fields (name, email, phone, delivery address, marketing consent) are stored per data minimization policy. Returns the created customer with generated ID.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Customer full name.',
            },
            email: {
              type: 'string',
              description: 'Customer email address.',
            },
            phone: {
              type: 'string',
              description: 'Customer phone number.',
            },
            deliveryAddress: {
              type: 'string',
              description: 'Optional delivery address for the customer.',
            },
            marketingConsent: {
              type: 'boolean',
              description: 'Whether the customer has opted in to marketing communications. Defaults to false.',
            },
            consentTimestamp: {
              type: 'string',
              description: 'ISO 8601 timestamp when marketing consent was given.',
            },
            consentChannel: {
              type: 'string',
              description: 'Channel through which consent was provided (e.g., "web_form", "whatsapp").',
            },
          },
          required: ['name', 'email', 'phone'],
          additionalProperties: false,
        },
      },
      {
        name: 'update_customer',
        description:
          'Updates an existing customer record with partial data. Only allowed fields are considered; unknown fields are silently dropped. Returns the updated customer record.',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: 'The unique identifier of the customer to update.',
            },
            name: {
              type: 'string',
              description: 'Updated customer full name.',
            },
            email: {
              type: 'string',
              description: 'Updated customer email address.',
            },
            phone: {
              type: 'string',
              description: 'Updated customer phone number.',
            },
            deliveryAddress: {
              type: 'string',
              description: 'Updated delivery address.',
            },
            marketingConsent: {
              type: 'boolean',
              description: 'Updated marketing consent status.',
            },
            consentTimestamp: {
              type: 'string',
              description: 'Updated ISO 8601 timestamp for marketing consent.',
            },
            consentChannel: {
              type: 'string',
              description: 'Updated consent channel.',
            },
          },
          required: ['customerId'],
          additionalProperties: false,
        },
      },
      {
        name: 'delete_customer_pii',
        description:
          'Removes personally identifiable information (PII) from a customer record while preserving the record itself for order foreign key references. Sets name to "[deleted]", email to "[deleted]@deleted.local", phone to "0000000000", and clears delivery address.',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: 'The unique identifier of the customer whose PII should be deleted.',
            },
          },
          required: ['customerId'],
          additionalProperties: false,
        },
      },
    ];
  }

  async handleToolCall(call: MCPToolCall): Promise<MCPToolResult> {
    try {
      switch (call.toolName) {
        case 'get_customer':
          return await this.handleGetCustomer(call.arguments);
        case 'create_customer':
          return await this.handleCreateCustomer(call.arguments);
        case 'update_customer':
          return await this.handleUpdateCustomer(call.arguments);
        case 'delete_customer_pii':
          return await this.handleDeleteCustomerPII(call.arguments);
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

  private async handleGetCustomer(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const customerId = args.customerId as string;
    if (!customerId) {
      return {
        success: false,
        error: 'customerId is required.',
      };
    }

    const customer = await this.customerService.getCustomer(customerId);
    return {
      success: true,
      data: customer,
    };
  }

  private async handleCreateCustomer(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const name = args.name as string;
    const email = args.email as string;
    const phone = args.phone as string;

    if (!name) {
      return { success: false, error: 'name is required.' };
    }
    if (!email) {
      return { success: false, error: 'email is required.' };
    }
    if (!phone) {
      return { success: false, error: 'phone is required.' };
    }

    const customerData = {
      name,
      email,
      phone,
      deliveryAddress: (args.deliveryAddress as string) ?? undefined,
      marketingConsent: (args.marketingConsent as boolean) ?? false,
      consentTimestamp: args.consentTimestamp
        ? new Date(args.consentTimestamp as string)
        : undefined,
      consentChannel: (args.consentChannel as string) ?? undefined,
    };

    const customer = await this.customerService.createCustomer(customerData);
    return {
      success: true,
      data: customer,
    };
  }

  private async handleUpdateCustomer(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const customerId = args.customerId as string;
    if (!customerId) {
      return {
        success: false,
        error: 'customerId is required.',
      };
    }

    // Build partial update data from provided fields
    const updateData: Record<string, unknown> = {};
    if (args.name !== undefined) updateData.name = args.name;
    if (args.email !== undefined) updateData.email = args.email;
    if (args.phone !== undefined) updateData.phone = args.phone;
    if (args.deliveryAddress !== undefined) updateData.deliveryAddress = args.deliveryAddress;
    if (args.marketingConsent !== undefined) updateData.marketingConsent = args.marketingConsent;
    if (args.consentTimestamp !== undefined) {
      updateData.consentTimestamp = new Date(args.consentTimestamp as string);
    }
    if (args.consentChannel !== undefined) updateData.consentChannel = args.consentChannel;

    const customer = await this.customerService.updateCustomer(
      customerId,
      updateData
    );
    return {
      success: true,
      data: customer,
    };
  }

  private async handleDeleteCustomerPII(
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const customerId = args.customerId as string;
    if (!customerId) {
      return {
        success: false,
        error: 'customerId is required.',
      };
    }

    await this.customerService.deleteCustomerPII(customerId);
    return {
      success: true,
      data: { message: `PII deleted for customer ${customerId}. Record preserved for order references.` },
    };
  }
}

/**
 * Creates a CustomersMCPServer wired to the actual Customer Service module.
 * This is the default factory for production use.
 * Uses dynamic import to avoid triggering Supabase initialization at module load.
 */
export async function createCustomersMCPServer(): Promise<CustomersMCPServer> {
  const customerServiceModule = await import('../services/customer.service');
  const service: CustomerService = {
    getCustomer: customerServiceModule.getCustomer,
    createCustomer: customerServiceModule.createCustomer,
    updateCustomer: customerServiceModule.updateCustomer,
    deleteCustomerPII: customerServiceModule.deleteCustomerPII,
  };
  return new CustomersMCPServer(service);
}
