import { REPCARD_API_KEY } from './config';
import { dateBoundsUTC, addDays } from './date-utils';

const BASE_URL = 'https://app.repcard.com/api';

/** RepCard's to_date is exclusive — add 1 day to our inclusive end date */
function rcExclusiveEnd(inclusive: string): string {
  const [y, m, d] = inclusive.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  const ny = next.getFullYear();
  const nm = String(next.getMonth() + 1).padStart(2, '0');
  const nd = String(next.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

async function rcFetch(path: string, params?: Record<string, string>) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': REPCARD_API_KEY },
    next: { revalidate: 300 }, // cache 5 min
  });
  
  if (!res.ok) throw new Error(`RepCard API error: ${res.status}`);
  return res.json();
}

export interface RepUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  office: string; // region
  officeId: number;
  team: string; // actual office
  officeTeamId: number;
  jobTitle: string;
  status: string;
  image: string;
  role: string;
}

export async function getUsers(): Promise<RepUser[]> {
  const users: RepUser[] = [];
  let page = 1;
  while (true) {
    const data = await rcFetch('/users/minimal', { per_page: '100', page: String(page) });
    users.push(...data.result.data);
    if (page >= data.result.totalPages) break;
    page++;
  }
  return users;
}

export interface LeaderboardStat {
  item_id: number;
  item_type: string;
  company_id: number;
  office_id: number;
  office_team_id: number;
  [key: string]: any;
}

export interface LeaderboardHeader {
  _id: string;
  stat_name: string;
  mapped_field: string;
  short_name: string;
  rank_by: boolean;
}

export interface Leaderboard {
  leaderboard_name: string;
  stats: {
    headers: LeaderboardHeader[];
    stats: LeaderboardStat[];
  } | any[];
}

export async function getLeaderboards(fromDate: string, toDate: string): Promise<Leaderboard[]> {
  const data = await rcFetch('/leaderboards', { from_date: fromDate, to_date: rcExclusiveEnd(toDate) });
  return data.result;
}

export async function getTypedLeaderboards(type: 'closer' | 'setter', fromDate: string, toDate: string): Promise<Leaderboard[]> {
  const data = await rcFetch('/leaderboards', { type, from_date: fromDate, to_date: rcExclusiveEnd(toDate) });
  return data.result;
}

export interface Appointment {
  id: number;
  customer_id: number;
  setter_id: number;
  closer_id: number;
  status: string;
  outcome: string;
  appointment_date: string;
  created_at: string;
  [key: string]: any;
}

export async function getAppointments(fromDate: string, toDate: string): Promise<Appointment[]> {
  const appointments: Appointment[] = [];
  let page = 1;
  while (true) {
    const data = await rcFetch('/appointments', {
      from_date: fromDate,
      to_date: rcExclusiveEnd(toDate),
      per_page: '100',
      page: String(page),
    });
    const items = data.result?.data || data.result || [];
    if (!Array.isArray(items) || items.length === 0) break;
    appointments.push(...items);
    const totalPages = data.result?.totalPages || 1;
    if (page >= totalPages) break;
    page++;
  }
  return appointments;
}

// ── RepCard Appointments with CT timezone filtering ──

export interface RCAppointment {
  id: number;
  startAt: string;       // ISO timestamp
  setterId: number | null;
  setterName: string | null;
  closerId: number | null;
  closerName: string | null;
  disposition: string | null;  // status.title from RepCard
}

/**
 * Fetch appointments from RepCard API with CT timezone-correct filtering.
 * Expands the date range by ±1 day to cover UTC/CT overlap, then filters
 * by dateBoundsUTC() in code.
 */
export async function fetchRepCardAppointmentsCT(
  from: string,
  to: string,
  opts?: { setterIds?: number[]; closerIds?: number[] },
): Promise<RCAppointment[]> {
  // Expand range ±1 day to handle CT/UTC boundary overlap
  const expandedFrom = addDays(from, -1);
  const expandedTo = addDays(to, 1);

  const params: Record<string, string> = {
    from_date: expandedFrom,
    to_date: rcExclusiveEnd(expandedTo),
    per_page: '100',
  };
  if (opts?.setterIds && opts.setterIds.length > 0) {
    params.setter_ids = opts.setterIds.join(',');
  }
  if (opts?.closerIds && opts.closerIds.length > 0) {
    params.closer_ids = opts.closerIds.join(',');
  }

  // Paginate (100/page)
  const raw: any[] = [];
  let page = 1;
  while (true) {
    const data = await rcFetch('/appointments', { ...params, page: String(page) });
    const items = data.result?.data || data.result || [];
    if (!Array.isArray(items) || items.length === 0) break;
    raw.push(...items);
    const totalPages = data.result?.totalPages || 1;
    if (page >= totalPages) break;
    page++;
  }

  // Filter by CT timezone bounds
  const bounds = dateBoundsUTC(from, to);
  const gteMs = new Date(bounds.gte).getTime();
  const lteMs = new Date(bounds.lte).getTime();

  const result: RCAppointment[] = [];
  for (const a of raw) {
    const startAt = a.startAt;
    if (!startAt) continue;
    const ts = new Date(startAt).getTime();
    if (ts < gteMs || ts > lteMs) continue;
    result.push({
      id: a.id,
      startAt,
      setterId: a.setter?.id ?? null,
      setterName: a.setter?.fullName || a.setter?.name || null,
      closerId: a.closer?.id ?? null,
      closerName: a.closer?.fullName || a.closer?.name || null,
      disposition: a.status?.title ?? null,
    });
  }

  return result;
}

