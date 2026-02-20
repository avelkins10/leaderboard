import { supabaseAdmin } from "./supabase";
import { getTimezoneForTeam } from "./config";
import { dateBoundsUTC } from "./date-utils";
import type { RCAppointment } from "./repcard";

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

// ── Activity types (timezone-correct stats from raw Supabase data) ──

export interface SetterActivity {
  userId: number;
  name: string;
  DK: number;
  APPT: number;
  SITS: number;
  CLOS: number;
  avgStars: number;
  outcomes: {
    CANC: number;
    NOSH: number;
    NTR: number;
    RSCH: number;
    CF: number;
    SHAD: number;
  };
}

export interface CloserActivity {
  userId: number;
  name: string;
  LEAD: number;
  SAT: number;
  CLOS: number;
  outcomes: {
    NOCL: number;
    CF: number;
    FUS: number;
    SHAD: number;
    CANC: number;
    NOSH: number;
    RSCH: number;
    NTR: number;
  };
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

const SIT_CATS = new Set([
  "closed",
  "credit_fail",
  "no_close",
  "follow_up",
  "shade",
  "one_legger",
]);

// ── Activity queries (timezone-correct via dateBoundsUTC) ──

/**
 * Paginated Supabase query helper. Handles the 1000 row limit.
 */
async function paginatedQuery<T>(
  buildQuery: (offset: number, limit: number) => any,
): Promise<T[]> {
  const results: T[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery(offset, pageSize);
    if (error) throw error;
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return results;
}

/**
 * Compute setter activity stats.
 * APPT/SITS/CLOS/outcomes from RepCard Appointments API (source of truth).
 * DK from Supabase door_knocks (no RepCard API for individual knocks).
 * avgStars from Supabase appointments (webhook-enriched, no RepCard equivalent).
 *
 * @param prefetchedAppts - When provided, filter from this array instead of making a new RepCard API call.
 *   Used by company-wide callers (fetchScorecard, trends) to avoid duplicate fetches.
 */
export async function getSetterActivity(
  from: string,
  to: string,
  setterIds?: number[],
  prefetchedAppts?: RCAppointment[],
): Promise<Record<number, SetterActivity>> {
  const bounds = dateBoundsUTC(from, to);

  // 1. RepCard appointments (source of truth for APPT/SITS/CLOS/outcomes)
  let rcAppts: RCAppointment[];
  if (prefetchedAppts) {
    // Filter prefetched data to setter scope
    rcAppts = setterIds
      ? prefetchedAppts.filter((a) => a.setterId != null && setterIds.includes(a.setterId))
      : prefetchedAppts;
  } else {
    // Fetch from RepCard (scoped calls: office/rep)
    const { fetchRepCardAppointmentsCT } = await import("./repcard");
    rcAppts = await fetchRepCardAppointmentsCT(from, to,
      setterIds ? { setterIds } : undefined);
  }

  // 2. Supabase door_knocks for DK (paginated)
  const knocks = await paginatedQuery<{ rep_id: number; rep_name: string }>(
    (offset, limit) => {
      let q = supabaseAdmin
        .from("door_knocks")
        .select("rep_id, rep_name")
        .gte("knocked_at", bounds.gte)
        .lte("knocked_at", bounds.lte);
      if (setterIds && setterIds.length > 0) q = q.in("rep_id", setterIds);
      return q.range(offset, offset + limit - 1);
    },
  );

  // 3. Supabase star_rating for avgStars (paginated)
  const starRows = await paginatedQuery<{
    setter_id: number;
    star_rating: number | null;
  }>((offset, limit) => {
    let q = supabaseAdmin
      .from("appointments")
      .select("setter_id, star_rating")
      .gte("appointment_time", bounds.gte)
      .lte("appointment_time", bounds.lte)
      .not("star_rating", "is", null);
    if (setterIds && setterIds.length > 0) q = q.in("setter_id", setterIds);
    return q.range(offset, offset + limit - 1);
  });

  // Build per-setter aggregation
  const map = new Map<
    number,
    {
      name: string;
      dk: number;
      appt: number;
      sits: number;
      clos: number;
      starSum: number;
      starCount: number;
      canc: number;
      nosh: number;
      ntr: number;
      rsch: number;
      cf: number;
      shad: number;
    }
  >();

  const getOrCreate = (id: number, name: string) => {
    if (!map.has(id)) {
      map.set(id, {
        name,
        dk: 0,
        appt: 0,
        sits: 0,
        clos: 0,
        starSum: 0,
        starCount: 0,
        canc: 0,
        nosh: 0,
        ntr: 0,
        rsch: 0,
        cf: 0,
        shad: 0,
      });
    }
    const entry = map.get(id)!;
    if (name && entry.name.startsWith("Unknown")) entry.name = name;
    return entry;
  };

  // DK from Supabase
  for (const k of knocks) {
    if (!k.rep_id) continue;
    getOrCreate(k.rep_id, k.rep_name || `Unknown #${k.rep_id}`).dk++;
  }

  // APPT/SITS/CLOS/outcomes from RepCard
  for (const a of rcAppts) {
    if (!a.setterId) continue;
    const entry = getOrCreate(
      a.setterId,
      a.setterName || `Unknown #${a.setterId}`,
    );
    entry.appt++;
    const cat = dispositionCategory(a.disposition);
    if (SIT_CATS.has(cat)) entry.sits++;
    if (cat === "closed") entry.clos++;
    else if (cat === "canceled") entry.canc++;
    else if (cat === "no_show") entry.nosh++;
    else if (cat === "reschedule") entry.rsch++;
    else if (cat === "credit_fail") entry.cf++;
    else if (cat === "shade") entry.shad++;
    else if (cat === "other" || cat === "one_legger") entry.ntr++;
  }

  // avgStars from Supabase
  for (const s of starRows) {
    if (!s.setter_id || s.star_rating == null) continue;
    const entry = getOrCreate(s.setter_id, `Unknown #${s.setter_id}`);
    entry.starSum += s.star_rating;
    entry.starCount++;
  }

  const result: Record<number, SetterActivity> = {};
  map.forEach((entry, id) => {
    result[id] = {
      userId: id,
      name: entry.name,
      DK: entry.dk,
      APPT: entry.appt,
      SITS: entry.sits,
      CLOS: entry.clos,
      avgStars:
        entry.starCount > 0
          ? Math.round((entry.starSum / entry.starCount) * 100) / 100
          : 0,
      outcomes: {
        CANC: entry.canc,
        NOSH: entry.nosh,
        NTR: entry.ntr,
        RSCH: entry.rsch,
        CF: entry.cf,
        SHAD: entry.shad,
      },
    };
  });

  return result;
}

/**
 * Compute closer activity stats.
 * LEAD/SAT/CLOS/outcomes from RepCard Appointments API (source of truth).
 *
 * @param prefetchedAppts - When provided, filter from this array instead of making a new RepCard API call.
 */
export async function getCloserActivity(
  from: string,
  to: string,
  closerIds?: number[],
  prefetchedAppts?: RCAppointment[],
): Promise<Record<number, CloserActivity>> {
  // RepCard appointments (source of truth for LEAD/SAT/CLOS/outcomes)
  let rcAppts: RCAppointment[];
  if (prefetchedAppts) {
    rcAppts = closerIds
      ? prefetchedAppts.filter((a) => a.closerId != null && closerIds.includes(a.closerId))
      : prefetchedAppts;
  } else {
    const { fetchRepCardAppointmentsCT } = await import("./repcard");
    rcAppts = await fetchRepCardAppointmentsCT(from, to,
      closerIds ? { closerIds } : undefined);
  }

  const map = new Map<
    number,
    {
      name: string;
      lead: number;
      sat: number;
      clos: number;
      nocl: number;
      cf: number;
      fus: number;
      shad: number;
      canc: number;
      nosh: number;
      rsch: number;
      ntr: number;
    }
  >();

  for (const a of rcAppts) {
    if (!a.closerId) continue;
    if (!map.has(a.closerId)) {
      map.set(a.closerId, {
        name: a.closerName || `Unknown #${a.closerId}`,
        lead: 0,
        sat: 0,
        clos: 0,
        nocl: 0,
        cf: 0,
        fus: 0,
        shad: 0,
        canc: 0,
        nosh: 0,
        rsch: 0,
        ntr: 0,
      });
    }
    const entry = map.get(a.closerId)!;
    if (a.closerName && entry.name.startsWith("Unknown"))
      entry.name = a.closerName;
    entry.lead++;

    const cat = dispositionCategory(a.disposition);
    if (SIT_CATS.has(cat)) entry.sat++;
    if (cat === "closed") entry.clos++;
    else if (cat === "no_close") entry.nocl++;
    else if (cat === "credit_fail") entry.cf++;
    else if (cat === "follow_up") entry.fus++;
    else if (cat === "shade") entry.shad++;
    else if (cat === "canceled") entry.canc++;
    else if (cat === "no_show") entry.nosh++;
    else if (cat === "reschedule") entry.rsch++;
    else if (cat === "other" || cat === "one_legger") entry.ntr++;
  }

  const result: Record<number, CloserActivity> = {};
  map.forEach((entry, id) => {
    result[id] = {
      userId: id,
      name: entry.name,
      LEAD: entry.lead,
      SAT: entry.sat,
      CLOS: entry.clos,
      outcomes: {
        NOCL: entry.nocl,
        CF: entry.cf,
        FUS: entry.fus,
        SHAD: entry.shad,
        CANC: entry.canc,
        NOSH: entry.nosh,
        RSCH: entry.rsch,
        NTR: entry.ntr,
      },
    };
  });

  return result;
}

// ── Query Functions ──

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
    .gte("appointment_time", dateBoundsUTC(from, to).gte)
    .lte("appointment_time", dateBoundsUTC(from, to).lte)
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
    .gte("appointment_time", dateBoundsUTC(from, to).gte)
    .lte("appointment_time", dateBoundsUTC(from, to).lte)
    .order("appointment_time", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapAppointment);
}

export async function getOfficeSetterQualityStats(
  teamNames: string[],
  from: string,
  to: string,
  setterIds?: number[],
): Promise<SetterApptStats[]> {
  let query = supabaseAdmin
    .from("appointments")
    .select("*")
    .gte("appointment_time", dateBoundsUTC(from, to).gte)
    .lte("appointment_time", dateBoundsUTC(from, to).lte);

  if (setterIds && setterIds.length > 0) {
    // Primary: query by setter_id (works even when office_team is null)
    query = query.in("setter_id", setterIds);
  } else if (teamNames.length > 0) {
    // Fallback: query by office_team
    query = query.in("office_team", teamNames);
  } else {
    return [];
  }

  const { data, error } = await query;
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
  setterIds?: number[],
): Promise<PartnershipStats[]> {
  let query = supabaseAdmin
    .from("appointments")
    .select("setter_id, setter_name, closer_id, closer_name, disposition")
    .gte("appointment_time", dateBoundsUTC(from, to).gte)
    .lte("appointment_time", dateBoundsUTC(from, to).lte);

  if (setterIds && setterIds.length > 0) {
    query = query.in("setter_id", setterIds);
  } else if (teamNames.length > 0) {
    query = query.in("office_team", teamNames);
  } else {
    return [];
  }

  const { data, error } = await query;
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

export async function getCloserQualityByStars(
  teamNames: string[],
  from: string,
  to: string,
  setterIds?: number[],
): Promise<CloserQualityByStars[]> {
  let query = supabaseAdmin
    .from("appointments")
    .select("closer_id, closer_name, star_rating, disposition")
    .gte("appointment_time", dateBoundsUTC(from, to).gte)
    .lte("appointment_time", dateBoundsUTC(from, to).lte)
    .not("closer_id", "is", null)
    .not("star_rating", "is", null);

  if (setterIds && setterIds.length > 0) {
    query = query.in("setter_id", setterIds);
  } else if (teamNames.length > 0) {
    query = query.in("office_team", teamNames);
  } else {
    return [];
  }

  const { data, error } = await query;
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
    if (SIT_CATS.has(cat)) {
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
      power_bill_urls: appt.power_bill_urls || null,
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

// ── Field Time Stats from door_knocks ──

export interface RepFieldTime {
  rep_id: number;
  rep_name: string;
  daysKnocked: number;
  avgHoursPerDay: number;
  avgStartTime: string; // "2:30 PM" format
  avgEndTime: string;
}

/**
 * Compute field time stats from door_knocks table.
 * Groups by rep + local date, computes avg start/end/hours per day.
 * @param repIds - filter to specific reps (null = all reps)
 * @param teamNames - filter to specific office teams (null = all)
 * @param from - inclusive start date YYYY-MM-DD
 * @param to - inclusive end date YYYY-MM-DD
 * @param timezone - IANA timezone for local date grouping
 */
export async function getFieldTimeStats(
  repIds: number[] | null,
  teamNames: string[] | null,
  from: string,
  to: string,
  timezone: string,
): Promise<RepFieldTime[]> {
  // Paginate — Supabase default limit is 1000 rows, door knocks can easily exceed that
  const data: { rep_id: number; rep_name: string; knocked_at: string }[] = [];
  {
    const pageSize = 1000;
    let offset = 0;
    while (true) {
      let query = supabaseAdmin
        .from("door_knocks")
        .select("rep_id, rep_name, knocked_at")
        .gte("knocked_at", dateBoundsUTC(from, to).gte)
        .lte("knocked_at", dateBoundsUTC(from, to).lte);
      if (repIds && repIds.length > 0) query = query.in("rep_id", repIds);
      if (teamNames && teamNames.length > 0) query = query.in("office_team", teamNames);
      query = query.range(offset, offset + pageSize - 1);
      const { data: page, error } = await query;
      if (error || !page || page.length === 0) break;
      data.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
  }
  if (data.length === 0) return [];

  // Group knocks by rep_id + local date
  const byRepDay = new Map<string, Date[]>();
  const repNames = new Map<number, string>();

  for (const row of data) {
    const localDate = new Date(row.knocked_at).toLocaleDateString("en-CA", {
      timeZone: timezone,
    });
    const key = `${row.rep_id}|${localDate}`;
    if (!byRepDay.has(key)) byRepDay.set(key, []);
    byRepDay.get(key)!.push(new Date(row.knocked_at));
    if (row.rep_name) repNames.set(row.rep_id, row.rep_name);
  }

  // Per rep: compute daily first/last knock, then average
  const repDays = new Map<
    number,
    { hours: number; startMinutes: number; endMinutes: number }[]
  >();

  // Convert to local time-of-day in minutes since midnight
  const toLocalMinutes = (d: Date) => {
    const parts = d.toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    const [h, m] = parts.split(":").map(Number);
    return h * 60 + m;
  };

  byRepDay.forEach((knocks, key) => {
    const repId = parseInt(key.split("|")[0], 10);
    if (knocks.length < 2) return; // Need at least 2 knocks to compute a span

    const sorted = knocks.sort((a: Date, b: Date) => a.getTime() - b.getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const hours = (last.getTime() - first.getTime()) / (1000 * 60 * 60);

    if (!repDays.has(repId)) repDays.set(repId, []);
    repDays.get(repId)!.push({
      hours,
      startMinutes: toLocalMinutes(first),
      endMinutes: toLocalMinutes(last),
    });
  });

  // Average across days per rep
  const results: RepFieldTime[] = [];
  repDays.forEach((days, repId) => {
    if (days.length === 0) return;
    const n = days.length;
    type DayStats = { hours: number; startMinutes: number; endMinutes: number };
    const avgHours =
      Math.round(
        (days.reduce((s: number, d: DayStats) => s + d.hours, 0) / n) * 10,
      ) / 10;
    const avgStartMin = Math.round(
      days.reduce((s: number, d: DayStats) => s + d.startMinutes, 0) / n,
    );
    const avgEndMin = Math.round(
      days.reduce((s: number, d: DayStats) => s + d.endMinutes, 0) / n,
    );

    const formatMinutes = (mins: number) => {
      let h = Math.floor(mins / 60);
      const m = mins % 60;
      const ampm = h >= 12 ? "PM" : "AM";
      if (h === 0) h = 12;
      else if (h > 12) h -= 12;
      return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
    };

    results.push({
      rep_id: repId,
      rep_name: repNames.get(repId) || "",
      daysKnocked: n,
      avgHoursPerDay: avgHours,
      avgStartTime: formatMinutes(avgStartMin),
      avgEndTime: formatMinutes(avgEndMin),
    });
  });

  return results;
}
