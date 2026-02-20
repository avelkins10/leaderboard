import { supabaseAdmin } from "./supabase";
import { getTimezoneForTeam, repCardTeamToQBOffice } from "./config";

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

export function dispositionCategory(d: string | null): string {
  if (!d) return "unknown";
  const lower = d.toLowerCase();
  // Check "no close" before "close" — "no close" contains "close" but is a distinct disposition
  if (lower.includes("no close")) return "no_close";
  if (lower.includes("no show") || lower.includes("no_show")) return "no_show";
  if (lower.includes("close") || lower === "closed") return "closed";
  if (lower.includes("cancel")) return "canceled";
  if (lower.includes("credit")) return "credit_fail";
  if (lower.includes("shade") || lower.includes("shading")) return "shade";
  if (lower.includes("one leg") || lower.includes("1 leg")) return "one_legger";
  if (lower.includes("follow")) return "follow_up";
  if (lower.includes("reschedule")) return "reschedule";
  return "other";
}

function toLocalTime(utcTime: string, timezone: string): string {
  try {
    return new Date(utcTime).toLocaleString("en-US", { timeZone: timezone });
  } catch {
    return utcTime;
  }
}

function aggregateStats(
  rows: any[],
  idField: string,
  nameField: string,
): any[] {
  const map: Record<number, any> = {};
  for (const row of rows) {
    const id = row[idField];
    if (!map[id]) {
      map[id] = {
        [idField]: id,
        [nameField]: row[nameField] || `Unknown #${id}`,
        office_team: row.office_team || "",
        total_appts: 0,
        power_bill_count: 0,
        quality_count: 0,
        star_sum: 0,
        star_count: 0,
        closed: 0,
        no_show: 0,
        canceled: 0,
        credit_fail: 0,
        shade: 0,
        one_legger: 0,
        no_close: 0,
        follow_up: 0,
        reschedule: 0,
      };
    }
    const s = map[id];
    s.total_appts++;
    if (row.has_power_bill) s.power_bill_count++;
    if (row.is_quality) s.quality_count++;
    if (row.star_rating != null) {
      s.star_sum += row.star_rating;
      s.star_count++;
    }
    const cat = dispositionCategory(row.disposition);
    if (cat in s) s[cat]++;
  }
  return Object.values(map).map((s) => {
    const { star_sum, star_count, ...rest } = s;
    return {
      ...rest,
      avg_stars:
        star_count > 0 ? Math.round((star_sum / star_count) * 10) / 10 : 0,
    };
  });
}

// ── Query Functions ──

export async function getSetterAppointmentStats(
  from: string,
  to: string,
): Promise<SetterApptStats[]> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("*")
    .gte("appointment_time", `${from}T00:00:00Z`)
    .lte("appointment_time", `${to}T23:59:59Z`);
  if (error) throw error;
  return aggregateStats(
    data || [],
    "setter_id",
    "setter_name",
  ) as SetterApptStats[];
}

export async function getCloserAppointmentStats(
  from: string,
  to: string,
): Promise<CloserApptStats[]> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("*")
    .gte("appointment_time", `${from}T00:00:00Z`)
    .lte("appointment_time", `${to}T23:59:59Z`);
  if (error) throw error;
  return aggregateStats(
    data || [],
    "closer_id",
    "closer_name",
  ) as CloserApptStats[];
}

function mapAppointment(row: any): Appointment {
  const tz = getTimezoneForTeam(row.office_team || "");
  return {
    id: row.id,
    setter_id: row.setter_id,
    setter_name: row.setter_name || "",
    closer_id: row.closer_id,
    closer_name: row.closer_name || "",
    contact_id: row.contact_id,
    contact_name: row.contact_name || "",
    contact_address: row.contact_address || "",
    office_team: row.office_team || "",
    disposition: row.disposition || "",
    disposition_category: dispositionCategory(row.disposition),
    has_power_bill: !!row.has_power_bill,
    hours_to_appointment: row.hours_to_appointment || 0,
    is_quality: !!row.is_quality,
    setter_notes: row.setter_notes || "",
    appointment_time: row.appointment_time,
    appointment_time_local: toLocalTime(row.appointment_time, tz),
    star_rating: row.star_rating || 0,
  };
}

