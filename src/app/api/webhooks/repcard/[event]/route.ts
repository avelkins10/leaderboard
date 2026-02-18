import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const VALID_EVENTS = [
  'door-knocked',
  'appointment-set',
  'appointment-update',
  'appointment-outcome',
  'closer-update',
  'status-changed',
  'contact-type-changed',
] as const;

type EventType = (typeof VALID_EVENTS)[number];

function calcHoursToAppointment(apptTime: string | null, leadCreated: string | null): number | null {
  if (!apptTime || !leadCreated) return null;
  const diff = new Date(apptTime).getTime() - new Date(leadCreated).getTime();
  return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
}

function extractDispositionCategory(disposition: string | null): string | null {
  if (!disposition) return null;
  const match = disposition.match(/\(([^)]+)\)/);
  return match ? match[1] : null;
}

function checkForPowerBill(payload: any): { hasPowerBill: boolean; urls: string[] } {
  if (Array.isArray(payload.appointment_attachment) && payload.appointment_attachment.length > 0) {
    return { hasPowerBill: true, urls: payload.appointment_attachment };
  }
  const contact = payload.contact || {};
  if (contact.attachment && typeof contact.attachment === 'string' && contact.attachment.length > 0) {
    return { hasPowerBill: true, urls: [contact.attachment] };
  }
  if (contact.latestAttachment && typeof contact.latestAttachment === 'string' && contact.latestAttachment.length > 0) {
    return { hasPowerBill: true, urls: [contact.latestAttachment] };
  }
  if (contact.soloAttachment && typeof contact.soloAttachment === 'string' && contact.soloAttachment.length > 0) {
    return { hasPowerBill: true, urls: [contact.soloAttachment] };
  }
  return { hasPowerBill: false, urls: [] };
}

function buildAppointmentUpsert(payload: any) {
  const { hasPowerBill, urls: powerBillUrls } = checkForPowerBill(payload);
  const hoursToAppt = calcHoursToAppointment(
    payload.appt_start_time,
    payload.contact?.createdAt
  );
  const isQuality = hasPowerBill && hoursToAppt !== null && hoursToAppt <= 48;

  return {
    id: payload.id,
    setter_id: payload.user?.id ?? null,
    setter_name: payload.user?.name ?? null,
    closer_id: payload.closer?.id ?? null,
    closer_name: payload.closer?.name ?? null,
    contact_id: payload.contact?.id ?? null,
    contact_name: payload.contact?.name ?? null,
    contact_phone: payload.contact?.phoneNumber ?? null,
    contact_address: payload.contact?.fullAddress ?? null,
    contact_city: payload.contact?.city ?? null,
    contact_state: payload.contact?.state ?? null,
    latitude: payload.contact?.latitude ? parseFloat(payload.contact.latitude) : null,
    longitude: payload.contact?.longitude ? parseFloat(payload.contact.longitude) : null,
    office_team: payload.user?.team ?? null,
    office_region: payload.user?.location ?? null,
    appointment_time: payload.appt_start_time ?? null,
    lead_created_at: payload.contact?.createdAt ?? null,
    hours_to_appointment: hoursToAppt,
    has_power_bill: hasPowerBill,
    power_bill_urls: powerBillUrls,
    is_quality: isQuality,
    both_spouses_present: payload.contact?.both_spouses_present ?? null,
    qb_record_id: payload.contact?.qb_record_id ?? null,
    setter_notes: payload.notes ?? null,
    created_at: payload.created_at ?? new Date().toISOString(),
  };
}

async function logEvent(eventType: string, payload: any) {
  await supabaseAdmin.from('repcard_events').insert({
    event_type: eventType,
    payload,
    received_at: new Date().toISOString(),
  });
}

async function handleAppointmentSet(payload: any) {
  const data = { ...buildAppointmentUpsert(payload), disposition: null as any };
  const { error } = await supabaseAdmin
    .from('appointments')
    .upsert(data, { onConflict: 'id' });
  if (error) console.error('appointment-set upsert error:', error);
}

