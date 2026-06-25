// =============================================================================
// La La Sweett Sales System — Consent Management Service
// Handles marketing consent opt-in/withdrawal per Requirements 15.3, 15.6, 11.6
// =============================================================================

import { getSupabaseAdmin } from '@/lib/supabase';
import type { ConsentRecord } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported consent types */
export type ConsentType = 'marketing_email' | 'marketing_whatsapp' | 'marketing_sms';

/** Input for recording consent */
export interface RecordConsentInput {
  customerId: string;
  consentType: ConsentType;
  channel: string;
}

/** Input for withdrawing consent */
export interface WithdrawConsentInput {
  customerId: string;
  consentType: ConsentType;
}

/** Consent service interface */
export interface ConsentServiceInterface {
  recordConsent(input: RecordConsentInput): Promise<ConsentRecord>;
  withdrawConsent(input: WithdrawConsentInput): Promise<ConsentRecord>;
  hasActiveConsent(customerId: string, consentType: ConsentType): Promise<boolean>;
  getConsentHistory(customerId: string): Promise<ConsentRecord[]>;
}

// ---------------------------------------------------------------------------
// Helper: Map database row to domain ConsentRecord
// ---------------------------------------------------------------------------

function mapRowToConsentRecord(row: {
  id: string;
  customer_id: string;
  consent_type: string;
  granted: boolean;
  channel: string;
  recorded_at: string;
}): ConsentRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    consentType: row.consent_type,
    granted: row.granted,
    channel: row.channel,
    recordedAt: new Date(row.recorded_at),
  };
}

// ---------------------------------------------------------------------------
// Service Implementation
// ---------------------------------------------------------------------------

/**
 * Records explicit opt-in consent for a customer.
 * Consent checkbox MUST default to unchecked (Requirement 15.3, 11.6).
 * Records timestamp and channel for audit trail.
 */
export async function recordConsent(input: RecordConsentInput): Promise<ConsentRecord> {
  const { customerId, consentType, channel } = input;
  const supabase = getSupabaseAdmin();

  // Insert a consent record with granted = true
  const { data: row, error } = await supabase
    .from('consent_records')
    .insert({
      customer_id: customerId,
      consent_type: consentType,
      granted: true,
      channel,
    })
    .select('*')
    .single();

  if (error || !row) {
    throw new Error(
      `Failed to record consent: ${error?.message ?? 'No data returned'}`
    );
  }

  // Also update the customer's marketing_consent flag and timestamp
  await supabase
    .from('customers')
    .update({
      marketing_consent: true,
      consent_timestamp: new Date().toISOString(),
      consent_channel: channel,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  return mapRowToConsentRecord(row);
}

/**
 * Withdraws consent for a customer. Per Requirement 15.6, marketing
 * communications MUST stop within 24 hours of withdrawal.
 * Creates a new consent record with granted = false and updates the
 * customer record to reflect withdrawn consent.
 */
export async function withdrawConsent(input: WithdrawConsentInput): Promise<ConsentRecord> {
  const { customerId, consentType } = input;
  const supabase = getSupabaseAdmin();

  // Insert a withdrawal record (granted = false)
  const { data: row, error } = await supabase
    .from('consent_records')
    .insert({
      customer_id: customerId,
      consent_type: consentType,
      granted: false,
      channel: 'withdrawal',
    })
    .select('*')
    .single();

  if (error || !row) {
    throw new Error(
      `Failed to withdraw consent: ${error?.message ?? 'No data returned'}`
    );
  }

  // Update customer record to reflect withdrawn consent immediately.
  // This ensures marketing communications stop within 24 hours (Requirement 15.6).
  await supabase
    .from('customers')
    .update({
      marketing_consent: false,
      consent_timestamp: new Date().toISOString(),
      consent_channel: 'withdrawal',
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  return mapRowToConsentRecord(row);
}

/**
 * Checks whether a customer has active (non-withdrawn) consent for
 * a specific consent type. The most recent consent record for the
 * given type determines the active state.
 *
 * Marketing messages MUST only be sent when this returns true
 * (Requirement 11.6, Property 17: Marketing Consent Gate).
 */
export async function hasActiveConsent(
  customerId: string,
  consentType: ConsentType
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  // Get the most recent consent record for this customer + type
  const { data: rows, error } = await supabase
    .from('consent_records')
    .select('*')
    .eq('customer_id', customerId)
    .eq('consent_type', consentType)
    .order('recorded_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(
      `Failed to check consent: ${error.message}`
    );
  }

  // No records means no consent was ever given
  if (!rows || rows.length === 0) {
    return false;
  }

  // Active consent only if the most recent record has granted = true
  return rows[0].granted === true;
}

/**
 * Returns all consent records for a customer, ordered by most recent first.
 * Provides full audit trail for consent history.
 */
export async function getConsentHistory(customerId: string): Promise<ConsentRecord[]> {
  const supabase = getSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from('consent_records')
    .select('*')
    .eq('customer_id', customerId)
    .order('recorded_at', { ascending: false });

  if (error) {
    throw new Error(
      `Failed to get consent history: ${error.message}`
    );
  }

  if (!rows) {
    return [];
  }

  return rows.map(mapRowToConsentRecord);
}

// ---------------------------------------------------------------------------
// Factory function and service object
// ---------------------------------------------------------------------------

/**
 * Factory function for creating a consent service instance.
 */
export function createConsentService(): ConsentServiceInterface {
  return {
    recordConsent,
    withdrawConsent,
    hasActiveConsent,
    getConsentHistory,
  };
}

/** Pre-built service instance for direct use */
export const consentService: ConsentServiceInterface = {
  recordConsent,
  withdrawConsent,
  hasActiveConsent,
  getConsentHistory,
};

/** Capitalized export for consistency with other services */
export const ConsentService = consentService;
