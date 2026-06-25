// =============================================================================
// La La Sweett Sales System — Order Service Unit Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OrderService, OrderState } from '@/types';
import { VALID_TRANSITIONS, REFUND_FLAG_STATES } from '@/types';

// ---------------------------------------------------------------------------
// Mock Supabase admin client
// ---------------------------------------------------------------------------

type MockResult = { data: unknown; error: unknown; count?: number | null };

function createMockQueryBuilder(result: MockResult) {
  const builder: Record<string, unknown> = {};

  builder.select = vi.fn().mockReturnValue(builder);
  builder.insert = vi.fn().mockReturnValue(builder);
  builder.update = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.or = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
  builder.range = vi.fn().mockReturnValue(builder);
  builder.limit = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockResolvedValue(result);

  builder.then = vi.fn((resolve: (val: unknown) => void) =>
    resolve({ data: result.data, error: result.error, count: result.count ?? null })
  );

  return builder;
}

let mockFromImpl: (table: string) => unknown = () =>
  createMockQueryBuilder({ data: [], error: null });

// Track inserts for audit verification
let insertedTransitions: unknown[] = [];

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => mockFromImpl(table),
  }),
}));

import { createOrderService } from './order.service';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

const MOCK_CUSTOMER_ROW = {
  id: 'cust-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '5551234567',
  delivery_address: null,
  marketing_consent: false,
  consent_timestamp: null,
  consent_channel: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

function createMockOrderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    state: 'Inquiry',
    event_date: '2024-06-15T00:00:00Z',
    servings: 50,
    flavor_preference: 'chocolate',
    design_description: 'A 3-tier chocolate cake',
    budget_range: '$100-$200',
    quoted_price: null,
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

const MOCK_ORDER_INTENT_DATA = {
  eventDate: new Date('2024-06-15'),
  servings: 50,
  flavorPreference: 'chocolate',
  designDescription: 'A 3-tier chocolate cake',
  budgetRange: '$100-$200',
  customerName: 'Jane Doe',
  customerEmail: 'jane@example.com',
  customerPhone: '5551234567',
};

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    insertedTransitions = [];
    mockFromImpl = () => createMockQueryBuilder({ data: [], error: null });
    service = createOrderService();
  });

  // -------------------------------------------------------------------------
  // createOrderIntent
  // -------------------------------------------------------------------------

  describe('createOrderIntent', () => {
    it('creates an order in Inquiry state and records audit entry', async () => {
      const orderRow = createMockOrderRow();

      mockFromImpl = (table: string) => {
        if (table === 'customers') {
          return createMockQueryBuilder({ data: MOCK_CUSTOMER_ROW, error: null });
        }
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        if (table === 'order_state_transitions') {
          const builder = createMockQueryBuilder({ data: null, error: null });
          const originalInsert = builder.insert as ReturnType<typeof vi.fn>;
          builder.insert = vi.fn((data: unknown) => {
            insertedTransitions.push(data);
            return originalInsert(data);
          });
          return builder;
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.createOrderIntent(MOCK_ORDER_INTENT_DATA);

      expect(result.id).toBe('order-1');
      expect(result.state).toBe('Inquiry');
      expect(result.customerId).toBe('cust-1');
      expect(result.servings).toBe(50);
      expect(result.flavorPreference).toBe('chocolate');
      expect(result.refundFlagged).toBe(false);
    });

    it('creates a new customer if not found by email', async () => {
      let customerInsertCalled = false;
      const orderRow = createMockOrderRow();

      mockFromImpl = (table: string) => {
        if (table === 'customers') {
          if (!customerInsertCalled) {
            // First call: find fails
            customerInsertCalled = true;
            return createMockQueryBuilder({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            });
          }
          // Second call: create succeeds
          return createMockQueryBuilder({ data: MOCK_CUSTOMER_ROW, error: null });
        }
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        if (table === 'order_state_transitions') {
          return createMockQueryBuilder({ data: null, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.createOrderIntent(MOCK_ORDER_INTENT_DATA);
      expect(result.id).toBe('order-1');
      expect(result.customerId).toBe('cust-1');
    });

    it('throws when order insert fails', async () => {
      mockFromImpl = (table: string) => {
        if (table === 'customers') {
          return createMockQueryBuilder({ data: MOCK_CUSTOMER_ROW, error: null });
        }
        if (table === 'orders') {
          return createMockQueryBuilder({
            data: null,
            error: { message: 'Insert failed' },
          });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await expect(service.createOrderIntent(MOCK_ORDER_INTENT_DATA)).rejects.toThrow(
        'Failed to create order intent'
      );
    });
  });

  // -------------------------------------------------------------------------
  // transitionState — Valid transitions
  // -------------------------------------------------------------------------

  describe('transitionState — valid transitions', () => {
    const validPairs: [OrderState, OrderState][] = [
      ['Inquiry', 'Quoted'],
      ['Quoted', 'Deposit_Received'],
      ['Deposit_Received', 'Confirmed'],
      ['Confirmed', 'In_Production'],
      ['In_Production', 'Ready'],
      ['Ready', 'Delivered'],
      ['Ready', 'Picked_Up'],
    ];

    validPairs.forEach(([from, to]) => {
      it(`allows transition from ${from} to ${to}`, async () => {
        const orderRow = createMockOrderRow({ state: from });
        const updatedRow = createMockOrderRow({ state: to });
        let transitionRecorded = false;

        mockFromImpl = (table: string) => {
          if (table === 'orders') {
            const builder = createMockQueryBuilder({ data: orderRow, error: null });
            const originalUpdate = builder.update as ReturnType<typeof vi.fn>;
            builder.update = vi.fn(() => {
              // After update, return the updated row
              const updateBuilder = createMockQueryBuilder({ data: updatedRow, error: null });
              return updateBuilder;
            });
            return builder;
          }
          if (table === 'order_state_transitions') {
            transitionRecorded = true;
            return createMockQueryBuilder({ data: null, error: null });
          }
          return createMockQueryBuilder({ data: [], error: null });
        };

        const context = { triggeredBy: 'owner', timestamp: new Date() };
        const result = await service.transitionState('order-1', to, context);

        expect(result.state).toBe(to);
        expect(transitionRecorded).toBe(true);
      });
    });
  });

  // -------------------------------------------------------------------------
  // transitionState — Invalid transitions
  // -------------------------------------------------------------------------

  describe('transitionState — invalid transitions', () => {
    const invalidPairs: [OrderState, OrderState][] = [
      ['Inquiry', 'Confirmed'],
      ['Inquiry', 'Delivered'],
      ['Quoted', 'In_Production'],
      ['Deposit_Received', 'Ready'],
      ['Confirmed', 'Delivered'],
      ['Ready', 'Cancelled'], // Ready cannot go to Cancelled per VALID_TRANSITIONS
      ['Delivered', 'Cancelled'],
      ['Delivered', 'Ready'],
      ['Picked_Up', 'Cancelled'],
      ['Cancelled', 'Inquiry'],
    ];

    invalidPairs.forEach(([from, to]) => {
      it(`rejects transition from ${from} to ${to} with INVALID_TRANSITION`, async () => {
        const orderRow = createMockOrderRow({ state: from });

        mockFromImpl = (table: string) => {
          if (table === 'orders') {
            return createMockQueryBuilder({ data: orderRow, error: null });
          }
          return createMockQueryBuilder({ data: [], error: null });
        };

        const context = { triggeredBy: 'owner', timestamp: new Date() };

        try {
          await service.transitionState('order-1', to, context);
          expect.fail('Should have thrown');
        } catch (error: unknown) {
          const err = error as Error & { code?: string };
          expect(err.code).toBe('INVALID_TRANSITION');
          expect(err.message).toContain(`Invalid state transition from '${from}' to '${to}'`);
        }
      });
    });
  });

  // -------------------------------------------------------------------------
  // cancelOrder — with refund flagging
  // -------------------------------------------------------------------------

  describe('cancelOrder — refund flagging', () => {
    const refundStates: OrderState[] = ['Deposit_Received', 'Confirmed', 'In_Production'];

    refundStates.forEach((fromState) => {
      it(`sets refund_flagged=true when cancelling from ${fromState}`, async () => {
        const orderRow = createMockOrderRow({ state: fromState });
        const cancelledRow = createMockOrderRow({
          state: 'Cancelled',
          refund_flagged: true,
          cancellation_reason: 'Customer changed plans',
        });

        mockFromImpl = (table: string) => {
          if (table === 'orders') {
            const builder = createMockQueryBuilder({ data: orderRow, error: null });
            const originalUpdate = builder.update as ReturnType<typeof vi.fn>;
            builder.update = vi.fn(() => {
              return createMockQueryBuilder({ data: cancelledRow, error: null });
            });
            return builder;
          }
          if (table === 'order_state_transitions') {
            return createMockQueryBuilder({ data: null, error: null });
          }
          return createMockQueryBuilder({ data: [], error: null });
        };

        const result = await service.cancelOrder('order-1', 'Customer changed plans');
        expect(result.state).toBe('Cancelled');
        expect(result.refundFlagged).toBe(true);
        expect(result.cancellationReason).toBe('Customer changed plans');
      });
    });
  });

  // -------------------------------------------------------------------------
  // cancelOrder — without refund flagging
  // -------------------------------------------------------------------------

  describe('cancelOrder — no refund flagging', () => {
    const noRefundStates: OrderState[] = ['Inquiry', 'Quoted'];

    noRefundStates.forEach((fromState) => {
      it(`sets refund_flagged=false when cancelling from ${fromState}`, async () => {
        const orderRow = createMockOrderRow({ state: fromState });
        const cancelledRow = createMockOrderRow({
          state: 'Cancelled',
          refund_flagged: false,
          cancellation_reason: 'Not interested anymore',
        });

        mockFromImpl = (table: string) => {
          if (table === 'orders') {
            const builder = createMockQueryBuilder({ data: orderRow, error: null });
            const originalUpdate = builder.update as ReturnType<typeof vi.fn>;
            builder.update = vi.fn(() => {
              return createMockQueryBuilder({ data: cancelledRow, error: null });
            });
            return builder;
          }
          if (table === 'order_state_transitions') {
            return createMockQueryBuilder({ data: null, error: null });
          }
          return createMockQueryBuilder({ data: [], error: null });
        };

        const result = await service.cancelOrder('order-1', 'Not interested anymore');
        expect(result.state).toBe('Cancelled');
        expect(result.refundFlagged).toBe(false);
      });
    });
  });

  // -------------------------------------------------------------------------
  // cancelOrder — from terminal states
  // -------------------------------------------------------------------------

  describe('cancelOrder — from terminal states', () => {
    const terminalStates: OrderState[] = ['Delivered', 'Picked_Up', 'Cancelled'];

    terminalStates.forEach((fromState) => {
      it(`rejects cancellation from ${fromState}`, async () => {
        const orderRow = createMockOrderRow({ state: fromState });

        mockFromImpl = (table: string) => {
          if (table === 'orders') {
            return createMockQueryBuilder({ data: orderRow, error: null });
          }
          return createMockQueryBuilder({ data: [], error: null });
        };

        try {
          await service.cancelOrder('order-1', 'Too late');
          expect.fail('Should have thrown');
        } catch (error: unknown) {
          const err = error as Error & { code?: string };
          expect(err.code).toBe('INVALID_TRANSITION');
        }
      });
    });
  });

  // -------------------------------------------------------------------------
  // verifyDeposit
  // -------------------------------------------------------------------------

  describe('verifyDeposit', () => {
    it('returns valid=true when amount >= 50% of quoted price', async () => {
      const orderRow = createMockOrderRow({ state: 'Quoted', quoted_price: 200 });

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

      const result = await service.verifyDeposit('order-1', 100);
      expect(result.valid).toBe(true);
      expect(result.depositAmount).toBe(100);
      expect(result.quotedPrice).toBe(200);
      expect(result.minimumRequired).toBe(100);
    });

    it('returns valid=true when amount is exactly 50%', async () => {
      const orderRow = createMockOrderRow({ state: 'Quoted', quoted_price: 150 });

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

      const result = await service.verifyDeposit('order-1', 75);
      expect(result.valid).toBe(true);
      expect(result.minimumRequired).toBe(75);
    });

    it('returns valid=true when amount exceeds 50%', async () => {
      const orderRow = createMockOrderRow({ state: 'Quoted', quoted_price: 100 });

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

      const result = await service.verifyDeposit('order-1', 80);
      expect(result.valid).toBe(true);
    });

    it('returns valid=false when amount < 50% of quoted price', async () => {
      const orderRow = createMockOrderRow({ state: 'Quoted', quoted_price: 200 });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.verifyDeposit('order-1', 50);
      expect(result.valid).toBe(false);
      expect(result.depositAmount).toBe(50);
      expect(result.quotedPrice).toBe(200);
      expect(result.minimumRequired).toBe(100);
      expect(result.message).toContain('insufficient');
    });

    it('throws when order has no quoted price', async () => {
      const orderRow = createMockOrderRow({ state: 'Quoted', quoted_price: null });

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await expect(service.verifyDeposit('order-1', 50)).rejects.toThrow(
        'Order does not have a valid quoted price'
      );
    });

    it('throws when order not found', async () => {
      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({
            data: null,
            error: { message: 'Not found' },
          });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await expect(service.verifyDeposit('nonexistent', 50)).rejects.toThrow(
        'Order not found'
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
        await service.verifyDeposit('order-1', 100);
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        const err = error as Error & { code?: string };
        expect(err.code).toBe('INVALID_TRANSITION');
        expect(err.message).toContain('Inquiry');
      }
    });
  });

  // -------------------------------------------------------------------------
  // getOrder
  // -------------------------------------------------------------------------

  describe('getOrder', () => {
    it('returns a mapped order by ID', async () => {
      const orderRow = createMockOrderRow();

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orderRow, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.getOrder('order-1');
      expect(result.id).toBe('order-1');
      expect(result.state).toBe('Inquiry');
      expect(result.customerId).toBe('cust-1');
      expect(result.eventDate).toBeInstanceOf(Date);
    });

    it('throws when order not found', async () => {
      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({
            data: null,
            error: { message: 'Not found' },
          });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await expect(service.getOrder('nonexistent')).rejects.toThrow('Order not found');
    });
  });

  // -------------------------------------------------------------------------
  // getOrdersByCustomer
  // -------------------------------------------------------------------------

  describe('getOrdersByCustomer', () => {
    it('returns all orders for a customer', async () => {
      const orders = [
        createMockOrderRow({ id: 'order-1' }),
        createMockOrderRow({ id: 'order-2', state: 'Quoted' }),
      ];

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: orders, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.getOrdersByCustomer('cust-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('order-1');
      expect(result[1].id).toBe('order-2');
    });

    it('returns empty array for customer with no orders', async () => {
      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          return createMockQueryBuilder({ data: [], error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.getOrdersByCustomer('cust-999');
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Audit record creation
  // -------------------------------------------------------------------------

  describe('audit record creation', () => {
    it('records transition with from_state, to_state, triggered_by on successful transition', async () => {
      const orderRow = createMockOrderRow({ state: 'Inquiry' });
      const updatedRow = createMockOrderRow({ state: 'Quoted' });
      let transitionData: unknown = null;

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          const builder = createMockQueryBuilder({ data: orderRow, error: null });
          builder.update = vi.fn(() => {
            return createMockQueryBuilder({ data: updatedRow, error: null });
          });
          return builder;
        }
        if (table === 'order_state_transitions') {
          const builder = createMockQueryBuilder({ data: null, error: null });
          builder.insert = vi.fn((data: unknown) => {
            transitionData = data;
            // Return a thenable that resolves immediately
            return {
              then: (resolve: (val: unknown) => void) => resolve({ data: null, error: null }),
            };
          });
          return builder;
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await service.transitionState('order-1', 'Quoted', {
        triggeredBy: 'owner',
        timestamp: new Date('2024-03-01T12:00:00Z'),
      });

      expect(transitionData).toBeTruthy();
      const recorded = transitionData as Record<string, unknown>;
      expect(recorded.order_id).toBe('order-1');
      expect(recorded.from_state).toBe('Inquiry');
      expect(recorded.to_state).toBe('Quoted');
      expect(recorded.triggered_by).toBe('owner');
      expect(recorded.created_at).toBeDefined();
    });

    it('records audit on cancellation', async () => {
      const orderRow = createMockOrderRow({ state: 'Inquiry' });
      const cancelledRow = createMockOrderRow({
        state: 'Cancelled',
        refund_flagged: false,
        cancellation_reason: 'Test reason',
      });
      let transitionData: unknown = null;

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          const builder = createMockQueryBuilder({ data: orderRow, error: null });
          builder.update = vi.fn(() => {
            return createMockQueryBuilder({ data: cancelledRow, error: null });
          });
          return builder;
        }
        if (table === 'order_state_transitions') {
          const builder = createMockQueryBuilder({ data: null, error: null });
          builder.insert = vi.fn((data: unknown) => {
            transitionData = data;
            return createMockQueryBuilder({ data: null, error: null });
          });
          return builder;
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await service.cancelOrder('order-1', 'Test reason');

      expect(transitionData).toBeTruthy();
      const recorded = transitionData as Record<string, unknown>;
      expect(recorded.from_state).toBe('Inquiry');
      expect(recorded.to_state).toBe('Cancelled');
      expect(recorded.triggered_by).toBe('system');
    });
  });

  // -------------------------------------------------------------------------
  // VALID_TRANSITIONS map coverage
  // -------------------------------------------------------------------------

  describe('VALID_TRANSITIONS map completeness', () => {
    it('all OrderState values are keys in VALID_TRANSITIONS', () => {
      const allStates: OrderState[] = [
        'Inquiry', 'Quoted', 'Deposit_Received', 'Confirmed',
        'In_Production', 'Ready', 'Delivered', 'Picked_Up', 'Cancelled',
      ];

      allStates.forEach((state) => {
        expect(VALID_TRANSITIONS).toHaveProperty(state);
        expect(Array.isArray(VALID_TRANSITIONS[state])).toBe(true);
      });
    });

    it('terminal states have empty transition arrays', () => {
      expect(VALID_TRANSITIONS['Delivered']).toEqual([]);
      expect(VALID_TRANSITIONS['Picked_Up']).toEqual([]);
      expect(VALID_TRANSITIONS['Cancelled']).toEqual([]);
    });

    it('REFUND_FLAG_STATES contains exactly Deposit_Received, Confirmed, In_Production', () => {
      expect(REFUND_FLAG_STATES).toHaveLength(3);
      expect(REFUND_FLAG_STATES).toContain('Deposit_Received');
      expect(REFUND_FLAG_STATES).toContain('Confirmed');
      expect(REFUND_FLAG_STATES).toContain('In_Production');
    });
  });
});
