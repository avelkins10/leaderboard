import { supabaseAdmin } from './supabase';
import { getTimezoneForTeam } from './config';

// ── Types ──

export interface SetterApptStats {
  setter_id: number;
  setter_name: string;
  office_team: string;
  total_appts: number;
  power_bill_count: number;
  quality_count: number;
  avg_stars: number;
  closed: number;
  no_show: number;
  canceled: number;
  credit_fail: number;
  shade: number;
  one_legger: number;
  no_close: number;
  follow_up: number;
  reschedule: number;
}

export interface CloserApptStats {
  closer_id: number;
  closer_name: string;
  office_team: string;
  total_appts: number;
  power_bill_count: number;
  quality_count: number;
  avg_stars: number;
  closed: number;
  no_show: number;
  canceled: number;
  credit_fail: number;
  shade: number;
  one_legger: number;
  no_close: number;
  follow_up: number;
  reschedule: number;
}

export interface Appointment {
  id: number;
  setter_id: number;
  setter_name: string;
  closer_id: number;
  closer_name: string;
  contact_id: number;
  contact_name: string;
  contact_address: string;
  office_team: string;
  disposition: string;
  disposition_category: string;
  has_power_bill: boolean;
  hours_to_appointment: number;
  is_quality: boolean;
  setter_notes: string;
  appointment_time: string;
  appointment_time_local: string;
  star_rating: number;
}

export interface TimelineEvent {
  type: string;
  date: string;
  [key: string]: any;
}

// ── Helpers ──

function dispositionCategory(d: string | null): string {
  if (!d) return 'unknown';
  const lower = d.toLowerCase();
  if (lower.includes('close') || lower === 'closed') return 'closed';
  if (lower.includes('no show') || lower.includes('no_show')) return 'no_show';
  if (lower.includes('cancel')) return 'canceled';
  if (lower.includes('credit')) return 'credit_fail';
  if (lower.includes('shade') || lower.includes('shading')) return 'shade';
  if (lower.includes('one leg') || lower.includes('1 leg')) return 'one_legger';
  if (lower.includes('follow')) return 'follow_up';
  if (lower.includes('reschedule')) return 'reschedule';
  if (lower.includes('no close')) return 'no_close';
  return 'other';
}

function toLocalTime(utcTime: string, timezone: string): string {
  try {
    return new Date(utcTime).toLocaleString('en-US', { timeZone: timezone });
  } catch {
    return utcTime;
  }
}

function aggregateStats(rows: any[], idField: string, nameField: string): any[] {
  const map: Record<number, any> = {};
  for (const row of rows) {
    const id = row[idField];
    if (!map[id]) {
      map[id] = {
        [idField]: id,
        [nameField]: row[nameField] || `Unknown #${id}`,
        office_team: row.office_team || '',
        total_appts: 0,
        power_bill_count: 0,
        quality_count: 0,
        star_sum: 0,
        star_count: 0,
        closed: 0, no_show: 0, canceled: 0, credit_fail: 0,
        shade: 0, one_legger: 0, no_close: 0, follow_up: 0, reschedule: 0,
      };
    }
    const s = map[id];
    s.total_appts++;
    if (row.has_power_bill) s.power_bill_count++;
    if (row.is_quality) s.quality_count++;
    if (row.star_rating != null) { s.star_sum += row.star_rating; s.star_count++; }
    const cat = dispositionCategory(row.disposition);
    if (cat in s) s[cat]++;
  }
  return Object.values(map).map(s => {
    const { star_sum, star_count, ...rest } = s;
    return { ...rest, avg_stars: star_count > 0 ? Math.round((star_sum / star_count) * 10) / 10 : 0 };
  });
}

// ── Query Functions ──

export async function getSetterAppointmentStats(from: string, to: string): Promise<SetterApptStats[]> {
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .gte('appointment_time', `${from}T00:00:00Z`)
    .lte('appointment_time', `${to}T23:59:59Z`);
  if (error) throw error;
  return aggregateStats(data || [], 'setter_id', 'setter_name') as SetterApptStats[];
}

export async function getCloserAppointmentStats(from: string, to: string): Promise<CloserApptStats[]> {
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .gte('appointment_time', `${from}T00:00:00Z`)
    .lte('appointment_time', `${to}T23:59:59Z`);
  if (error) throw error;
  return aggregateStats(data || [], 'closer_id', 'closer_name') as CloserApptStats[];
}

