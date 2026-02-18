import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const REPCARD_API_KEY = process.env.REPCARD_API_KEY!;
const REPCARD_API_URL = 'https://app.repcard.com/api/appointments';

async function fetchPage(page: number) {
  const res = await fetch(`${REPCARD_API_URL}?limit=100&page=${page}`, {
    headers: { 'x-api-key': REPCARD_API_KEY },
  });
  if (!res.ok) throw new Error(`RepCard API error: ${res.status} on page ${page}`);
  return res.json();
}

/** Paginate through a RepCard API endpoint and collect all records */
async function fetchAllPages(baseUrl: string): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 200; page++) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${baseUrl}${sep}page=${page}&per_page=100`, {
      headers: { 'x-api-key': REPCARD_API_KEY },
    });
    if (!res.ok) break;
    const d = await res.json();
    const items = d.result?.data || d.data || [];
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

function mapAppointment(appt: any, hasPowerBill: boolean = false) {
  const setter = appt.setter || appt.contact?.owner || appt.contact?.user || appt.user;
  const startAt = appt.startAt;
  const leadCreated = appt.contact?.createdAt || appt.createdAt;

  let hoursToAppointment: number | null = null;
  if (startAt && leadCreated) {
    const diff = (new Date(startAt).getTime() - new Date(leadCreated).getTime()) / 3600000;
    hoursToAppointment = (diff < 0 || diff > 8760) ? null : Math.round(diff * 100) / 100;
  }

  // Power bill: check inline attachment OR external attachment lookup
  const inlinePB = Array.isArray(appt.appointment_attachment) && appt.appointment_attachment.length > 0;
  const hasPB = inlinePB || hasPowerBill;
  const within2days = hoursToAppointment !== null && hoursToAppointment > 0 && hoursToAppointment <= 48;
  const starRating = hasPB && within2days ? 3 : hasPB ? 2 : 1;

  const contact = appt.contact || {};
  const address = contact.fullAddress ||
    [contact.address, contact.city, contact.state, contact.zip].filter(Boolean).join(' ') || null;

  return {
    id: appt.id,
    setter_id: setter?.id ?? null,
    setter_name: setter?.name || setter?.fullName || null,
    closer_id: appt.closer?.id ?? null,
    closer_name: appt.closer?.name || appt.closer?.fullName || null,
    contact_id: contact.id ?? null,
    contact_name: contact.name || contact.fullName || null,
    contact_phone: contact.phoneNumber ?? null,
    contact_address: appt.appointmentLocation || address,
    contact_city: contact.city ?? null,
    contact_state: contact.state ?? null,
    latitude: contact.latitude ? parseFloat(contact.latitude) : null,
    longitude: contact.longitude ? parseFloat(contact.longitude) : null,
    office_team: setter?.team ?? null,
    office_region: setter?.location ?? null,
    appointment_time: startAt ?? null,
    lead_created_at: leadCreated ?? null,
    hours_to_appointment: hoursToAppointment,
    has_power_bill: hasPB,
    power_bill_urls: Array.isArray(appt.appointment_attachment) ? appt.appointment_attachment : [],
    is_quality: hasPB && within2days,
    star_rating: starRating,
    both_spouses_present: contact.both_spouses_present ?? null,
    disposition: appt.status?.title ?? null,
    disposition_category: appt.status?.category?.title ?? null,
    qb_record_id: contact.qb_record_id ?? null,
    setter_notes: appt.notes ?? null,
    created_at: appt.createdAt ?? new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('key') !== 'backfill2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mode = searchParams.get('mode') || 'full'; // 'full' | 'power-bills-only'

  // ── Step 1: Fetch power bill data from attachment endpoints ──
  const [apptAttachments, custAttachments] = await Promise.all([
    fetchAllPages('https://app.repcard.com/api/appointments/attachments?from_date=2026-01-01&to_date=2026-12-31'),
    fetchAllPages('https://app.repcard.com/api/customers/attachments?from_date=2026-01-01&to_date=2026-12-31'),
  ]);

  // Map appointment IDs and customer IDs with power bills
  const apptIdsWithPB = new Set<number>();
  for (const a of apptAttachments) {
    if (a.appointmentId) apptIdsWithPB.add(a.appointmentId);
  }
  const customerIdsWithPB = new Set<number>();
  for (const a of custAttachments) {
    if (a.customerId) customerIdsWithPB.add(a.customerId);
  }

  // If power-bills-only mode, just update existing Supabase records
  if (mode === 'power-bills-only') {
    const { data: allAppts } = await supabaseAdmin
      .from('appointments')
      .select('id, contact_id, has_power_bill, hours_to_appointment');

    let updated = 0;
    for (const appt of (allAppts || [])) {
      const hasPB = apptIdsWithPB.has(appt.id) || customerIdsWithPB.has(appt.contact_id);
      if (hasPB && !appt.has_power_bill) {
        const hrs = appt.hours_to_appointment;
        const within2days = hrs != null && hrs > 0 && hrs <= 48;
        await supabaseAdmin.from('appointments').update({
          has_power_bill: true,
          is_quality: within2days,
          star_rating: within2days ? 3 : 2,
        }).eq('id', appt.id);
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'power-bills-only',
      apptAttachments: apptAttachments.length,
      custAttachments: custAttachments.length,
      uniqueApptIdsWithPB: apptIdsWithPB.size,
      uniqueCustomerIdsWithPB: customerIdsWithPB.size,
      updated,
    });
  }

  // ── Step 2: Full backfill — fetch all appointments and upsert ──
  let totalFetched = 0;
  let total2026 = 0;
  let totalUpserted = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await fetchPage(page);
    const result = data.result || data;
    const records = result.data || result.appointments || result || [];
    const items = Array.isArray(records) ? records : [];
    const totalPages = result.totalPages || 999;

    if (items.length === 0) {
      hasMore = false;
      break;
    }

    totalFetched += items.length;

    const appts2026 = items.filter((a: any) => a.startAt && a.startAt.startsWith('2026'));
    total2026 += appts2026.length;

    if (appts2026.length > 0) {
      const mapped = appts2026.map((appt: any) => {
        // Check if this appointment or its contact has a power bill from attachment endpoints
        const contactId = appt.contact?.id;
        const hasPB = apptIdsWithPB.has(appt.id) || (contactId && customerIdsWithPB.has(contactId));
        return mapAppointment(appt, hasPB);
      });

      const { error } = await supabaseAdmin
        .from('appointments')
        .upsert(mapped, { onConflict: 'id' });
      if (error) {
        console.error(`Upsert error on page ${page}:`, error);
      } else {
        totalUpserted += mapped.length;
      }
    }

    page++;
    if (items.length < 100 || page > totalPages) hasMore = false;
  }

  return NextResponse.json({
    success: true,
    mode: 'full',
    totalFetched,
    total2026,
    totalUpserted,
    pagesScanned: page - 1,
    apptAttachments: apptAttachments.length,
    custAttachments: custAttachments.length,
    uniqueApptIdsWithPB: apptIdsWithPB.size,
    uniqueCustomerIdsWithPB: customerIdsWithPB.size,
  });
}
