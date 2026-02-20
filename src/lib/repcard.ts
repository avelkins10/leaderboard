import { REPCARD_API_KEY } from './config';

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

