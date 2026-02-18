import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side client (for writing snapshots)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Client-side client (for reading)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
