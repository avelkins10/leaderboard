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

function mapAppointment(appt: any) {
  // List API has setter as direct field, webhook has contact.owner
  const setter = appt.setter || appt.contact?.owner || appt.contact?.user || appt.user;
  const owner = setter;
  const startAt = appt.startAt;
  const leadCreated = appt.contact?.createdAt || appt.createdAt;

  let hoursToAppointment: number | null = null;
  if (startAt && leadCreated) {
    const diff = (new Date(startAt).getTime() - new Date(leadCreated).getTime()) / 3600000;
    hoursToAppointment = (diff < 0 || diff > 8760) ? null : Math.round(diff * 100) / 100;
  }

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
    has_power_bill: Array.isArray(appt.appointment_attachment) && appt.appointment_attachment.length > 0,
    power_bill_urls: Array.isArray(appt.appointment_attachment) ? appt.appointment_attachment : [],
    is_quality: (Array.isArray(appt.appointment_attachment) && appt.appointment_attachment.length > 0) && (hoursToAppointment !== null && hoursToAppointment <= 48),
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

  let totalFetched = 0;
  let total2026 = 0;
  let totalUpserted = 0;
  let page = 150;
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
      const mapped = appts2026.map(mapAppointment);
      // Upsert in batches of 100
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
    // Stop if we've passed the last page or got fewer than 100
    if (items.length < 100 || page > totalPages) hasMore = false;
  }

  return NextResponse.json({
    success: true,
    totalFetched,
    total2026,
    totalUpserted,
    pagesScanned: page - 150,
  });
}
