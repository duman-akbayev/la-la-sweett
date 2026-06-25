// =============================================================================
// La La Sweett Sales System — Cancellation with Refund Flagging Tests
// Validates: Requirement 13.8
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OrderService, OrderState } from '@/types';
import { VALID_TRANSITIONS, REFUND_FLAG_STATES } from '@/types';

// ---------------------------------------------------------------------------
// Mock Supabase admin client
// ---------------------------------------------------------------------------

type MockResult = { data: unknown; error: unknown };

function createMockQueryBuilder(result: MockResult) {
  const builder: Record<string, unknown> = {};

  builder.select = vi.fn().mockReturnValue(builder);
  builder.insert = vi.fn().mockReturnValue(builder);
  builder.update = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
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
// Test Fixtures
// ---------------------------------------------------------------------------

function createMockOrderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'order-cancel-1',
    customer_id: 'cust-1',
    state: 'Inquiry',
    event_date: '2024-06-15T00:00:00Z',
    servings: 50,
    flavor_preference: 'vanilla',
    design_description: 'Simple birthday cake',
    budget_range: '$100-$200',
    quoted_price: 150,
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

describe('Cancellation with Refund Flagging (Requirement 13.8)', () => {
  let service: OrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFromImpl = () => createMockQueryBuilder({ data: [], error: null });
    service = createOrderService();
  });

  // -------------------------------------------------------------------------
  // Refund flagging: orders cancelled from states where money was paid
  // -------------------------------------------------------------------------

  describe('flags for refund review when cancelled from paid states', () => {
    const paidStates: OrderState[] = ['Deposit_Received', 'Confirmed', 'In_Production'];

    paidStates.forEach((fromState) => {
      it(`sets refund_flagged=true when cancelling from ${fromState}`, async () => {
        const orderRow = createMockOrderRow({ state: fromState });
        let updatePayload: Record<string, unknown> | null = null;

        mockFromImpl = (table: string) => {
          if (table === 'orders') {
            const builder = createMockQueryBuilder({ data: orderRow, error: null });
            builder.update = vi.fn((data: Record<string, unknown>) => {
              updatePayload = data;
              const cancelledRow = createMockOrderRow({
                ...data,
                state: 'Cancelled',
                refund_flagged: true,
                cancellation_reason: 'Customer request',
              });
              return createMockQueryBuilder({ data: cancelledRow, error: null });
            });
            return builder;
          }
          if (table === 'order_state_transitions') {
            return createMockQueryBuilder({ data: null, error: null });
          }
          return createMockQueryBuilder({ data: [], error: null });
        };

        const result = await service.cancelOrder('order-cancel-1', 'Customer request');

        expect(result.state).toBe('Cancelled');
        expect(result.refundFlagged).toBe(true);
        expect(result.cancellationReason).toBe('Customer request');
        // Verify the update payload sent to DB
        expect(updatePayload).not.toBeNull();
        expect(updatePayload!.refund_flagged).toBe(true);
        expect(updatePayload!.state).toBe('Cancelled');
        expect(updatePayload!.cancellation_reason).toBe('Customer request');
      });
    });
  });

  // -------------------------------------------------------------------------
  // No refund flagging: orders cancelled from states where no money exchanged
  // -------------------------------------------------------------------------

  describe('does NOT flag for refund when cancelled from unpaid states', () => {
    const unpaidStates: OrderState[] = ['Inquiry', 'Quoted'];

    unpaidStates.forEach((fromState) => {
      it(`sets refund_flagged=false when cancelling from ${fromState}`, async () => {
        const orderRow = createMockOrderRow({ state: fromState });
        let updatePayload: Record<string, unknown> | null = null;

        mockFromImpl = (table: string) => {
          if (table === 'orders') {
            const builder = createMockQueryBuilder({ data: orderRow, error: null });
            builder.update = vi.fn((data: Record<string, unknown>) => {
              updatePayload = data;
              const cancelledRow = createMockOrderRow({
                ...data,
                state: 'Cancelled',
                refund_flagged: false,
                cancellation_reason: 'Changed mind',
              });
              return createMockQueryBuilder({ data: cancelledRow, error: null });
            });
            return builder;
          }
          if (table === 'order_state_transitions') {
            return createMockQueryBuilder({ data: null, error: null });
          }
          return createMockQueryBuilder({ data: [], error: null });
        };

        const result = await service.cancelOrder('order-cancel-1', 'Changed mind');

        expect(result.state).toBe('Cancelled');
        expect(result.refundFlagged).toBe(false);
        // Verify the update payload sent to DB
        expect(updatePayload).not.toBeNull();
        expect(updatePayload!.refund_flagged).toBe(false);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Cancellation reason recording
  // -------------------------------------------------------------------------

  describe('records cancellation reason', () => {
    it('stores the reason string in the order', async () => {
      const reason = 'Event was postponed indefinitely';
      const orderRow = createMockOrderRow({ state: 'Confirmed' });
      let updatePayload: Record<string, unknown> | null = null;

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          const builder = createMockQueryBuilder({ data: orderRow, error: null });
          builder.update = vi.fn((data: Record<string, unknown>) => {
            updatePayload = data;
            const cancelledRow = createMockOrderRow({
              state: 'Cancelled',
              refund_flagged: true,
              cancellation_reason: reason,
            });
            return createMockQueryBuilder({ data: cancelledRow, error: null });
          });
          return builder;
        }
        if (table === 'order_state_transitions') {
          return createMockQueryBuilder({ data: null, error: null });
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      const result = await service.cancelOrder('order-cancel-1', reason);

      expect(result.cancellationReason).toBe(reason);
      expect(updatePayload!.cancellation_reason).toBe(reason);
    });

    it('includes the reason in the audit trail metadata', async () => {
      const reason = 'Vendor conflict';
      const orderRow = createMockOrderRow({ state: 'Inquiry' });
      let transitionData: Record<string, unknown> | null = null;

      mockFromImpl = (table: string) => {
        if (table === 'orders') {
          const builder = createMockQueryBuilder({ data: orderRow, error: null });
          builder.update = vi.fn(() => {
            const cancelledRow = createMockOrderRow({
              state: 'Cancelled',
              refund_flagged: false,
              cancellation_reason: reason,
            });
            return createMockQueryBuilder({ data: cancelledRow, error: null });
          });
          return builder;
        }
        if (table === 'order_state_transitions') {
          const builder = createMockQueryBuilder({ data: null, error: null });
          builder.insert = vi.fn((data: Record<string, unknown>) => {
            transitionData = data;
            return createMockQueryBuilder({ data: null, error: null });
          });
          return builder;
        }
        return createMockQueryBuilder({ data: [], error: null });
      };

      await service.cancelOrder('order-cancel-1', reason);

      expect(transitionData).not.toBeNull();
      expect(transitionData!.from_state).toBe('Inquiry');
      expect(transitionData!.to_state).toBe('Cancelled');
      const metadata = JSON.parse(transitionData!.metadata as string);
      expect(metadata.reason).toBe(reason);
    });
  });

  // -------------------------------------------------------------------------
  // Rejection from terminal/non-cancellable states
  // -------------------------------------------------------------------------

  describe('rejects cancellation from non-cancellable states', () => {
    const nonCancellableStates: OrderState[] = ['Ready', 'Delivered', 'Picked_Up', 'Cancelled'];

    nonCancellableStates.forEach((fromState) => {
      it(`throws INVALID_TRANSITION when trying to cancel from ${fromState}`, async () => {
        const orderRow = createMockOrderRow({ state: fromState });

        mockFromImpl = (table: string) => {
          if (table === 'orders') {
            return createMockQueryBuilder({ data: orderRow, error: null });
          }
          return createMockQueryBuilder({ data: [], error: null });
        };

        try {
          await service.cancelOrder('order-cancel-1', 'Too late');
          expect.fail('Should have thrown');
        } catch (error: unknown) {
          const err = error as Error & { code?: string };
          expect(err.code).toBe('INVALID_TRANSITION');
          expect(err.message).toContain(`Cannot cancel order from '${fromState}' state`);
        }
      });
    });
  });

  // -------------------------------------------------------------------------
  // REFUND_FLAG_STATES constant verification
  // -------------------------------------------------------------------------

  describe('REFUND_FLAG_STATES constant', () => {
    it('contains exactly Deposit_Received, Confirmed, In_Production', () => {
      expect(REFUND_FLAG_STATES).toHaveLength(3);
      expect(REFUND_FLAG_STATES).toContain('Deposit_Received');
      expect(REFUND_FLAG_STATES).toContain('Confirmed');
      expect(REFUND_FLAG_STATES).toContain('In_Production');
    });

    it('does not contain Inquiry or Quoted', () => {
      expect(REFUND_FLAG_STATES).not.toContain('Inquiry');
      expect(REFUND_FLAG_STATES).not.toContain('Quoted');
    });
  });

  // -------------------------------------------------------------------------
  // VALID_TRANSITIONS includes Cancelled for correct states
  // -------------------------------------------------------------------------

  describe('VALID_TRANSITIONS allows cancellation from correct states', () => {
    const cancellableStates: OrderState[] = [
      'Inquiry', 'Quoted', 'Deposit_Received', 'Confirmed', 'In_Production',
    ];

    cancellableStates.forEach((state) => {
      it(`${state} can transition to Cancelled`, () => {
        expect(VALID_TRANSITIONS[state]).toContain('Cancelled');
      });
    });

    const nonCancellableStates: OrderState[] = ['Ready', 'Delivered', 'Picked_Up', 'Cancelled'];

    nonCancellableStates.forEach((state) => {
      it(`${state} cannot transition to Cancelled`, () => {
        expect(VALID_TRANSITIONS[state]).not.toContain('Cancelled');
      });
    });
  });
});
