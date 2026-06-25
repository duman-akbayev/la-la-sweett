// =============================================================================
// La La Sweett Sales System — Order Service Implementation
// =============================================================================

import { getSupabaseAdmin } from '@/lib/supabase';
import type {
  Order,
  OrderState,
  OrderIntentData,
  TransitionContext,
  OrderStateTransition,
  DepositVerification,
  OrderService as IOrderService,
  Customer,
} from '@/types';
import { VALID_TRANSITIONS, REFUND_FLAG_STATES } from '@/types';
import { isInDeliveryZone } from './delivery-zone.service';

// ---------------------------------------------------------------------------
// Helper: Map database row to domain Order
// ---------------------------------------------------------------------------

function mapRowToOrder(row: {
  id: string;
  customer_id: string;
  state: string;
  event_date: string;
  servings: number;
  flavor_preference: string;
  design_description: string;
  budget_range: string;
  quoted_price: number | null;
  deposit_amount: number | null;
  delivery_preference: string | null;
  delivery_address: string | null;
  originating_channel: string;
  cancellation_reason: string | null;
  refund_flagged: boolean;
  created_at: string;
  updated_at: string;
}): Order {
  return {
    id: row.id,
    customerId: row.customer_id,
    state: row.state as OrderState,
    eventDate: new Date(row.event_date),
    servings: row.servings,
    flavorPreference: row.flavor_preference,
    designDescription: row.design_description,
    budgetRange: row.budget_range,
    quotedPrice: row.quoted_price ?? undefined,
    depositAmount: row.deposit_amount ?? undefined,
    deliveryPreference: row.delivery_preference as 'delivery' | 'pickup' | undefined,
    deliveryAddress: row.delivery_address ?? undefined,
    originatingChannel: row.originating_channel as Order['originatingChannel'],
    cancellationReason: row.cancellation_reason ?? undefined,
    refundFlagged: row.refund_flagged,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Creates a new order in 'Inquiry' state.
 * Also creates or finds the customer record.
 */
export async function createOrderIntent(data: OrderIntentData): Promise<Order> {
  const supabase = getSupabaseAdmin();

  // Find or create customer
  const customer = await findOrCreateCustomer(data);

  // Insert order record in 'Inquiry' state
  const now = new Date().toISOString();
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: customer.id,
      state: 'Inquiry' as OrderState,
      event_date: data.eventDate instanceof Date ? data.eventDate.toISOString() : data.eventDate,
      servings: data.servings,
      flavor_preference: data.flavorPreference,
      design_description: data.designDescription,
      budget_range: data.budgetRange,
      originating_channel: 'chat_widget', // Default; can be overridden
      refund_flagged: false,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (orderError || !orderRow) {
    throw new Error(`Failed to create order intent: ${orderError?.message ?? 'No data returned'}`);
  }

  // Record initial state transition audit entry
  await recordTransition(orderRow.id, null, 'Inquiry', 'system');

  return mapRowToOrder(orderRow);
}

/**
 * Transitions an order to a new state after validating the transition is allowed.
 * Creates an OrderStateTransition audit record on success.
 */
export async function transitionState(
  orderId: string,
  newState: OrderState,
  context: TransitionContext
): Promise<Order> {
  const supabase = getSupabaseAdmin();

  // Fetch current order
  const { data: orderRow, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchError || !orderRow) {
    throw new Error(`Order not found: ${fetchError?.message ?? 'No data returned'}`);
  }

  const currentState = orderRow.state as OrderState;

  // Validate transition
  const allowedTransitions = VALID_TRANSITIONS[currentState];
  if (!allowedTransitions || !allowedTransitions.includes(newState)) {
    const error = new Error(
      `Invalid state transition from '${currentState}' to '${newState}'`
    );
    (error as Error & { code?: string }).code = 'INVALID_TRANSITION';
    throw error;
  }

  // Delivery zone validation: reject Confirmed transition if delivery address is outside zone
  if (newState === 'Confirmed' && orderRow.delivery_preference === 'delivery') {
    const deliveryAddress = orderRow.delivery_address as string | null;
    if (!deliveryAddress) {
      const error = new Error(
        'Cannot confirm order for delivery without a delivery address. Please provide an address within the Austin metro area or select pickup instead.'
      );
      (error as Error & { code?: string }).code = 'DELIVERY_ZONE_INVALID';
      throw error;
    }

    const zoneResult = isInDeliveryZone(deliveryAddress);
    if (!zoneResult.isValid) {
      const error = new Error(
        zoneResult.suggestion ??
          'Delivery address is outside the Austin metro delivery zone. Please select pickup instead.'
      );
      (error as Error & { code?: string }).code = 'DELIVERY_ZONE_INVALID';
      throw error;
    }
  }

  // Update order state
  const now = new Date().toISOString();
  const { data: updatedRow, error: updateError } = await supabase
    .from('orders')
    .update({ state: newState, updated_at: now })
    .eq('id', orderId)
    .select()
    .single();

  if (updateError || !updatedRow) {
    throw new Error(`Failed to update order state: ${updateError?.message ?? 'No data returned'}`);
  }

  // Record audit entry
  await recordTransition(orderId, currentState, newState, context.triggeredBy, context.metadata);

  return mapRowToOrder(updatedRow);
}

/**
 * Fetches a single order by ID.
 */
export async function getOrder(orderId: string): Promise<Order> {
  const supabase = getSupabaseAdmin();

  const { data: orderRow, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error || !orderRow) {
    throw new Error(`Order not found: ${error?.message ?? 'No data returned'}`);
  }

  return mapRowToOrder(orderRow);
}

/**
 * Fetches all orders for a given customer.
 */
export async function getOrdersByCustomer(customerId: string): Promise<Order[]> {
  const supabase = getSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return (rows ?? []).map(mapRowToOrder);
}

/**
 * Cancels an order. If current state is in REFUND_FLAG_STATES, sets refund_flagged=true.
 */
export async function cancelOrder(orderId: string, reason: string): Promise<Order> {
  const supabase = getSupabaseAdmin();

  // Fetch current order
  const { data: orderRow, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchError || !orderRow) {
    throw new Error(`Order not found: ${fetchError?.message ?? 'No data returned'}`);
  }

  const currentState = orderRow.state as OrderState;

  // Validate that cancellation is allowed from this state
  const allowedTransitions = VALID_TRANSITIONS[currentState];
  if (!allowedTransitions || !allowedTransitions.includes('Cancelled')) {
    const error = new Error(
      `Cannot cancel order from '${currentState}' state`
    );
    (error as Error & { code?: string }).code = 'INVALID_TRANSITION';
    throw error;
  }

  // Determine if refund should be flagged
  const shouldFlagRefund = REFUND_FLAG_STATES.includes(currentState);

  // Update order
  const now = new Date().toISOString();
  const { data: updatedRow, error: updateError } = await supabase
    .from('orders')
    .update({
      state: 'Cancelled' as OrderState,
      cancellation_reason: reason,
      refund_flagged: shouldFlagRefund,
      updated_at: now,
    })
    .eq('id', orderId)
    .select()
    .single();

  if (updateError || !updatedRow) {
    throw new Error(`Failed to cancel order: ${updateError?.message ?? 'No data returned'}`);
  }

  // Record audit entry
  await recordTransition(orderId, currentState, 'Cancelled', 'system', { reason });

  return mapRowToOrder(updatedRow);
}

/**
 * Verifies if a deposit amount meets the 50% minimum requirement.
 * If valid, transitions the order from Quoted → Deposit_Received and records the deposit amount.
 * If insufficient, rejects with descriptive error including minimum amount required.
 */
export async function verifyDeposit(
  orderId: string,
  amount: number
): Promise<DepositVerification> {
  const supabase = getSupabaseAdmin();

  // Fetch order to get quoted price and current state
  const { data: orderRow, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchError || !orderRow) {
    throw new Error(`Order not found: ${fetchError?.message ?? 'No data returned'}`);
  }

  const currentState = orderRow.state as OrderState;

  // Verify order is in Quoted state (prerequisite for deposit transition)
  if (currentState !== 'Quoted') {
    const error = new Error(
      `Cannot verify deposit: order is in '${currentState}' state, must be in 'Quoted' state`
    );
    (error as Error & { code?: string }).code = 'INVALID_TRANSITION';
    throw error;
  }

  const quotedPrice = orderRow.quoted_price as number;
  if (!quotedPrice || quotedPrice <= 0) {
    throw new Error('Order does not have a valid quoted price');
  }

  const minimumRequired = quotedPrice / 2; // 50% minimum deposit
  const valid = amount >= minimumRequired;

  if (valid) {
    // Transition order to Deposit_Received and record deposit amount
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        state: 'Deposit_Received' as OrderState,
        deposit_amount: amount,
        updated_at: now,
      })
      .eq('id', orderId);

    if (updateError) {
      throw new Error(`Failed to transition order to Deposit_Received: ${updateError.message}`);
    }

    // Record audit entry for the state transition
    await recordTransition(orderId, 'Quoted', 'Deposit_Received', 'system', {
      deposit_amount: amount,
      quoted_price: quotedPrice,
    });
  }

  return {
    valid,
    depositAmount: amount,
    quotedPrice,
    minimumRequired,
    message: valid
      ? 'Deposit meets minimum requirement. Order transitioned to Deposit_Received.'
      : `Deposit of $${amount.toFixed(2)} is insufficient. Minimum required: $${minimumRequired.toFixed(2)} (50% of $${quotedPrice.toFixed(2)})`,
  };
}

