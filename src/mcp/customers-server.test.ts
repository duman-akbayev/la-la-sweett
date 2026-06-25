// =============================================================================
// Unit Tests — MCP Customers Server
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomersMCPServer } from './customers-server';
import type { CustomerService, Customer } from '../types';

function createMockCustomerService(): CustomerService {
  return {
    getCustomer: vi.fn(),
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    deleteCustomerPII: vi.fn(),
  };
}

const mockCustomer: Customer = {
  id: 'cust-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '5551234567',
  deliveryAddress: '123 Main St, Austin, TX',
  marketingConsent: true,
  consentTimestamp: new Date('2024-01-15T10:00:00Z'),
  consentChannel: 'web_form',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
};

describe('CustomersMCPServer', () => {
  let server: CustomersMCPServer;
  let mockService: CustomerService;

  beforeEach(() => {
    mockService = createMockCustomerService();
    server = new CustomersMCPServer(mockService);
  });

  describe('server metadata', () => {
    it('should have name "customers"', () => {
      expect(server.name).toBe('customers');
    });

    it('should expose 4 tools', () => {
      expect(server.tools).toHaveLength(4);
    });

    it('should define all expected tool names', () => {
      const toolNames = server.tools.map((t) => t.name);
      expect(toolNames).toContain('get_customer');
      expect(toolNames).toContain('create_customer');
      expect(toolNames).toContain('update_customer');
      expect(toolNames).toContain('delete_customer_pii');
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

  describe('get_customer', () => {
    it('should return customer from service', async () => {
      vi.mocked(mockService.getCustomer).mockResolvedValue(mockCustomer);

      const result = await server.handleToolCall({
        toolName: 'get_customer',
        arguments: { customerId: 'cust-1' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCustomer);
      expect(mockService.getCustomer).toHaveBeenCalledWith('cust-1');
    });

    it('should return error when customerId is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'get_customer',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('customerId is required');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.getCustomer).mockRejectedValue(
        new Error('Customer not found: No data returned')
      );

      const result = await server.handleToolCall({
        toolName: 'get_customer',
        arguments: { customerId: 'nonexistent' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer not found: No data returned');
    });
  });

  describe('create_customer', () => {
    it('should create customer with required fields', async () => {
      vi.mocked(mockService.createCustomer).mockResolvedValue(mockCustomer);

      const result = await server.handleToolCall({
        toolName: 'create_customer',
        arguments: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '5551234567',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCustomer);
      expect(mockService.createCustomer).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '5551234567',
        deliveryAddress: undefined,
        marketingConsent: false,
        consentTimestamp: undefined,
        consentChannel: undefined,
      });
    });

    it('should create customer with all optional fields', async () => {
      vi.mocked(mockService.createCustomer).mockResolvedValue(mockCustomer);

      const result = await server.handleToolCall({
        toolName: 'create_customer',
        arguments: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '5551234567',
          deliveryAddress: '123 Main St, Austin, TX',
          marketingConsent: true,
          consentTimestamp: '2024-01-15T10:00:00Z',
          consentChannel: 'web_form',
        },
      });

      expect(result.success).toBe(true);
      expect(mockService.createCustomer).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '5551234567',
        deliveryAddress: '123 Main St, Austin, TX',
        marketingConsent: true,
        consentTimestamp: new Date('2024-01-15T10:00:00Z'),
        consentChannel: 'web_form',
      });
    });

    it('should return error when name is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'create_customer',
        arguments: { email: 'jane@example.com', phone: '5551234567' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('name is required');
    });

    it('should return error when email is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'create_customer',
        arguments: { name: 'Jane Doe', phone: '5551234567' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('email is required');
    });

    it('should return error when phone is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'create_customer',
        arguments: { name: 'Jane Doe', email: 'jane@example.com' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('phone is required');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.createCustomer).mockRejectedValue(
        new Error('Failed to create customer: duplicate email')
      );

      const result = await server.handleToolCall({
        toolName: 'create_customer',
        arguments: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '5551234567',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create customer: duplicate email');
    });
  });

  describe('update_customer', () => {
    const updatedCustomer: Customer = {
      ...mockCustomer,
      name: 'Jane Smith',
      updatedAt: new Date('2024-02-01T12:00:00Z'),
    };

    it('should update customer with partial data', async () => {
      vi.mocked(mockService.updateCustomer).mockResolvedValue(updatedCustomer);

      const result = await server.handleToolCall({
        toolName: 'update_customer',
        arguments: {
          customerId: 'cust-1',
          name: 'Jane Smith',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedCustomer);
      expect(mockService.updateCustomer).toHaveBeenCalledWith('cust-1', {
        name: 'Jane Smith',
      });
    });

    it('should update multiple fields at once', async () => {
      vi.mocked(mockService.updateCustomer).mockResolvedValue(updatedCustomer);

      await server.handleToolCall({
        toolName: 'update_customer',
        arguments: {
          customerId: 'cust-1',
          name: 'Jane Smith',
          email: 'janesmith@example.com',
          marketingConsent: false,
        },
      });

      expect(mockService.updateCustomer).toHaveBeenCalledWith('cust-1', {
        name: 'Jane Smith',
        email: 'janesmith@example.com',
        marketingConsent: false,
      });
    });

    it('should return error when customerId is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'update_customer',
        arguments: { name: 'Jane Smith' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('customerId is required');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.updateCustomer).mockRejectedValue(
        new Error('Failed to update customer: not found')
      );

      const result = await server.handleToolCall({
        toolName: 'update_customer',
        arguments: { customerId: 'nonexistent', name: 'Test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update customer: not found');
    });
  });

  describe('delete_customer_pii', () => {
    it('should delete PII and return success message', async () => {
      vi.mocked(mockService.deleteCustomerPII).mockResolvedValue(undefined);

      const result = await server.handleToolCall({
        toolName: 'delete_customer_pii',
        arguments: { customerId: 'cust-1' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: 'PII deleted for customer cust-1. Record preserved for order references.',
      });
      expect(mockService.deleteCustomerPII).toHaveBeenCalledWith('cust-1');
    });

    it('should return error when customerId is missing', async () => {
      const result = await server.handleToolCall({
        toolName: 'delete_customer_pii',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('customerId is required');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(mockService.deleteCustomerPII).mockRejectedValue(
        new Error('Failed to delete customer PII: database error')
      );

      const result = await server.handleToolCall({
        toolName: 'delete_customer_pii',
        arguments: { customerId: 'cust-1' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to delete customer PII: database error');
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
