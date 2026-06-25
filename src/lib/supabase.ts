// =============================================================================
// La La Sweett Sales System — Supabase Client
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// ---------------------------------------------------------------------------
// Environment validation (graceful degradation for local dev without DB)
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// ---------------------------------------------------------------------------
// Public (anon) client — safe for browser/client-side use
// Returns null if Supabase is not configured (local dev without DB)
// ---------------------------------------------------------------------------

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })
  : null;

// ---------------------------------------------------------------------------
// Service role client — server-side only, bypasses Row Level Security
// ---------------------------------------------------------------------------

let _supabaseAdmin: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (_supabaseAdmin) return _supabaseAdmin;

  if (!isSupabaseConfigured || !supabaseServiceRoleKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in .env.local to connect to a database. Running in local mock mode.'
    );
  }

  _supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _supabaseAdmin;
}

/**
 * Returns true if Supabase credentials are configured.
 * Use this to conditionally fall back to mock data in services.
 */
export function isDbConfigured(): boolean {
  return isSupabaseConfigured && Boolean(supabaseServiceRoleKey);
}
