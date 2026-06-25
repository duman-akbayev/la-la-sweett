// =============================================================================
// La La Sweett Sales System — Deposit Verification Tests
// Requirements 13.6, 13.7: Verify deposit ≥ 50% before transitioning to
// Deposit_Received; reject with descriptive error and minimum amount if insufficient.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OrderService } from '@/types';

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

type MockResult = { data: unknown; error: unknown };

function createMockQueryBuilder(result: MockResult) {
  const builder: Record<string, unknown> = {};

  builder.select = vi.fn().mockReturnValue(builder);
  builder.insert = vi.fn().mockReturnValue(builder);
  builder.update = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockResolvedValue(result);

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

import { createOrderService } from './order.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createMockOrderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'order-deposit-1',
    customer_id: 'cust-1',
    state: 'Quoted',
    event_date: '2024-06-15T00:00:00Z',
    servings: 50,
    flavor_preference: 'vanilla',
    design_description: 'Elegant wedding cake',
    budget_range: '$200-$400',
    quoted_price: 300,
    deposit_amount: null,
    delivery_preference: null,
    delivery_address: null,
    originating_channel: 'chat_widget',
    cancellation_reason: null,
    refund_flagged: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Deposit Verification Logic (Requirements 13.6, 13.7)', () => {
  let service: OrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFromImpl = () => createMockQueryBuilder({ data: [], error: null });
    service = createOrderService();
  });

  // -------------------------------------------------------------------------
  // Requirement 13.6: Deposit ≥ 50% transitions to Deposit_Received
  // -------------------------------------------------------------------------

  describe('successful deposit verification (≥ 50%)', () => {
    it('returns valid=true when deposit equals exactly 50% of quoted price', async () => {
      const orderRow = createMockOrderRow({ quoted_price: 200 });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          const builder = createMockQueryBuilder({ data: orderRow, error: null });
          builder.update = vi.fn().mockReturnValue(builder);
          return builder;
        }
        if (table === 'order_state_transitions') {
          return createMockQueryBuilder({ data: null, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.verifyDeposit('order-deposit-1', 100);

      expect(result.valid).toBe(true);
      expect(result.depositAmount).toBe(100);
      expect(result.quotedPrice).toBe(200);
      expect(result.minimumRequired).toBe(100);
    });

    it('returns valid=true when deposit exceeds 50% of quoted price', async () => {
      const orderRow = createMockOrderRow({ quoted_price: 300 });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          const builder = createMockQueryBuilder({ data: orderRow, error: null });
          builder.update = vi.fn().mockReturnValue(builder);
          return builder;
        }
        if (table === 'order_state_transitions') {
          return createMockQueryBuilder({ data: null, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.verifyDeposit('order-deposit-1', 200);

      expect(result.valid).toBe(true);
      expect(result.depositAmount).toBe(200);
      expect(result.minimumRequired).toBe(150);
    });

    it('returns valid=true when full amount is paid as deposit', async () => {
      const orderRow = createMockOrderRow({ quoted_price: 250 });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          const builder = createMockQueryBuilder({ data: orderRow, error: null });
          builder.update = vi.fn().mockReturnValue(builder);
          return builder;
        }
        if (table === 'order_state_transitions') {
          return createMockQueryBuilder({ data: null, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.verifyDeposit('order-deposit-1', 250);

      expect(result.valid).toBe(true);
      expect(result.message).toContain('Deposit meets minimum requirement');
    });

    it('triggers state transition to Deposit_Received on valid deposit', async () => {
      const orderRow = createMockOrderRow({ quoted_price: 200 });
      let updateCalled = false;
      let updateData: Record<string, unknown> | null = null;

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          const builder = createMockQueryBuilder({ data: orderRow, error: null });
          builder.update = vi.fn((data: Record<string, unknown>) => {
            updateCalled = true;
            updateData = data;
            return builder;
          });
          return builder;
        }
        if (table === 'order_state_transitions') {
          return createMockQueryBuilder({ data: null, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await service.verifyDeposit('order-deposit-1', 150);

      expect(updateCalled).toBe(true);
      expect(updateData).toBeTruthy();
      expect(updateData!.state).toBe('Deposit_Received');
      expect(updateData!.deposit_amount).toBe(150);
    });

    it('records audit entry on successful deposit transition', async () => {
      const orderRow = createMockOrderRow({ quoted_price: 400 });
      let transitionData: Record<string, unknown> | null = null;

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          const builder = createMockQueryBuilder({ data: orderRow, error: null });
          builder.update = vi.fn().mockReturnValue(builder);
          return builder;
        }
        if (table === 'order_state_transitions') {
          const builder = createMockQueryBuilder({ data: null, error: null });
          builder.insert = vi.fn((data: Record<string, unknown>) => {
            transitionData = data;
            return builder;
          });
          return builder;
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await service.verifyDeposit('order-deposit-1', 200);

      expect(transitionData).toBeTruthy();
      expect(transitionData!.from_state).toBe('Quoted');
      expect(transitionData!.to_state).toBe('Deposit_Received');
      expect(transitionData!.order_id).toBe('order-deposit-1');
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 13.7: Insufficient deposit rejected with descriptive error
  // -------------------------------------------------------------------------

  describe('insufficient deposit rejection (< 50%)', () => {
    it('returns valid=false when deposit is less than 50%', async () => {
      const orderRow = createMockOrderRow({ quoted_price: 300 });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.verifyDeposit('order-deposit-1', 100);

      expect(result.valid).toBe(false);
      expect(result.depositAmount).toBe(100);
      expect(result.quotedPrice).toBe(300);
      expect(result.minimumRequired).toBe(150);
    });

    it('includes descriptive error message with minimum amount when insufficient', async () => {
      const orderRow = createMockOrderRow({ quoted_price: 500 });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.verifyDeposit('order-deposit-1', 200);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('insufficient');
      expect(result.message).toContain('$250.00'); // minimum required (50% of $500)
      expect(result.message).toContain('$200.00'); // deposit attempted
      expect(result.message).toContain('50%');
    });

    it('does NOT transition state when deposit is insufficient', async () => {
      const orderRow = createMockOrderRow({ quoted_price: 200 });
      let updateCalled = false;

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          const builder = createMockQueryBuilder({ data: orderRow, error: null });
          builder.update = vi.fn(() => {
            updateCalled = true;
            return builder;
          });
          return builder;
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await service.verifyDeposit('order-deposit-1', 50);

      expect(updateCalled).toBe(false);
    });

    it('does NOT record audit entry when deposit is insufficient', async () => {
      const orderRow = createMockOrderRow({ quoted_price: 200 });
      let transitionInsertCalled = false;

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        if (table === 'order_state_transitions') {
          const builder = createMockQueryBuilder({ data: null, error: null });
          builder.insert = vi.fn(() => {
            transitionInsertCalled = true;
            return builder;
          });
          return builder;
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await service.verifyDeposit('order-deposit-1', 50);

      expect(transitionInsertCalled).toBe(false);
    });

    it('returns minimum amount equal to exactly 50% of quoted price', async () => {
      const orderRow = createMockOrderRow({ quoted_price: 175 });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.verifyDeposit('order-deposit-1', 50);

      expect(result.minimumRequired).toBe(87.5); // 175 / 2
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases and error handling
  // -------------------------------------------------------------------------

  describe('edge cases and error handling', () => {
    it('throws when order is not found', async () => {
      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({
            data: null,
            error: { message: 'Not found' },
          });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await expect(service.verifyDeposit('nonexistent', 100)).rejects.toThrow('Order not found');
    });

    it('throws when order has no quoted price (null)', async () => {
      const orderRow = createMockOrderRow({ state: 'Quoted', quoted_price: null });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await expect(service.verifyDeposit('order-deposit-1', 50)).rejects.toThrow(
        'Order does not have a valid quoted price'
      );
    });

    it('throws when order has zero quoted price', async () => {
      const orderRow = createMockOrderRow({ state: 'Quoted', quoted_price: 0 });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await expect(service.verifyDeposit('order-deposit-1', 50)).rejects.toThrow(
        'Order does not have a valid quoted price'
      );
    });

    it('throws INVALID_TRANSITION when order is not in Quoted state', async () => {
      const orderRow = createMockOrderRow({ state: 'Inquiry', quoted_price: 200 });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      try {
        await service.verifyDeposit('order-deposit-1', 100);
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        const err = error as Error & { code?: string };
        expect(err.code).toBe('INVALID_TRANSITION');
        expect(err.message).toContain('Inquiry');
        expect(err.message).toContain('Quoted');
      }
    });

    it('throws INVALID_TRANSITION when order is already in Deposit_Received state', async () => {
      const orderRow = createMockOrderRow({ state: 'Deposit_Received', quoted_price: 200 });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      try {
        await service.verifyDeposit('order-deposit-1', 100);
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        const err = error as Error & { code?: string };
        expect(err.code).toBe('INVALID_TRANSITION');
        expect(err.message).toContain('Deposit_Received');
      }
    });

    it('handles deposit amount at the exact boundary (1 cent below 50%)', async () => {
      const orderRow = createMockOrderRow({ quoted_price: 100 });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      // 49.99 < 50 (50% of 100)
      const result = await service.verifyDeposit('order-deposit-1', 49.99);

      expect(result.valid).toBe(false);
      expect(result.minimumRequired).toBe(50);
    });
  });
});
