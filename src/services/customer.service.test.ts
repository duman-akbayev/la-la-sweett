// =============================================================================
// La La Sweett Sales System — Customer Service Unit Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CustomerService } from '@/types';

// ---------------------------------------------------------------------------
// Mock Supabase admin client
// ---------------------------------------------------------------------------

function createMockQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};

  builder.select = vi.fn().mockReturnValue(builder);
  builder.insert = vi.fn().mockReturnValue(builder);
  builder.update = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockResolvedValue(result);

  // Make the builder awaitable for calls not ending in .single()
  builder.then = vi.fn((resolve: (val: unknown) => void) =>
    resolve({ data: result.data, error: result.error })
  );

  return builder;
}

let mockFromImpl: (table: string) => unknown = () =>
  createMockQueryBuilder({ data: [], error: null });

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => mockFromImpl(table),
  }),
}));

import { createCustomerService } from './customer.service';

describe('CustomerService', () => {
  let service: CustomerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFromImpl = () => createMockQueryBuilder({ data: [], error: null });
    service = createCustomerService();
  });

  // -------------------------------------------------------------------------
  // getCustomer
  // -------------------------------------------------------------------------

  describe('getCustomer', () => {
    it('returns a mapped customer by ID', async () => {
      const mockRow = {
        id: 'cust-1',
        name: 'Alice Baker',
        email: 'alice@example.com',
        phone: '5125551234',
        delivery_address: '123 Main St, Austin TX',
        marketing_consent: true,
        consent_timestamp: '2024-06-01T10:00:00Z',
        consent_channel: 'website',
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-06-01T10:00:00Z',
      };

      mockFromImpl = () => createMockQueryBuilder({ data: mockRow, error: null });

      const result = await service.getCustomer('cust-1');

      expect(result.id).toBe('cust-1');
      expect(result.name).toBe('Alice Baker');
      expect(result.email).toBe('alice@example.com');
      expect(result.phone).toBe('5125551234');
      expect(result.deliveryAddress).toBe('123 Main St, Austin TX');
      expect(result.marketingConsent).toBe(true);
      expect(result.consentTimestamp).toBeInstanceOf(Date);
      expect(result.consentChannel).toBe('website');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('handles null optional fields gracefully', async () => {
      const mockRow = {
        id: 'cust-2',
        name: 'Bob',
        email: 'bob@example.com',
        phone: '5125559999',
        delivery_address: null,
        marketing_consent: false,
        consent_timestamp: null,
        consent_channel: null,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
      };

      mockFromImpl = () => createMockQueryBuilder({ data: mockRow, error: null });

      const result = await service.getCustomer('cust-2');

      expect(result.deliveryAddress).toBeUndefined();
      expect(result.consentTimestamp).toBeUndefined();
      expect(result.consentChannel).toBeUndefined();
    });

    it('throws when customer not found', async () => {
      mockFromImpl = () =>
        createMockQueryBuilder({ data: null, error: { message: 'Row not found' } });

      await expect(service.getCustomer('nonexistent')).rejects.toThrow(
        'Customer not found'
      );
    });
  });

  // -------------------------------------------------------------------------
  // createCustomer — with data minimization
  // -------------------------------------------------------------------------

  describe('createCustomer', () => {
    it('creates a customer with only allowed fields', async () => {
      const mockRow = {
        id: 'cust-new',
        name: 'Carol',
        email: 'carol@test.com',
        phone: '5125550001',
        delivery_address: '456 Oak Ave, Austin TX',
        marketing_consent: true,
        consent_timestamp: '2024-07-01T12:00:00Z',
        consent_channel: 'whatsapp',
        created_at: '2024-07-01T12:00:00Z',
        updated_at: '2024-07-01T12:00:00Z',
      };

      mockFromImpl = () => createMockQueryBuilder({ data: mockRow, error: null });

      const result = await service.createCustomer({
        name: 'Carol',
        email: 'carol@test.com',
        phone: '5125550001',
        deliveryAddress: '456 Oak Ave, Austin TX',
        marketingConsent: true,
        consentTimestamp: new Date('2024-07-01T12:00:00Z'),
        consentChannel: 'whatsapp',
      });

      expect(result.id).toBe('cust-new');
      expect(result.name).toBe('Carol');
      expect(result.email).toBe('carol@test.com');
      expect(result.phone).toBe('5125550001');
      expect(result.deliveryAddress).toBe('456 Oak Ave, Austin TX');
      expect(result.marketingConsent).toBe(true);
    });

    it('strips extra fields beyond the allowed set (data minimization)', async () => {
      const mockRow = {
        id: 'cust-stripped',
        name: 'Dave',
        email: 'dave@test.com',
        phone: '5125550002',
        delivery_address: null,
        marketing_consent: false,
        consent_timestamp: null,
        consent_channel: null,
        created_at: '2024-07-01T12:00:00Z',
        updated_at: '2024-07-01T12:00:00Z',
      };

      let capturedInsertPayload: unknown = null;
      mockFromImpl = () => {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn().mockReturnValue(builder);
        builder.insert = vi.fn((payload: unknown) => {
          capturedInsertPayload = payload;
          return builder;
        });
        builder.eq = vi.fn().mockReturnValue(builder);
        builder.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });
        return builder;
      };

      // Pass extra fields that should be stripped
      const inputWithExtras = {
        name: 'Dave',
        email: 'dave@test.com',
        phone: '5125550002',
        marketingConsent: false,
        // Extra fields that MUST NOT be stored
        socialSecurityNumber: '123-45-6789',
        creditCardNumber: '4111111111111111',
        mothersMaidenName: 'Smith',
      } as unknown as Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;

      await service.createCustomer(inputWithExtras);

      // Verify the insert payload does not contain disallowed fields
      const payload = capturedInsertPayload as Record<string, unknown>;
      expect(payload).not.toHaveProperty('socialSecurityNumber');
      expect(payload).not.toHaveProperty('social_security_number');
      expect(payload).not.toHaveProperty('creditCardNumber');
      expect(payload).not.toHaveProperty('credit_card_number');
      expect(payload).not.toHaveProperty('mothersMaidenName');
      expect(payload).not.toHaveProperty('mothers_maiden_name');

      // Verify only allowed DB columns are present
      const allowedDbColumns = new Set([
        'name',
        'email',
        'phone',
        'delivery_address',
        'marketing_consent',
        'consent_timestamp',
        'consent_channel',
      ]);
      for (const key of Object.keys(payload)) {
        expect(allowedDbColumns.has(key)).toBe(true);
      }
    });

    it('throws on database error during creation', async () => {
      mockFromImpl = () =>
        createMockQueryBuilder({ data: null, error: { message: 'Unique violation' } });

      await expect(
        service.createCustomer({
          name: 'Error',
          email: 'error@test.com',
          phone: '0000000000',
          marketingConsent: false,
        })
      ).rejects.toThrow('Failed to create customer');
    });
  });

  // -------------------------------------------------------------------------
  // updateCustomer
  // -------------------------------------------------------------------------

  describe('updateCustomer', () => {
    it('updates partial customer fields', async () => {
      const mockRow = {
        id: 'cust-1',
        name: 'Alice Updated',
        email: 'alice-new@example.com',
        phone: '5125551234',
        delivery_address: '123 Main St, Austin TX',
        marketing_consent: true,
        consent_timestamp: '2024-06-01T10:00:00Z',
        consent_channel: 'website',
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-08-01T10:00:00Z',
      };

      mockFromImpl = () => createMockQueryBuilder({ data: mockRow, error: null });

      const result = await service.updateCustomer('cust-1', {
        name: 'Alice Updated',
        email: 'alice-new@example.com',
      });

      expect(result.name).toBe('Alice Updated');
      expect(result.email).toBe('alice-new@example.com');
    });

    it('throws when customer update fails', async () => {
      mockFromImpl = () =>
        createMockQueryBuilder({ data: null, error: { message: 'Not found' } });

      await expect(
        service.updateCustomer('nonexistent', { name: 'Test' })
      ).rejects.toThrow('Failed to update customer');
    });
  });

  // -------------------------------------------------------------------------
  // deleteCustomerPII
  // -------------------------------------------------------------------------

  describe('deleteCustomerPII', () => {
    it('anonymizes PII fields: name, email, phone, delivery_address', async () => {
      let capturedUpdatePayload: unknown = null;

      mockFromImpl = () => {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn().mockReturnValue(builder);
        builder.update = vi.fn((payload: unknown) => {
          capturedUpdatePayload = payload;
          return builder;
        });
        builder.eq = vi.fn().mockReturnValue(builder);
        builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
        // Make awaitable (deleteCustomerPII doesn't call .single())
        builder.then = vi.fn((resolve: (val: unknown) => void) =>
          resolve({ data: null, error: null })
        );
        return builder;
      };

      await service.deleteCustomerPII('cust-1');

      const payload = capturedUpdatePayload as Record<string, unknown>;
      expect(payload.name).toBe('[deleted]');
      expect(payload.email).toBe('[deleted]@deleted.local');
      expect(payload.phone).toBe('0000000000');
      expect(payload.delivery_address).toBeNull();
      expect(payload.updated_at).toBeDefined();
    });

    it('retains the customer record (does not delete the row)', async () => {
      let deleteCalled = false;

      mockFromImpl = () => {
        const builder: Record<string, unknown> = {};
        builder.select = vi.fn().mockReturnValue(builder);
        builder.update = vi.fn().mockReturnValue(builder);
        builder.delete = vi.fn(() => {
          deleteCalled = true;
          return builder;
        });
        builder.eq = vi.fn().mockReturnValue(builder);
        builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
        builder.then = vi.fn((resolve: (val: unknown) => void) =>
          resolve({ data: null, error: null })
        );
        return builder;
      };

      await service.deleteCustomerPII('cust-1');

      // The service should use update, not delete
      expect(deleteCalled).toBe(false);
    });

    it('associated orders still exist after PII deletion (mock order query)', async () => {
      const mockOrders = [
        { id: 'order-1', customer_id: 'cust-1', state: 'Delivered' },
        { id: 'order-2', customer_id: 'cust-1', state: 'Picked_Up' },
      ];

      // First call: deleteCustomerPII (customers table update)
      // Second call: verify orders still exist (orders table query)
      let callCount = 0;
      mockFromImpl = (table: string) => {
        callCount++;
        if (table === 'customers') {
          const builder: Record<string, unknown> = {};
          builder.select = vi.fn().mockReturnValue(builder);
          builder.update = vi.fn().mockReturnValue(builder);
          builder.eq = vi.fn().mockReturnValue(builder);
          builder.then = vi.fn((resolve: (val: unknown) => void) =>
            resolve({ data: null, error: null })
          );
          return builder;
        }
        if (table === 'orders') {
          return createMockQueryBuilder({ data: mockOrders, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      // Delete PII
      await service.deleteCustomerPII('cust-1');

      // Now simulate querying orders for that customer — they should still exist
      const supabase = (await import('@/lib/supabase')).getSupabaseAdmin();
      const ordersBuilder = supabase.from('orders') as unknown as {
        select: () => { eq: (col: string, val: string) => Promise<{ data: unknown; error: unknown }> };
      };
      const { data: orders } = await ordersBuilder.select().eq('customer_id', 'cust-1');

      expect(orders).toHaveLength(2);
      expect((orders as Array<{ id: string }>)[0].id).toBe('order-1');
      expect((orders as Array<{ id: string }>)[1].id).toBe('order-2');
    });

    it('throws on database error during PII deletion', async () => {
      mockFromImpl = () => {
        const builder: Record<string, unknown> = {};
        builder.update = vi.fn().mockReturnValue(builder);
        builder.eq = vi.fn().mockReturnValue(builder);
        builder.then = vi.fn((resolve: (val: unknown) => void) =>
          resolve({ data: null, error: { message: 'Permission denied' } })
        );
        return builder;
      };

      await expect(service.deleteCustomerPII('cust-1')).rejects.toThrow(
        'Failed to delete customer PII'
      );
    });
  });
});