async function handleAppointmentUpdate(payload: any) {
  const data = buildAppointmentUpsert(payload);
  const { error } = await supabaseAdmin
    .from('appointments')
    .upsert(data, { onConflict: 'id' });
  if (error) console.error('appointment-update upsert error:', error);
}

async function handleAppointmentOutcome(payload: any) {
  const data = {
    ...buildAppointmentUpsert(payload),
    disposition: payload.appointment_status_title ?? null,
    disposition_category: extractDispositionCategory(payload.appointment_status_title),
  };
  const { error } = await supabaseAdmin
    .from('appointments')
    .upsert(data, { onConflict: 'id' });
  if (error) console.error('appointment-outcome upsert error:', error);
}

async function handleCloserUpdate(payload: any) {
  if (!payload.id) return;
  const { error } = await supabaseAdmin
    .from('appointments')
    .update({
      closer_id: payload.closer?.id ?? null,
      closer_name: payload.closer?.name ?? null,
    })
    .eq('id', payload.id);
  if (error) console.error('closer-update error:', error);
}

async function handleDoorKnocked(payload: any) {
  const contactId = payload.id ?? null;
  const repId = payload.user?.id ?? null;
  if (contactId && repId) {
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from('door_knocks')
      .select('id')
      .eq('contact_id', contactId)
      .eq('rep_id', repId)
      .gte('knocked_at', cutoff)
      .limit(1);
    if (existing && existing.length > 0) {
      console.log(`Skipping duplicate door knock: contact=${contactId} rep=${repId}`);
      return;
    }
  }

  const { error } = await supabaseAdmin.from('door_knocks').insert({
    contact_id: payload.id ?? null,
    rep_id: payload.user?.id ?? null,
    rep_name: payload.user?.name ?? null,
    office_team: payload.user?.team ?? null,
    office_region: payload.user?.location ?? null,
    address: payload.fullAddress ?? payload.address ?? null,
    city: payload.city ?? null,
    state: payload.state ?? null,
    latitude: payload.latitude ? parseFloat(payload.latitude) : null,
    longitude: payload.longitude ? parseFloat(payload.longitude) : null,
    outcome: payload.status ?? null,
    knocked_at: payload.createdAt ?? new Date().toISOString(),
  });
  if (error) console.error('door-knocked insert error:', error);
}

async function handleContactAttachmentUpdate(payload: any) {
  const contactId = payload.id;
  const attachment = payload.attachment || payload.latestAttachment || payload.soloAttachment;
  if (!contactId || !attachment || typeof attachment !== 'string' || attachment.length === 0) return;

  const { data: appts } = await supabaseAdmin
    .from('appointments')
    .select('id, hours_to_appointment')
    .eq('contact_id', contactId)
    .eq('has_power_bill', false);

  if (!appts || appts.length === 0) return;

  for (const appt of appts) {
    const isQuality = appt.hours_to_appointment !== null && appt.hours_to_appointment > 0 && appt.hours_to_appointment <= 48;
    await supabaseAdmin
      .from('appointments')
      .update({
        has_power_bill: true,
        power_bill_urls: [attachment],
        is_quality: isQuality,
      })
      .eq('id', appt.id);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { event: string } }
) {
  const eventType = params.event as EventType;

  if (!VALID_EVENTS.includes(eventType)) {
    return NextResponse.json(
      { success: false, error: `Unknown event type: ${eventType}` },
      { status: 400 }
    );
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  await logEvent(eventType, payload);

  try {
    switch (eventType) {
      case 'appointment-set':
        await handleAppointmentSet(payload);
        break;
      case 'appointment-update':
        await handleAppointmentUpdate(payload);
        break;
      case 'appointment-outcome':
        await handleAppointmentOutcome(payload);
        break;
      case 'closer-update':
        await handleCloserUpdate(payload);
        break;
      case 'door-knocked':
        await handleDoorKnocked(payload);
        break;
      case 'status-changed':
      case 'contact-type-changed':
        await handleContactAttachmentUpdate(payload);
        break;
    }
  } catch (err) {
    console.error(`Error processing ${eventType}:`, err);
  }

  return NextResponse.json({ success: true, event_type: eventType });
}
