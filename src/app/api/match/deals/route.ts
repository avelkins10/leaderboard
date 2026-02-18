import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { QB_API_TOKEN, QB_REALM, QB_PROJECTS_TABLE } from '@/lib/config';
import { normalizePhone, addressMatch, fuzzyNameMatch } from '@/lib/matching';

const MATCH_FIDS = [3, 145, 146, 148, 149, 522, 517, 337, 2277, 2279, 13, 543, 339];

interface QBDeal {
  recordId: number;
  customerName: string;
  customerAddress: string;
  mobilePhone: string;
  email: string;
  saleDate: string;
  closerName: string;
  setterName: string;
  closerRcId: string;
  setterRcId: string;
  systemSizeKw: number;
  netPpw: number;
  salesOffice: string;
}

async function queryQBDeals(from: string, to: string): Promise<QBDeal[]> {
  const res = await fetch('https://api.quickbase.com/v1/records/query', {
    method: 'POST',
    headers: {
      'QB-Realm-Hostname': QB_REALM,
      'Authorization': `QB-USER-TOKEN ${QB_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: QB_PROJECTS_TABLE,
      select: MATCH_FIDS,
      where: `{522.AF.${from}}AND{522.BF.${to}}`,
      options: { skip: 0, top: 2000 },
    }),
  });
  if (!res.ok) throw new Error(`QB API error: ${res.status}`);
  const data = await res.json();
  return (data.data || []).map((r: any) => ({
    recordId: r['3']?.value ?? 0,
    customerName: r['145']?.value || '',
    customerAddress: r['146']?.value || '',
    mobilePhone: r['148']?.value || '',
    email: r['149']?.value || '',
    saleDate: r['522']?.value || '',
    closerName: r['517']?.value || '',
    setterName: r['337']?.value || '',
    closerRcId: String(r['2277']?.value || ''),
    setterRcId: String(r['2279']?.value || ''),
    systemSizeKw: parseFloat(r['13']?.value || 0),
    netPpw: parseFloat(r['543']?.value || 0),
    salesOffice: r['339']?.value || '',
  }));
}

function matchDeals(deals: QBDeal[], appointments: any[]): any[] {
  const results: any[] = [];

  for (const deal of deals) {
    const qbPhone = normalizePhone(deal.mobilePhone);
    let bestMatch: any = null;
    let bestMethod = '';
    let bestConfidence = 0;

    for (const appt of appointments) {
      const rcPhone = normalizePhone(appt.contact_phone);
      const closerMatch = deal.closerRcId && String(appt.closer_id) === deal.closerRcId;

      // Phone match
      if (qbPhone && rcPhone && qbPhone === rcPhone) {
        const conf = closerMatch ? 0.95 : 0.8;
        if (conf > bestConfidence) {
          bestMatch = appt;
          bestMethod = 'phone';
          bestConfidence = conf;
        }
        continue;
      }

      // Address match
      if (addressMatch(deal.customerAddress, appt.contact_address)) {
        const conf = closerMatch ? 0.85 : 0.65;
        if (conf > bestConfidence) {
          bestMatch = appt;
          bestMethod = 'address';
          bestConfidence = conf;
        }
        continue;
      }

      // Name + date match
      if (fuzzyNameMatch(deal.customerName, appt.contact_name) && closerMatch) {
        const saleDateMs = new Date(deal.saleDate).getTime();
        const apptDateMs = new Date(appt.appointment_time).getTime();
        const daysDiff = Math.abs(saleDateMs - apptDateMs) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 30) {
          const conf = Math.max(0.5, 0.75 - (daysDiff / 100));
          if (conf > bestConfidence) {
            bestMatch = appt;
            bestMethod = 'name_date';
            bestConfidence = conf;
          }
        }
      }
    }

    results.push({
      qb_record_id: deal.recordId,
      appointment_id: bestMatch?.id ?? null,
      contact_id: bestMatch?.contact_id ?? null,
      match_method: bestMethod || 'none',
      match_confidence: bestConfidence,
      qb_customer_name: deal.customerName,
      qb_customer_phone: deal.mobilePhone,
      qb_customer_address: deal.customerAddress,
      qb_closer_rc_id: deal.closerRcId,
      qb_setter_rc_id: deal.setterRcId,
      qb_sale_date: deal.saleDate || null,
      qb_system_size_kw: deal.systemSizeKw,
      qb_net_ppw: deal.netPpw,
      qb_sales_office: deal.salesOffice,
      rc_contact_name: bestMatch?.contact_name ?? null,
      rc_contact_phone: bestMatch?.contact_phone ?? null,
      rc_contact_address: bestMatch?.contact_address ?? null,
      rc_disposition: bestMatch?.disposition ?? null,
      rc_appointment_time: bestMatch?.appointment_time ?? null,
    });
  }

  return results;
}

export async function POST(req: NextRequest) {
  const { from, to } = await req.json();
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to required' }, { status: 400 });
  }

  try {
    // Query QB deals
    const deals = await queryQBDeals(from, to);

    // Query RC appointments (wider window: 30 days before to 30 days after)
    const apptFrom = new Date(new Date(from).getTime() - 30 * 86400000).toISOString();
    const apptTo = new Date(new Date(to).getTime() + 30 * 86400000).toISOString();
    const { data: appointments, error } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .gte('appointment_time', apptFrom)
      .lte('appointment_time', apptTo);
    if (error) throw error;

    const matches = matchDeals(deals, appointments || []);

    // Store matches (only those with actual matches)
    const matched = matches.filter(m => m.match_method !== 'none');
    let stored = 0;
    for (const m of matched) {
      const { error: upsertErr } = await supabaseAdmin
        .from('deal_matches')
        .upsert(m, { onConflict: 'qb_record_id' });
      if (!upsertErr) {
        stored++;
        // Update appointment's qb_record_id
        if (m.appointment_id) {
          await supabaseAdmin
            .from('appointments')
            .update({ qb_record_id: m.qb_record_id })
            .eq('id', m.appointment_id);
        }
      }
    }

    return NextResponse.json({
      total_deals: deals.length,
      total_matched: matched.length,
      stored,
      unmatched: matches.filter(m => m.match_method === 'none').length,
      matches: matches.slice(0, 50), // Return first 50 for preview
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  const query = supabaseAdmin.from('deal_matches').select('*').order('qb_sale_date', { ascending: false });
  if (from) query.gte('qb_sale_date', from);
  if (to) query.lte('qb_sale_date', to + 'T23:59:59Z');

  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ matches: data, count: data?.length ?? 0 });
}