export async function getSetterAppointments(
  setterId: number,
  from: string,
  to: string,
): Promise<Appointment[]> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("*")
    .eq("setter_id", setterId)
    .gte("appointment_time", `${from}T00:00:00Z`)
    .lte("appointment_time", `${to}T23:59:59Z`)
    .order("appointment_time", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapAppointment);
}

export async function getCloserAppointments(
  closerId: number,
  from: string,
  to: string,
): Promise<Appointment[]> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("*")
    .eq("closer_id", closerId)
    .gte("appointment_time", `${from}T00:00:00Z`)
    .lte("appointment_time", `${to}T23:59:59Z`)
    .order("appointment_time", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapAppointment);
}

export async function getActiveReps(
  from?: string,
  to?: string,
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};

  // Derive active reps from appointments (unique setter_id + closer_id) where office_team is known
  let query = supabaseAdmin
    .from("appointments")
    .select("office_team, setter_id, closer_id, appointment_time")
    .not("office_team", "is", null);

  if (from && to) {
    query = query
      .gte("appointment_time", `${from}T00:00:00Z`)
      .lte("appointment_time", `${to}T23:59:59Z`);
  } else {
    // Today mode — look back 7 days to catch upcoming/recent appointments
    const weekAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    query = query.gte("appointment_time", weekAgo);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Group unique rep IDs by QB office name (via repCardTeamToQBOffice)
  const byQBOffice: Record<string, Set<number>> = {};
  for (const row of data || []) {
    const teamName = row.office_team;
    if (!teamName) continue;
    const qbOffice = repCardTeamToQBOffice(teamName);
    if (!qbOffice) continue; // skip unmapped offices

    if (!byQBOffice[qbOffice]) byQBOffice[qbOffice] = new Set();
    if (row.setter_id) byQBOffice[qbOffice].add(row.setter_id);
    if (row.closer_id) byQBOffice[qbOffice].add(row.closer_id);
  }

  for (const [office, reps] of Object.entries(byQBOffice)) {
    results[office] = reps.size;
  }
  return results;
}

// Get per-day active rep counts for an office over a date range
export async function getDailyActiveReps(
  from: string,
  to: string,
  officeTeam?: string,
): Promise<Record<string, number>> {
  let query = supabaseAdmin
    .from("door_knocks")
    .select("office_team, rep_id, knocked_at")
    .gte("knocked_at", from)
    .lte("knocked_at", to + "T23:59:59Z");

  if (officeTeam) {
    query = query.eq("office_team", officeTeam);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Group by date (in office timezone) → count unique reps
  const byDate: Record<string, Set<number>> = {};
  for (const row of data || []) {
    const tz = getTimezoneForTeam(row.office_team || "");
    const knockDate = new Date(row.knocked_at).toLocaleDateString("en-CA", {
      timeZone: tz,
    });
    if (!byDate[knockDate]) byDate[knockDate] = new Set();
    byDate[knockDate].add(row.rep_id);
  }

  const result: Record<string, number> = {};
  for (const [date, reps] of Object.entries(byDate)) {
    result[date] = reps.size;
  }
  return result;
}

// ── Office-level queries ──

export interface AppointmentBreakdown {
  total: number;
  sat: number;
  closed: number;
  closer_fault: number;
  setter_fault: number;
  no_show: number;
  canceled: number;
  rescheduled: number;
  scheduled: number;
  other: number;
}

export async function getOfficeAppointmentBreakdown(
  teamNames: string[],
  from: string,
  to: string,
): Promise<AppointmentBreakdown> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("disposition")
    .in("office_team", teamNames)
    .gte("appointment_time", `${from}T00:00:00Z`)
    .lt("appointment_time", `${to}T00:00:00Z`);
  if (error) throw error;

  const result: AppointmentBreakdown = {
    total: 0,
    sat: 0,
    closed: 0,
    closer_fault: 0,
    setter_fault: 0,
    no_show: 0,
    canceled: 0,
    rescheduled: 0,
    scheduled: 0,
    other: 0,
  };
  for (const row of data || []) {
    result.total++;
    const cat = dispositionCategory(row.disposition);
    switch (cat) {
      case "unknown":
        result.scheduled++;
        break;
      case "closed":
        result.sat++;
        result.closed++;
        break;
      case "no_close":
      case "one_legger":
      case "follow_up":
        result.sat++;
        result.closer_fault++;
        break;
      case "credit_fail":
      case "shade":
        result.sat++;
        result.setter_fault++;
        break;
      case "no_show":
        result.no_show++;
        break;
      case "canceled":
        result.canceled++;
        break;
      case "reschedule":
        result.rescheduled++;
        break;
      default:
        result.other++;
    }
  }
  return result;
}

