// =============================================================================
// La La Sweett Sales System — Customer Service Implementation
// =============================================================================

import { getSupabaseAdmin } from '@/lib/supabase';
import type {
  Customer,
  CustomerService as ICustomerService,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants — Allowed fields for data minimization (Requirement 15.2)
// Only these fields may be stored for a customer record.
// ---------------------------------------------------------------------------

const ALLOWED_CUSTOMER_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'email',
  'phone',
  'deliveryAddress',
  'marketingConsent',
  'consentTimestamp',
  'consentChannel',
]);

// ---------------------------------------------------------------------------
// Helper: Map database row to domain Customer
// ---------------------------------------------------------------------------

function mapRowToCustomer(row: {
  id: string;
  name: string;
  email: string;
  phone: string;
  delivery_address: string | null;
  marketing_consent: boolean;
  consent_timestamp: string | null;
  consent_channel: string | null;
  created_at: string;
  updated_at: string;
}): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    deliveryAddress: row.delivery_address ?? undefined,
    marketingConsent: row.marketing_consent,
    consentTimestamp: row.consent_timestamp
      ? new Date(row.consent_timestamp)
      : undefined,
    consentChannel: row.consent_channel ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Helper: Strip unknown fields from input data (data minimization)
// ---------------------------------------------------------------------------

function stripToAllowedFields<
  T extends Record<string, unknown>,
>(data: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    if (ALLOWED_CUSTOMER_FIELDS.has(key)) {
      result[key] = data[key];
    }
  }
  return result as Partial<T>;
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Fetches a customer by ID.
 * Throws if the customer does not exist.
 */
export async function getCustomer(customerId: string): Promise<Customer> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (error || !data) {
    throw new Error(
      `Customer not found: ${error?.message ?? 'No data returned'}`
    );
  }

  return mapRowToCustomer(data);
}

/**
 * Creates a new customer record.
 * Enforces data minimization: only allowed fields (name, email, phone,
 * delivery_address, marketing_consent, consent_timestamp, consent_channel)
 * are persisted. Any extra fields in the input are silently stripped.
 */
export async function createCustomer(
  data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Customer> {
  const supabase = getSupabaseAdmin();

  // Strip to allowed fields only (data minimization)
  const sanitized = stripToAllowedFields(data as unknown as Record<string, unknown>);

  // Build the insert payload with only permitted columns
  const insertPayload: Record<string, unknown> = {
    name: sanitized.name as string,
    email: sanitized.email as string,
    phone: sanitized.phone as string,
    delivery_address: (sanitized.deliveryAddress as string | undefined) ?? null,
    marketing_consent: (sanitized.marketingConsent as boolean | undefined) ?? false,
    consent_timestamp: sanitized.consentTimestamp
      ? (sanitized.consentTimestamp as Date).toISOString()
      : null,
    consent_channel: (sanitized.consentChannel as string | undefined) ?? null,
  };

  const { data: row, error } = await supabase
    .from('customers')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error || !row) {
    throw new Error(
      `Failed to create customer: ${error?.message ?? 'No data returned'}`
    );
  }

  return mapRowToCustomer(row);
}

/**
 * Updates an existing customer with partial data.
 * Only allowed fields are considered; unknown fields are silently dropped.
 */
export async function updateCustomer(
  customerId: string,
  data: Partial<Customer>
): Promise<Customer> {
  const supabase = getSupabaseAdmin();

  // Strip to allowed fields only
  const sanitized = stripToAllowedFields(data as unknown as Record<string, unknown>);

  // Map domain field names to database column names
  const updatePayload: Record<string, unknown> = {};
  if (sanitized.name !== undefined) updatePayload.name = sanitized.name;
  if (sanitized.email !== undefined) updatePayload.email = sanitized.email;
  if (sanitized.phone !== undefined) updatePayload.phone = sanitized.phone;
  if (sanitized.deliveryAddress !== undefined)
    updatePayload.delivery_address = sanitized.deliveryAddress;
  if (sanitized.marketingConsent !== undefined)
    updatePayload.marketing_consent = sanitized.marketingConsent;
  if (sanitized.consentTimestamp !== undefined)
    updatePayload.consent_timestamp = sanitized.consentTimestamp
      ? (sanitized.consentTimestamp as Date).toISOString()
      : null;
  if (sanitized.consentChannel !== undefined)
    updatePayload.consent_channel = sanitized.consentChannel;

  // Always touch updated_at
  updatePayload.updated_at = new Date().toISOString();

  const { data: row, error } = await supabase
    .from('customers')
    .update(updatePayload)
    .eq('id', customerId)
    .select('*')
    .single();

  if (error || !row) {
    throw new Error(
      `Failed to update customer: ${error?.message ?? 'No data returned'}`
    );
  }

  return mapRowToCustomer(row);
}

/**
 * Deletes PII from a customer record while retaining the record for
 * order foreign key references (anonymized).
 *
 * Sets:
 *  - name → '[deleted]'
 *  - email → '[deleted]@deleted.local'
 *  - phone → '0000000000'
 *  - delivery_address → null
 *
 * The customer ID and order references remain intact for business analytics.
 */
export async function deleteCustomerPII(customerId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('customers')
    .update({
      name: '[deleted]',
      email: '[deleted]@deleted.local',
      phone: '0000000000',
      delivery_address: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  if (error) {
    throw new Error(`Failed to delete customer PII: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Factory function and service object
// ---------------------------------------------------------------------------

/**
 * Factory function for creating a customer service instance.
 * Uses the Supabase admin client for all database queries.
 */
export function createCustomerService(): ICustomerService {
  return {
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomerPII,
  };
}

/** Pre-built service instance for direct use */
export const customerService: ICustomerService = {
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomerPII,
};

/** Capitalized export for route handlers (backward compatible) */
export const CustomerService = customerService;