function mapAppointment(row: any): Appointment {
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
    appointment_time_local: toLocalTime(row.appointment_time, tz),
    star_rating: row.star_rating || 0,
  };
}

export async function getSetterAppointments(setterId: number, from: string, to: string): Promise<Appointment[]> {
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('setter_id', setterId)
    .gte('appointment_time', `${from}T00:00:00Z`)
    .lte('appointment_time', `${to}T23:59:59Z`)
    .order('appointment_time', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapAppointment);
}

export async function getCloserAppointments(closerId: number, from: string, to: string): Promise<Appointment[]> {
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('closer_id', closerId)
    .gte('appointment_time', `${from}T00:00:00Z`)
    .lte('appointment_time', `${to}T23:59:59Z`)
    .order('appointment_time', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapAppointment);
}

export async function getActiveRepsToday(): Promise<Record<string, number>> {
  return getActiveReps();
}

export async function getActiveReps(from?: string, to?: string): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  
  let query = supabaseAdmin
    .from('door_knocks')
    .select('office_team, rep_id, knocked_at');

  if (from && to) {
    // Date range mode — get all unique reps who knocked in the range
    query = query.gte('knocked_at', from).lte('knocked_at', to + 'T23:59:59Z');
  } else {
    // Today mode — query last 24h then filter by office timezone
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('knocked_at', yesterday);
  }

  const { data, error } = await query;
  if (error) throw error;

  const byOffice: Record<string, Set<number>> = {};
  for (const row of data || []) {
    const office = row.office_team || '';
    
    if (from && to) {
      // Date range — count anyone who knocked in the range
      if (!byOffice[office]) byOffice[office] = new Set();
      byOffice[office].add(row.rep_id);
    } else {
      // Today — timezone-aware filtering
      const tz = getTimezoneForTeam(office);
      const knockDate = new Date(row.knocked_at).toLocaleDateString('en-CA', { timeZone: tz });
      const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: tz });
      if (knockDate === todayDate) {
        if (!byOffice[office]) byOffice[office] = new Set();
        byOffice[office].add(row.rep_id);
      }
    }
  }

  for (const [office, reps] of Object.entries(byOffice)) {
    if (office) results[office] = reps.size;
  }
  return results;
}

// Get per-day active rep counts for an office over a date range
export async function getDailyActiveReps(from: string, to: string, officeTeam?: string): Promise<Record<string, number>> {
  let query = supabaseAdmin
    .from('door_knocks')
    .select('office_team, rep_id, knocked_at')
    .gte('knocked_at', from)
    .lte('knocked_at', to + 'T23:59:59Z');

  if (officeTeam) {
    query = query.eq('office_team', officeTeam);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Group by date (in office timezone) → count unique reps
  const byDate: Record<string, Set<number>> = {};
  for (const row of data || []) {
    const tz = getTimezoneForTeam(row.office_team || '');
    const knockDate = new Date(row.knocked_at).toLocaleDateString('en-CA', { timeZone: tz });
    if (!byDate[knockDate]) byDate[knockDate] = new Set();
    byDate[knockDate].add(row.rep_id);
  }

  const result: Record<string, number> = {};
  for (const [date, reps] of Object.entries(byDate)) {
    result[date] = reps.size;
  }
  return result;
}

export async function getContactTimeline(contactId: number): Promise<TimelineEvent[]> {
  const [apptResult, knockResult] = await Promise.all([
    supabaseAdmin.from('appointments').select('*').eq('contact_id', contactId),
    supabaseAdmin.from('door_knocks').select('*').eq('contact_id', contactId),
  ]);

  if (apptResult.error) throw apptResult.error;
  if (knockResult.error) throw knockResult.error;

  const events: TimelineEvent[] = [];

  for (const knock of knockResult.data || []) {
    events.push({
      type: 'door_knock',
      date: knock.knocked_at,
      rep_name: knock.rep_name || '',
      outcome: knock.outcome || '',
      address: knock.address || '',
    });
  }

  for (const appt of apptResult.data || []) {
    events.push({
      type: 'appointment_set',
      date: appt.appointment_time || appt.created_at,
      setter: appt.setter_name || '',
      closer: appt.closer_name || '',
      has_power_bill: !!appt.has_power_bill,
    });
    if (appt.disposition) {
      events.push({
        type: 'disposition',
        date: appt.disposition_date || appt.appointment_time,
        disposition: appt.disposition,
        closer: appt.closer_name || '',
      });
    }
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return events;
}