export async function getActiveClosers(
  teamNames: string[],
  from: string,
  to: string,
): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("closer_id")
    .in("office_team", teamNames)
    .gte("appointment_time", `${from}T00:00:00Z`)
    .lt("appointment_time", `${to}T00:00:00Z`);
  if (error) throw error;

  const unique = new Set<number>();
  for (const row of data || []) {
    if (row.closer_id) unique.add(row.closer_id);
  }
  return unique.size;
}

export async function getActiveSettersForOffice(
  teamNames: string[],
  from: string,
  to: string,
): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("door_knocks")
    .select("rep_id")
    .in("office_team", teamNames)
    .gte("knocked_at", `${from}T00:00:00Z`)
    .lt("knocked_at", `${to}T00:00:00Z`);
  if (error) throw error;

  const unique = new Set<number>();
  for (const row of data || []) {
    if (row.rep_id) unique.add(row.rep_id);
  }
  return unique.size;
}

export async function getOfficeSetterQualityStats(
  teamNames: string[],
  from: string,
  to: string,
): Promise<SetterApptStats[]> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("*")
    .in("office_team", teamNames)
    .gte("appointment_time", `${from}T00:00:00Z`)
    .lt("appointment_time", `${to}T00:00:00Z`);
  if (error) throw error;
  return aggregateStats(
    data || [],
    "setter_id",
    "setter_name",
  ) as SetterApptStats[];
}

export interface PartnershipStats {
  setter_id: number;
  setter_name: string;
  closer_id: number;
  closer_name: string;
  total_appts: number;
  sat: number;
  closed: number;
}

export async function getOfficePartnerships(
  teamNames: string[],
  from: string,
  to: string,
): Promise<PartnershipStats[]> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("setter_id, setter_name, closer_id, closer_name, disposition")
    .in("office_team", teamNames)
    .gte("appointment_time", `${from}T00:00:00Z`)
    .lt("appointment_time", `${to}T00:00:00Z`);
  if (error) throw error;

  const map: Record<string, PartnershipStats> = {};
  for (const row of data || []) {
    if (!row.setter_id || !row.closer_id) continue;
    const key = `${row.setter_id}-${row.closer_id}`;
    if (!map[key]) {
      map[key] = {
        setter_id: row.setter_id,
        setter_name: row.setter_name || `Setter #${row.setter_id}`,
        closer_id: row.closer_id,
        closer_name: row.closer_name || `Closer #${row.closer_id}`,
        total_appts: 0,
        sat: 0,
        closed: 0,
      };
    }
    map[key].total_appts++;
    const cat = dispositionCategory(row.disposition);
    // "sat" = closer showed up (all dispositioned except no_show, canceled, reschedule, unknown)
    if (
      [
        "closed",
        "no_close",
        "one_legger",
        "follow_up",
        "credit_fail",
        "shade",
      ].includes(cat)
    ) {
      map[key].sat++;
    }
    if (cat === "closed") {
      map[key].closed++;
    }
  }
  return Object.values(map).sort((a, b) => b.total_appts - a.total_appts);
}

