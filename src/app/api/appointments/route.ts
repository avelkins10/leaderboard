import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getOfficeTimezone, qbOfficeToRepCardTeams, getTimezoneForTeam } from '@/lib/config';
import { type Appointment } from '@/lib/supabase-queries';
import { getSetterAppointments, getCloserAppointments } from '@/lib/supabase-queries';
import { dateBoundsUTC } from '@/lib/data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const setterId = searchParams.get('setter_id');
  const closerId = searchParams.get('closer_id');
  const office = searchParams.get('office');
  const disposition = searchParams.get('disposition');
  const from = searchParams.get('from') || getMonday();
  const to = searchParams.get('to') || getToday();

  try {
    let appointments: Appointment[];

    if (setterId) {
      appointments = await getSetterAppointments(Number(setterId), from, to);
    } else if (closerId) {
      appointments = await getCloserAppointments(Number(closerId), from, to);
    } else if (office) {
      // office param could be QB office name or RepCard team name — handle both
      const repCardTeams = qbOfficeToRepCardTeams(office);
      // Query by RepCard team names, or fall back to exact match (might be a RepCard team name directly)
      const teamsToQuery = repCardTeams.length > 0 ? repCardTeams : [office];
      const { data, error } = await supabaseAdmin
        .from('appointments')
        .select('*')
        .in('office_team', teamsToQuery)
        .gte('appointment_time', dateBoundsUTC(from, to).gte)
        .lte('appointment_time', dateBoundsUTC(from, to).lte)
        .order('appointment_time', { ascending: false });
      if (error) throw error;
      appointments = (data || []).map(row => mapRow(row));
    } else {
      const { data, error } = await supabaseAdmin
        .from('appointments')
        .select('*')
        .gte('appointment_time', dateBoundsUTC(from, to).gte)
        .lte('appointment_time', dateBoundsUTC(from, to).lte)
        .order('appointment_time', { ascending: false })
        .limit(500);
      if (error) throw error;
      appointments = (data || []).map(row => mapRow(row));
    }

    // Filter by disposition if specified
    if (disposition) {
      appointments = appointments.filter(a =>
        a.disposition.toLowerCase().includes(disposition.toLowerCase()) ||
        a.disposition_category === disposition.toLowerCase()
      );
    }

    return NextResponse.json({ appointments, count: appointments.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function mapRow(row: any): Appointment {
  const tz = getTimezoneForTeam(row.office_team || '');
  return {
    id: row.id,
    setter_id: row.setter_id,
    setter_name: row.setter_name || '',
    closer_id: row.closer_id,
    closer_name: row.closer_name || '',
    contact_id: row.contact_id,
    contact_name: row.contact_name || '',
    contact_address: row.contact_address || '',
    office_team: row.office_team || '',
    disposition: row.disposition || '',
    disposition_category: dispositionCategory(row.disposition),
    has_power_bill: !!row.has_power_bill,
    hours_to_appointment: row.hours_to_appointment || 0,
    is_quality: !!row.is_quality,
    setter_notes: row.setter_notes || '',
    appointment_time: row.appointment_time,
    appointment_time_local: new Date(row.appointment_time).toLocaleString('en-US', { timeZone: tz }),
    star_rating: row.star_rating || 0,
  };
}

function dispositionCategory(d: string | null): string {
  if (!d) return 'unknown';
  const lower = d.toLowerCase();
  if (lower.includes('close') || lower === 'closed') return 'closed';
  if (lower.includes('no show') || lower.includes('no_show')) return 'no_show';
  if (lower.includes('cancel')) return 'canceled';
  if (lower.includes('credit')) return 'credit_fail';
  if (lower.includes('shade')) return 'shade';
  if (lower.includes('one leg') || lower.includes('1 leg')) return 'one_legger';
  if (lower.includes('follow')) return 'follow_up';
  if (lower.includes('reschedule')) return 'reschedule';
  if (lower.includes('no close')) return 'no_close';
  return 'other';
}

function getMonday(): string {
  const now = new Date();
  const ct = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const day = ct.getDay();
  const diff = ct.getDate() - day + (day === 0 ? -6 : 1);
  ct.setDate(diff);
  const y = ct.getFullYear();
  const m = String(ct.getMonth() + 1).padStart(2, "0");
  const d = String(ct.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getToday(): string {
  const now = new Date();
  const ct = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const y = ct.getFullYear();
  const m = String(ct.getMonth() + 1).padStart(2, "0");
  const d = String(ct.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
