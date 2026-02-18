import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Pool } from 'pg';

const NEON_URL = 'postgresql://neondb_owner:npg_Fz3GX7tOdheE@ep-raspy-leaf-affmmeed-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require';

function getNeonPool() {
  return new Pool({ connectionString: NEON_URL, max: 3 });
}

async function backfillStatusLogs() {
  const pool = getNeonPool();
  try {
    const { rows } = await pool.query(`
      SELECT id, contact_id, user_id, user_name, old_status, new_status, 
             team_name, created_at
      FROM repcard_status_logs
      ORDER BY created_at
    `);

    let inserted = 0;
    const batch: any[] = [];
    for (const row of rows) {
      batch.push({
        contact_id: row.contact_id,
        rep_id: row.user_id,
        rep_name: row.user_name,
        old_status: row.old_status,
        new_status: row.new_status,
        office_team: row.team_name,
        changed_at: row.created_at,
      });
      if (batch.length >= 500) {
        const { error } = await supabaseAdmin.from('lead_status_changes').insert(batch);
        if (!error) inserted += batch.length;
        else console.error('Batch insert error:', error);
        batch.length = 0;
      }
    }
    if (batch.length > 0) {
      const { error } = await supabaseAdmin.from('lead_status_changes').insert(batch);
      if (!error) inserted += batch.length;
    }

    return { total: rows.length, inserted };
  } finally {
    await pool.end();
  }
}

async function backfillAppointments() {
  const pool = getNeonPool();
  try {
    const { rows } = await pool.query(`
      SELECT id, raw_data
      FROM repcard_appointments
      WHERE raw_data IS NOT NULL
    `);

    let enriched = 0;
    for (const row of rows) {
      const raw = typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data;
      if (!raw) continue;

      const contact = raw.contact || {};
      const phone = contact.phoneNumber || raw.phoneNumber || null;
      const email = contact.email || raw.email || null;
      const address = contact.fullAddress || raw.fullAddress || null;
      const source = contact.source || contact.leadSource || null;

      if (!phone && !email && !address && !source) continue;

      const update: any = {};
      if (phone) update.contact_phone = phone;
      if (email) update.contact_email = email;
      if (address) update.contact_address = address;
      if (source) update.contact_source = source;

      const { error } = await supabaseAdmin
        .from('appointments')
        .update(update)
        .eq('id', row.id);
      if (!error) enriched++;
    }

    return { total: rows.length, enriched };
  } finally {
    await pool.end();
  }
}

async function backfillMatchDeals(from: string, to: string) {
  // Trigger the deal matching endpoint internally
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const res = await fetch(`${baseUrl}/api/match/deals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });

  return res.json();
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== 'backfill2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get('action');
  const from = req.nextUrl.searchParams.get('from') || '2024-01-01';
  const to = req.nextUrl.searchParams.get('to') || '2026-12-31';

  try {
    switch (action) {
      case 'status_logs': {
        const result = await backfillStatusLogs();
        return NextResponse.json({ action, ...result });
      }
      case 'appointments': {
        const result = await backfillAppointments();
        return NextResponse.json({ action, ...result });
      }
      case 'match_deals': {
        const result = await backfillMatchDeals(from, to);
        return NextResponse.json({ action, ...result });
      }
      default:
        return NextResponse.json({
          error: 'Unknown action. Use: status_logs, appointments, match_deals',
          available: ['status_logs', 'appointments', 'match_deals'],
        }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
