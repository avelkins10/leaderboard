import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { MIGRATION_SQL } from '@/lib/migrations';

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== 'migrate2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Split into individual statements and run via rpc
    const statements = MIGRATION_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Try running as a single block first via the SQL endpoint
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        },
        body: JSON.stringify({ query: MIGRATION_SQL }),
      }
    );

    if (res.ok) {
      return NextResponse.json({ success: true, method: 'rpc' });
    }

    // Fallback: use supabase-js to run individual statements via raw SQL
    // Since supabase-js doesn't support raw SQL directly, we'll create a pg function first
    const createFnRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        },
        body: JSON.stringify({ sql: MIGRATION_SQL }),
      }
    );

    // If RPC doesn't exist, return the SQL for manual execution
    return NextResponse.json({
      success: false,
      message: 'RPC not available. Run this SQL manually in Supabase SQL Editor:',
      sql: MIGRATION_SQL,
      rpc_status: res.status,
      rpc_body: await res.text(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