// ── Speed-to-close: days from lead creation to QB sale date ──

export interface SpeedToCloseResult {
  avgDaysOverall: number;
  byOffice: Record<string, { avgDays: number; count: number }>;
  byCloser: Record<
    string,
    { avgDays: number; count: number; closerName: string }
  >;
}

export async function getSpeedToClose(
  from: string,
  to: string,
): Promise<SpeedToCloseResult> {
  // Join deal_matches with appointments to get lead_created_at and qb_sale_date
  const { data, error } = await supabaseAdmin
    .from("deal_matches")
    .select("qb_sale_date, qb_sales_office, qb_closer_rc_id, appointment_id")
    .gte("qb_sale_date", from)
    .lte("qb_sale_date", to);
  if (error) throw error;
  if (!data || data.length === 0) {
    return { avgDaysOverall: 0, byOffice: {}, byCloser: {} };
  }

  // Fetch appointment lead_created_at for all matched appointments
  const apptIds = data.map((d) => d.appointment_id).filter(Boolean) as number[];
  const apptMap = new Map<number, string>();
  const closerNameMap = new Map<string, string>();

  if (apptIds.length > 0) {
    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("id, lead_created_at, contact_created_at, closer_name, closer_id")
      .in("id", apptIds);
    for (const a of appts || []) {
      const leadDate = a.lead_created_at || a.contact_created_at;
      if (leadDate) apptMap.set(a.id, leadDate);
      if (a.closer_id)
        closerNameMap.set(
          String(a.closer_id),
          a.closer_name || `Closer #${a.closer_id}`,
        );
    }
  }

  // Compute days between lead creation and sale date
  const officeAgg: Record<string, { totalDays: number; count: number }> = {};
  const closerAgg: Record<
    string,
    { totalDays: number; count: number; closerName: string }
  > = {};
  let totalDays = 0;
  let totalCount = 0;

  for (const match of data) {
    if (!match.appointment_id || !match.qb_sale_date) continue;
    const leadDate = apptMap.get(match.appointment_id);
    if (!leadDate) continue;

    const days =
      (new Date(match.qb_sale_date).getTime() - new Date(leadDate).getTime()) /
      (1000 * 60 * 60 * 24);
    if (days < 0 || days > 365) continue; // filter outliers

    totalDays += days;
    totalCount++;

    // By office
    const office = match.qb_sales_office || "Unknown";
    if (!officeAgg[office]) officeAgg[office] = { totalDays: 0, count: 0 };
    officeAgg[office].totalDays += days;
    officeAgg[office].count++;

    // By closer
    const closerId = match.qb_closer_rc_id
      ? String(match.qb_closer_rc_id)
      : null;
    if (closerId) {
      if (!closerAgg[closerId]) {
        closerAgg[closerId] = {
          totalDays: 0,
          count: 0,
          closerName: closerNameMap.get(closerId) || `Closer #${closerId}`,
        };
      }
      closerAgg[closerId].totalDays += days;
      closerAgg[closerId].count++;
    }
  }

  const byOffice: Record<string, { avgDays: number; count: number }> = {};
  for (const [office, agg] of Object.entries(officeAgg)) {
    byOffice[office] = {
      avgDays: Math.round((agg.totalDays / agg.count) * 10) / 10,
      count: agg.count,
    };
  }

  const byCloser: Record<
    string,
    { avgDays: number; count: number; closerName: string }
  > = {};
  for (const [closerId, agg] of Object.entries(closerAgg)) {
    byCloser[closerId] = {
      avgDays: Math.round((agg.totalDays / agg.count) * 10) / 10,
      count: agg.count,
      closerName: agg.closerName,
    };
  }

  return {
    avgDaysOverall:
      totalCount > 0 ? Math.round((totalDays / totalCount) * 10) / 10 : 0,
    byOffice,
    byCloser,
  };
}