// ---------------------------------------------------------------------------
// Private helper: Find or create customer
// ---------------------------------------------------------------------------

async function findOrCreateCustomer(
  data: OrderIntentData
): Promise<Customer> {
  const supabase = getSupabaseAdmin();

  // Try to find existing customer by email
  const { data: existingCustomer, error: findError } = await supabase
    .from('customers')
    .select('*')
    .eq('email', data.customerEmail)
    .single();

  if (!findError && existingCustomer) {
    return {
      id: existingCustomer.id,
      name: existingCustomer.name,
      email: existingCustomer.email,
      phone: existingCustomer.phone,
      deliveryAddress: existingCustomer.delivery_address ?? undefined,
      marketingConsent: existingCustomer.marketing_consent ?? false,
      consentTimestamp: existingCustomer.consent_timestamp
        ? new Date(existingCustomer.consent_timestamp)
        : undefined,
      consentChannel: existingCustomer.consent_channel ?? undefined,
      createdAt: new Date(existingCustomer.created_at),
      updatedAt: new Date(existingCustomer.updated_at),
    };
  }

  // Create new customer
  const now = new Date().toISOString();
  const { data: newCustomer, error: createError } = await supabase
    .from('customers')
    .insert({
      name: data.customerName,
      email: data.customerEmail,
      phone: data.customerPhone,
      marketing_consent: false,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (createError || !newCustomer) {
    throw new Error(
      `Failed to create customer: ${createError?.message ?? 'No data returned'}`
    );
  }

  return {
    id: newCustomer.id,
    name: newCustomer.name,
    email: newCustomer.email,
    phone: newCustomer.phone,
    deliveryAddress: newCustomer.delivery_address ?? undefined,
    marketingConsent: newCustomer.marketing_consent ?? false,
    consentTimestamp: newCustomer.consent_timestamp
      ? new Date(newCustomer.consent_timestamp)
      : undefined,
    consentChannel: newCustomer.consent_channel ?? undefined,
    createdAt: new Date(newCustomer.created_at),
    updatedAt: new Date(newCustomer.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Private helper: Record state transition audit entry
// ---------------------------------------------------------------------------

async function recordTransition(
  orderId: string,
  fromState: OrderState | null,
  toState: OrderState,
  triggeredBy: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('order_state_transitions').insert({
    order_id: orderId,
    from_state: fromState ?? 'none',
    to_state: toState,
    triggered_by: triggeredBy,
    metadata: metadata ? JSON.stringify(metadata) : null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    // Log but don't throw — audit failure shouldn't block the operation
    console.error(`Failed to record state transition: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Factory function and service object
// ---------------------------------------------------------------------------

/**
 * Factory function for creating an order service instance.
 */
export function createOrderService(): IOrderService {
  return {
    createOrderIntent,
    transitionState,
    getOrder,
    getOrdersByCustomer,
    cancelOrder,
    verifyDeposit,
  };
}

/** Pre-built service instance for direct use */
export const orderService: IOrderService = {
  createOrderIntent,
  transitionState,
  getOrder,
  getOrdersByCustomer,
  cancelOrder,
  verifyDeposit,
};

/** Capitalized export for route handlers (backward compatible) */
export const OrderService = orderService;
