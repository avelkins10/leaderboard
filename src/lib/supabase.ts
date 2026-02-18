import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;
let _anon: SupabaseClient | null = null;

/** Server-side client (service role – for writing snapshots, webhooks, etc.) */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _admin;
}

/** Anon / public client (for read-only queries) */
export function getSupabase(): SupabaseClient {
  if (!_anon) {
    _anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _anon;
}

/** Convenience aliases for backward compat */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) { return (getSupabaseAdmin() as any)[prop]; },
});
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) { return (getSupabase() as any)[prop]; },
});