// ── Closer quality stats by star rating ──

export interface CloserQualityByStars {
  closerId: number;
  closerName: string;
  star1SitRate: number | null;
  star2SitRate: number | null;
  star3SitRate: number | null;
  star1Count: number;
  star2Count: number;
  star3Count: number;
}

const SIT_DISPOSITIONS = new Set([
  "closed",
  "credit_fail",
  "no_close",
  "follow_up",
  "shade",
  "one_legger",
]);

export async function getCloserQualityByStars(
  teamNames: string[],
  from: string,
  to: string,
): Promise<CloserQualityByStars[]> {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("closer_id, closer_name, star_rating, disposition")
    .in("office_team", teamNames)
    .gte("appointment_time", `${from}T00:00:00Z`)
    .lt("appointment_time", `${to}T00:00:00Z`)
    .not("closer_id", "is", null)
    .not("star_rating", "is", null);
  if (error) throw error;

  // Group by closer_id + star_rating
  const closerMap: Record<
    number,
    {
      closerName: string;
      byStar: Record<number, { total: number; sat: number }>;
    }
  > = {};

  for (const row of data || []) {
    if (!row.closer_id || !row.star_rating) continue;
    if (!closerMap[row.closer_id]) {
      closerMap[row.closer_id] = {
        closerName: row.closer_name || `Closer #${row.closer_id}`,
        byStar: {},
      };
    }
    const star = row.star_rating;
    if (!closerMap[row.closer_id].byStar[star]) {
      closerMap[row.closer_id].byStar[star] = { total: 0, sat: 0 };
    }
    closerMap[row.closer_id].byStar[star].total++;
    const cat = dispositionCategory(row.disposition);
    if (SIT_DISPOSITIONS.has(cat)) {
      closerMap[row.closer_id].byStar[star].sat++;
    }
  }

  const MIN_SAMPLE = 2;
  return Object.entries(closerMap).map(([id, entry]) => {
    const rate = (star: number) => {
      const bucket = entry.byStar[star];
      if (!bucket || bucket.total < MIN_SAMPLE) return null;
      return Math.round((bucket.sat / bucket.total) * 1000) / 10;
    };
    return {
      closerId: Number(id),
      closerName: entry.closerName,
      star1SitRate: rate(1),
      star2SitRate: rate(2),
      star3SitRate: rate(3),
      star1Count: entry.byStar[1]?.total || 0,
      star2Count: entry.byStar[2]?.total || 0,
      star3Count: entry.byStar[3]?.total || 0,
    };
  });
}

// ── Setter Funnel from lead_status_changes ──

export interface SetterFunnelEntry {
  setterId: number;
  setterName: string;
  officeName: string;
  doorKnocks: number;
  appointmentScheduled: number;
  notInterested: number;
  notHome: number;
  comeBack: number;
  dq: number;
  other: number;
}

export async function getSetterFunnel(
  from: string,
  to: string,
): Promise<SetterFunnelEntry[]> {
  const { data, error } = await supabaseAdmin
    .from("lead_status_changes")
    .select("rep_id, rep_name, office_team, new_status")
    .gte("changed_at", `${from}T00:00:00Z`)
    .lt("changed_at", `${to}T00:00:00Z`)
    .not("rep_id", "is", null);
  if (error) throw error;

  const map: Record<
    number,
    {
      name: string;
      office: string;
      doorKnocks: number;
      appointmentScheduled: number;
      notInterested: number;
      notHome: number;
      comeBack: number;
      dq: number;
      other: number;
    }
  > = {};

  for (const row of data || []) {
    if (!row.rep_id) continue;
    if (!map[row.rep_id]) {
      map[row.rep_id] = {
        name: row.rep_name || `Rep #${row.rep_id}`,
        office: row.office_team || "Unknown",
        doorKnocks: 0,
        appointmentScheduled: 0,
        notInterested: 0,
        notHome: 0,
        comeBack: 0,
        dq: 0,
        other: 0,
      };
    }
    const entry = map[row.rep_id];
    const status = (row.new_status || "").toLowerCase();

    if (status.includes("not home")) {
      entry.notHome++;
      entry.doorKnocks++;
    } else if (status.includes("not interested")) {
      entry.notInterested++;
      entry.doorKnocks++;
    } else if (status.includes("appointment scheduled")) {
      entry.appointmentScheduled++;
      entry.doorKnocks++;
    } else if (status.includes("come back")) {
      entry.comeBack++;
      entry.doorKnocks++;
    } else if (status.includes("dq")) {
      entry.dq++;
      entry.doorKnocks++;
    } else {
      entry.other++;
      entry.doorKnocks++;
    }
  }

  return Object.entries(map).map(([id, e]) => ({
    setterId: Number(id),
    setterName: e.name,
    officeName: e.office,
    doorKnocks: e.doorKnocks,
    appointmentScheduled: e.appointmentScheduled,
    notInterested: e.notInterested,
    notHome: e.notHome,
    comeBack: e.comeBack,
    dq: e.dq,
    other: e.other,
  }));
}

export async function getContactTimeline(
  contactId: number,
): Promise<TimelineEvent[]> {
  const [
    apptResult,
    knockResult,
    statusResult,
    typeResult,
    attachResult,
    matchResult,
  ] = await Promise.all([
    supabaseAdmin.from("appointments").select("*").eq("contact_id", contactId),
    supabaseAdmin.from("door_knocks").select("*").eq("contact_id", contactId),
    supabaseAdmin
      .from("lead_status_changes")
      .select("*")
      .eq("contact_id", contactId)
      .order("changed_at"),
    supabaseAdmin
      .from("contact_type_changes")
      .select("*")
      .eq("contact_id", contactId)
      .order("changed_at"),
    supabaseAdmin
      .from("attachments")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at"),
    supabaseAdmin.from("deal_matches").select("*").eq("contact_id", contactId),
  ]);

  if (apptResult.error) throw apptResult.error;
  if (knockResult.error) throw knockResult.error;

  const events: TimelineEvent[] = [];

  for (const knock of knockResult.data || []) {
    events.push({
      type: "door_knock",
      date: knock.knocked_at,
      rep_name: knock.rep_name || "",
      outcome: knock.outcome || "",
      address: knock.address || "",
    });
  }

  for (const appt of apptResult.data || []) {
    events.push({
      type: "appointment_set",
      date: appt.appointment_time || appt.created_at,
      setter: appt.setter_name || "",
      closer: appt.closer_name || "",
      has_power_bill: !!appt.has_power_bill,
      star_rating: appt.star_rating,
    });
    if (appt.disposition) {
      events.push({
        type: "disposition",
        date: appt.disposition_date || appt.appointment_time,
        disposition: appt.disposition,
        closer: appt.closer_name || "",
      });
    }
  }

  for (const sc of statusResult.data || []) {
    events.push({
      type: "status_change",
      date: sc.changed_at || sc.created_at,
      old_status: sc.old_status,
      new_status: sc.new_status,
      rep_name: sc.rep_name || "",
    });
  }

  for (const tc of typeResult.data || []) {
    events.push({
      type: "contact_type_change",
      date: tc.changed_at || tc.created_at,
      old_type: tc.old_type,
      new_type: tc.new_type,
      closer_name: tc.closer_name || "",
    });
  }

  for (const att of attachResult.data || []) {
    events.push({
      type: "attachment",
      date: att.uploaded_at || att.created_at,
      url: att.url,
      attachment_type: att.attachment_type,
    });
  }

  for (const dm of matchResult.data || []) {
    events.push({
      type: "deal_match",
      date: dm.matched_at || dm.qb_sale_date,
      qb_record_id: dm.qb_record_id,
      match_method: dm.match_method,
      match_confidence: dm.match_confidence,
      qb_customer_name: dm.qb_customer_name,
    });
  }

  events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  return events;
}
