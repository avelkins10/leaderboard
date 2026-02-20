/**
 * Shared data utility — single source of truth for metric computation.
 * Used by /api/scorecard, /api/rep/[id], and /api/office/[name].
 */

import { getTypedLeaderboards, getUsers, type RepUser, fetchRepCardAppointmentsCT } from "./repcard";
import { getSales, type QBSale } from "./quickbase";
import {
  OFFICE_MAPPING,
  teamIdToQBOffice,
  normalizeQBOffice,
  getOfficeTimezone,
} from "./config";
import { supabaseAdmin } from "./supabase";
import {
  getSetterActivity,
  getCloserActivity,
  type SetterActivity,
  type CloserActivity,
} from "./supabase-queries";

// Re-export date utils for backward compatibility
export { dateBoundsUTC, getMonday, getToday, CT_TZ } from "./date-utils";
import { dateBoundsUTC } from "./date-utils";

// ── Name cleanup — strip "R - " recruit prefix ──
export function cleanRepName(name: string): string {
  return name.replace(/^R\s*-\s*/i, "").trim();
}

export function isRecruit(firstName: string): boolean {
  return /^R\s*-\s*/i.test(firstName);
}

// ── Cancel detection — IDENTICAL everywhere ──
const CANCEL_PATTERNS = ["cancelled", "pending cancel"];
export function isCancel(status: string): boolean {
  const lower = status.toLowerCase();
  return CANCEL_PATTERNS.some((p) => lower.includes(p));
}

export function isRejected(status: string): boolean {
  return status.toLowerCase() === "rejected";
}

// ── PPW outlier detection — filter bad data from averages ──
const PPW_MIN = 0.5;
const PPW_MAX = 8.0;
export function isValidPpw(ppw: number): boolean {
  return ppw >= PPW_MIN && ppw <= PPW_MAX;
}

// ── Types ──
export interface SetterOutcomes {
  CANC: number;
  NOSH: number;
  NTR: number;
  RSCH: number;
  CF: number;
  SHAD: number;
}
export interface CloserOutcomes extends SetterOutcomes {
  FUS: number;
  NOCL: number;
}

export interface ProcessedSetter {
  userId: number;
  name: string;
  region: string;
  team: string;
  qbOffice: string;
  teamId: number;
  DK: number;
  APPT: number;
  SITS: number;
  "SIT%": number;
  "D/QH": number | string;
  qbCloses: number;
  qbCancelled: number;
  outcomes: SetterOutcomes;
  [key: string]: any;
}

export interface ProcessedCloser {
  userId: number;
  name: string;
  region: string;
  team: string;
  qbOffice: string;
  teamId: number;
  SAT: number;
  CLOS: number;
  "SIT%": number;
  "CLOSE%": number;
  qbCloses: number;
  qbCancelled: number;
  cancelPct: number;
  totalKw: number;
  avgPpw: number;
  outcomes: CloserOutcomes;
  [key: string]: any;
}

export interface SalesAgg {
  deals: number;
  kw: number;
  cancelled: number;
  cancelledKw: number;
  rejected: number;
  ppwSum: number;
  ppwCount: number;
  office?: string;
}

export interface OfficeSummary {
  setters: ProcessedSetter[];
  closers: ProcessedCloser[];
  sales: {
    deals: number;
    kw: number;
    cancelled: number;
    cancelledKw: number;
    rejected: number;
    cancelPct: number;
  };
  activeReps: number;
  activeSetters: number;
  activeClosers: number;
}

export interface ScorecardResult {
  period: { from: string; to: string };
  summary: {
    totalSales: number;
    totalKw: number;
    avgSystemSize: number;
    avgPpw: number;
    cancelled: number;
    cancelledKw: number;
    rejected: number;
    cancelPct: number;
    totalAppts: number;
    totalSits: number;
  };
  offices: Record<string, OfficeSummary>;
  allSetters: ProcessedSetter[];
  allClosers: ProcessedCloser[];
  salesByOffice: Record<string, SalesAgg>;
  activeRepsByOffice: Record<string, number>;
  avgStarsByOffice: Record<string, number>;
  avgFieldHoursByOffice: Record<string, number>;
}

/**
 * Build a ProcessedSetter from Supabase activity + user info + QP/DQH from leaderboard.
 */
function buildSetterFromActivity(
  act: SetterActivity,
  user: RepUser | undefined,
  qpMap: Record<number, { QP: number; "D/QH": number | string }>,
): ProcessedSetter {
  const qp = qpMap[act.userId];
  const qbOffice = user ? teamIdToQBOffice(user.officeTeamId) || "Unknown" : "Unknown";
  return {
    userId: act.userId,
    name: user ? cleanRepName(`${user.firstName} ${user.lastName}`) : act.name,
    isRecruit: user ? isRecruit(user.firstName) : false,
    region: user?.office || "Unknown",
    team: user?.team || "Unknown",
    qbOffice,
    teamId: user?.officeTeamId || 0,
    DK: act.DK,
    APPT: act.APPT,
    SITS: act.SITS,
    "SIT%": act.APPT > 0 ? Math.round((act.SITS / act.APPT) * 1000) / 10 : 0,
    "D/QH": qp?.["D/QH"] ?? 0,
    QP: qp?.QP ?? 0,
    CLOS: act.CLOS,
    avgStars: act.avgStars,
    qbCloses: 0,
    qbCancelled: 0,
    outcomes: act.outcomes,
  } as ProcessedSetter;
}

/**
 * Build a ProcessedCloser from Supabase activity + user info.
 */
function buildCloserFromActivity(
  act: CloserActivity,
  user: RepUser | undefined,
): ProcessedCloser {
  const qbOffice = user ? teamIdToQBOffice(user.officeTeamId) || "Unknown" : "Unknown";
  return {
    userId: act.userId,
    name: user ? cleanRepName(`${user.firstName} ${user.lastName}`) : act.name,
    isRecruit: user ? isRecruit(user.firstName) : false,
    region: user?.office || "Unknown",
    team: user?.team || "Unknown",
    qbOffice,
    teamId: user?.officeTeamId || 0,
    SAT: act.SAT,
    CLOS: act.CLOS,
    LEAD: act.LEAD,
    "SIT%": act.LEAD > 0 ? Math.round((act.SAT / act.LEAD) * 1000) / 10 : 0,
    "CLOSE%": act.SAT > 0 ? Math.round((act.CLOS / act.SAT) * 1000) / 10 : 0,
    qbCloses: 0,
    qbCancelled: 0,
    cancelPct: 0,
    totalKw: 0,
    avgPpw: 0,
    outcomes: act.outcomes,
  } as ProcessedCloser;
}

// ── Core: aggregate QB sales by closer/setter (RepCard ID primary, name fallback) ──
function aggregateSales(sales: QBSale[]) {
  const newAgg = (): SalesAgg => ({
    deals: 0,
    kw: 0,
    cancelled: 0,
    cancelledKw: 0,
    rejected: 0,
    ppwSum: 0,
    ppwCount: 0,
  });

  const byOffice: Record<string, SalesAgg> = {};
  const byCloserRC: Record<string, SalesAgg> = {};
  const byCloserName: Record<string, SalesAgg & { office?: string }> = {};
  const bySetterRC: Record<string, SalesAgg> = {};
  const bySetterName: Record<string, SalesAgg> = {};

  for (const sale of sales) {
    const cancelled = isCancel(sale.status);
    const rejected = isRejected(sale.status);
    const office = normalizeQBOffice(sale.salesOffice || "Unknown");

    // Office aggregation
    if (!byOffice[office]) byOffice[office] = newAgg();
    if (cancelled) {
      byOffice[office].cancelled++;
      byOffice[office].cancelledKw += sale.systemSizeKw;
    } else {
      byOffice[office].deals++;
      byOffice[office].kw += sale.systemSizeKw;
      if (isValidPpw(sale.netPpw)) {
        byOffice[office].ppwSum += sale.netPpw;
        byOffice[office].ppwCount++;
      }
    }
    if (rejected) byOffice[office].rejected++;

    // Closer: RepCard ID primary
    if (sale.closerRepCardId) {
      if (!byCloserRC[sale.closerRepCardId])
        byCloserRC[sale.closerRepCardId] = { ...newAgg(), office };
      const agg = byCloserRC[sale.closerRepCardId];
      if (cancelled) {
        agg.cancelled++;
        agg.cancelledKw += sale.systemSizeKw;
      } else {
        agg.deals++;
        agg.kw += sale.systemSizeKw;
        if (isValidPpw(sale.netPpw)) {
          agg.ppwSum += sale.netPpw;
          agg.ppwCount++;
        }
      }
      if (rejected) agg.rejected++;
    }

    // Closer: name fallback
    const closerName = sale.closerName || "Unknown";
    if (!byCloserName[closerName])
      byCloserName[closerName] = { ...newAgg(), office };
    if (cancelled) {
      byCloserName[closerName].cancelled++;
      byCloserName[closerName].cancelledKw += sale.systemSizeKw;
    } else {
      byCloserName[closerName].deals++;
      byCloserName[closerName].kw += sale.systemSizeKw;
      if (isValidPpw(sale.netPpw)) {
        byCloserName[closerName].ppwSum += sale.netPpw;
        byCloserName[closerName].ppwCount++;
      }
    }
    if (rejected) byCloserName[closerName].rejected++;

    // Setter: RepCard ID primary
    if (sale.setterRepCardId) {
      if (!bySetterRC[sale.setterRepCardId])
        bySetterRC[sale.setterRepCardId] = newAgg();
      const agg = bySetterRC[sale.setterRepCardId];
      if (cancelled) {
        agg.cancelled++;
        agg.cancelledKw += sale.systemSizeKw;
      } else {
        agg.deals++;
        agg.kw += sale.systemSizeKw;
      }
      if (rejected) agg.rejected++;
    }

    // Setter: name fallback
    const setterName = sale.setterName || "Unknown";
    if (setterName !== "Unknown") {
      if (!bySetterName[setterName]) bySetterName[setterName] = newAgg();
      if (cancelled) {
        bySetterName[setterName].cancelled++;
        bySetterName[setterName].cancelledKw += sale.systemSizeKw;
      } else {
        bySetterName[setterName].deals++;
        bySetterName[setterName].kw += sale.systemSizeKw;
      }
      if (rejected) bySetterName[setterName].rejected++;
    }
  }

  return { byOffice, byCloserRC, byCloserName, bySetterRC, bySetterName };
}

/**
 * Get QB sales attributed to a rep (RepCard ID primary, name fallback).
 * Used by rep API for consistent attribution.
 */
export function getRepSales(sales: QBSale[], userId: number, fullName: string) {
  const id = String(userId);
  const lowerName = fullName.toLowerCase();
  // Exact match on name (trimmed, case-insensitive) to avoid false positives like "Smith" matching "Smithson"
  const nameMatch = (field: string | undefined) =>
    field?.trim().toLowerCase() === lowerName;
  return {
    closerSales: sales.filter(
      (s) =>
        s.closerRepCardId === id ||
        (!s.closerRepCardId && nameMatch(s.closerName)),
    ),
    setterSales: sales.filter(
      (s) =>
        s.setterRepCardId === id ||
        (!s.setterRepCardId && nameMatch(s.setterName)),
    ),
    allSales: sales.filter(
      (s) =>
        s.closerRepCardId === id ||
        s.setterRepCardId === id ||
        (!s.closerRepCardId && nameMatch(s.closerName)) ||
        (!s.setterRepCardId && nameMatch(s.setterName)),
    ),
  };
}

/**
 * Compute closer QB stats consistently.
 */
export function computeCloserQBStats(closerSales: QBSale[]) {
  const active = closerSales.filter((s) => !isCancel(s.status));
  const cancelled = closerSales.filter((s) => isCancel(s.status));
  const totalDeals = active.length;
  const totalKw =
    Math.round(
      active.reduce((sum, s) => sum + (s.systemSizeKw || 0), 0) * 100,
    ) / 100;
  const avgSystemSize =
    totalDeals > 0 ? Math.round((totalKw / totalDeals) * 100) / 100 : 0;
  const salesWithPpw = active.filter((s) => isValidPpw(s.netPpw));
  const avgPpw =
    salesWithPpw.length > 0
      ? Math.round(
          (salesWithPpw.reduce((sum, s) => sum + s.netPpw, 0) /
            salesWithPpw.length) *
            100,
        ) / 100
      : 0;
  const total = totalDeals + cancelled.length;
  const cancelPct =
    total > 0 ? Math.round((cancelled.length / total) * 100) : 0;
  return {
    totalDeals,
    totalKw,
    avgSystemSize,
    avgPpw,
    cancelled: cancelled.length,
    cancelPct,
  };
}

/**
 * fetchScorecard — the single source of truth for all dashboard data.
 * Used by /api/scorecard. Rep and office APIs can also call individual pieces.
 */
export async function fetchScorecard(
  fromDate: string,
  toDate: string,
): Promise<ScorecardResult> {
  // Phase 1: fetch RepCard appointments (ONE call, company-wide), users, sales, QP/DQH
  const [prefetchedAppts, setterBoards, users, sales] =
    await Promise.all([
      fetchRepCardAppointmentsCT(fromDate, toDate),
      getTypedLeaderboards("setter", fromDate, toDate), // only for QP and D/QH
      getUsers(),
      getSales(fromDate, toDate),
    ]);

  // Phase 2: derive setter + closer activity from prefetched appointments
  const [setterActivityMap, closerActivityMap] = await Promise.all([
    getSetterActivity(fromDate, toDate, undefined, prefetchedAppts),
    getCloserActivity(fromDate, toDate, undefined, prefetchedAppts),
  ]);

  // Build user lookup
  const userMap: Record<number, RepUser> = {};
  for (const u of users) userMap[u.id] = u;

  // Extract QP and D/QH from setter leaderboard (no raw Supabase source for these)
  const qpMap: Record<number, { QP: number; "D/QH": number | string }> = {};
  const setterLB = setterBoards.find(
    (lb: any) => lb.leaderboard_name === "Setter Leaderboard",
  );
  if (setterLB && !Array.isArray(setterLB.stats) && setterLB.stats?.headers) {
    const headers = setterLB.stats.headers;
    for (const s of (setterLB.stats as any).stats || []) {
      if (s.item_type !== "user") continue;
      const vals: Record<string, any> = {};
      for (const h of headers) vals[h.short_name] = s[h.mapped_field] ?? 0;
      qpMap[s.item_id] = { QP: vals.QP || 0, "D/QH": vals["D/QH"] || 0 };
    }
  }

  // Aggregate sales
  const { byOffice, byCloserRC, byCloserName, bySetterRC, bySetterName } =
    aggregateSales(sales);

  // Build office scorecards
  const offices: Record<string, OfficeSummary> = {};
  const getOrCreate = (office: string): OfficeSummary => {
    if (!offices[office])
      offices[office] = {
        setters: [],
        closers: [],
        sales: {
          deals: 0,
          kw: 0,
          cancelled: 0,
          cancelledKw: 0,
          rejected: 0,
          cancelPct: 0,
        },
        activeReps: 0,
        activeSetters: 0,
        activeClosers: 0,
      };
    return offices[office];
  };

  // Fetch door_knocks for field time computation (need raw timestamps, not just counts)
  // Must paginate — Supabase default limit is 1000 rows, company-wide knocks easily exceed that
  const bounds = dateBoundsUTC(fromDate, toDate);
  const allKnocks: { rep_id: number; knocked_at: string }[] = [];
  {
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page } = await supabaseAdmin
        .from("door_knocks")
        .select("rep_id, knocked_at")
        .gte("knocked_at", bounds.gte)
        .lte("knocked_at", bounds.lte)
        .range(from, from + pageSize - 1);
      if (!page || page.length === 0) break;
      allKnocks.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }
  }

  // Build setters from Supabase activity + QB attribution
  const allSetters: ProcessedSetter[] = [];
  for (const idStr of Object.keys(setterActivityMap)) {
    const id = Number(idStr);
    const act = setterActivityMap[id];
    const user = userMap[id];
    // Skip reps from inactive offices
    if (user) {
      const mapping = OFFICE_MAPPING[user.officeTeamId];
      if (mapping?.active === false) continue;
    }
    const setter = buildSetterFromActivity(act, user, qpMap);
    // Attach QB sales
    const qbData = bySetterRC[setter.userId] || bySetterName[setter.name];
    setter.qbCloses = (qbData?.deals || 0) + (qbData?.cancelled || 0);
    setter.qbCancelled = qbData?.cancelled || 0;

    allSetters.push(setter);
    if (setter.qbOffice !== "Unknown") {
      getOrCreate(setter.qbOffice).setters.push(setter);
    }
  }

  // Compute avgStarsByOffice from activity data
  const avgStarsByOffice: Record<string, number> = {};
  const officeStarAgg: Record<string, { sum: number; count: number }> = {};
  for (const s of allSetters) {
    if ((s as any).avgStars > 0 && s.qbOffice !== "Unknown") {
      if (!officeStarAgg[s.qbOffice])
        officeStarAgg[s.qbOffice] = { sum: 0, count: 0 };
      // avgStars is per-setter average; weight by APPT count for proper office average
      officeStarAgg[s.qbOffice].sum += (s as any).avgStars * s.APPT;
      officeStarAgg[s.qbOffice].count += s.APPT;
    }
  }
  for (const [office, agg] of Object.entries(officeStarAgg)) {
    avgStarsByOffice[office] =
      agg.count > 0 ? Math.round((agg.sum / agg.count) * 100) / 100 : 0;
  }

  // Compute avgFieldHoursByOffice using setter→office mapping + local timezone
  const avgFieldHoursByOffice: Record<string, number> = {};
  if (allKnocks.length > 0) {
    const setterOfficeMap: Record<number, string> = {};
    for (const s of allSetters) {
      if (s.qbOffice !== "Unknown") setterOfficeMap[s.userId] = s.qbOffice;
    }
    const relevantKnocks = allKnocks.filter((k) => setterOfficeMap[k.rep_id]);
    const byRepDay: Record<string, { min: number; max: number; office: string }> = {};
    for (const k of relevantKnocks) {
      const office = setterOfficeMap[k.rep_id];
      const tz = getOfficeTimezone(office);
      const ts = new Date(k.knocked_at).getTime();
      const localDate = new Date(k.knocked_at).toLocaleDateString("en-CA", { timeZone: tz });
      const key = `${k.rep_id}|${localDate}`;
      if (!byRepDay[key]) {
        byRepDay[key] = { min: ts, max: ts, office };
      } else {
        if (ts < byRepDay[key].min) byRepDay[key].min = ts;
        if (ts > byRepDay[key].max) byRepDay[key].max = ts;
      }
    }
    const repHours: Record<number, { days: number[]; office: string }> = {};
    for (const [key, day] of Object.entries(byRepDay)) {
      const hours = (day.max - day.min) / 3600000;
      if (hours < 0.1) continue;
      const repId = parseInt(key.split("|")[0], 10);
      if (!repHours[repId]) repHours[repId] = { days: [], office: day.office };
      repHours[repId].days.push(hours);
    }
    const officeFieldAgg: Record<string, { sum: number; count: number }> = {};
    for (const { days, office } of Object.values(repHours)) {
      const repAvg = days.reduce((s, h) => s + h, 0) / days.length;
      if (!officeFieldAgg[office]) officeFieldAgg[office] = { sum: 0, count: 0 };
      officeFieldAgg[office].sum += repAvg;
      officeFieldAgg[office].count++;
    }
    for (const [office, agg] of Object.entries(officeFieldAgg)) {
      avgFieldHoursByOffice[office] = Math.round((agg.sum / agg.count) * 10) / 10;
    }
  }

  // Build closers from Supabase activity + QB attribution
  const allClosers: ProcessedCloser[] = [];
  for (const idStr of Object.keys(closerActivityMap)) {
    const id = Number(idStr);
    const act = closerActivityMap[id];
    const user = userMap[id];
    if (user) {
      const mapping = OFFICE_MAPPING[user.officeTeamId];
      if (mapping?.active === false) continue;
    }
    const closer = buildCloserFromActivity(act, user);
    // Attach QB sales
    const qbData = byCloserRC[closer.userId] || byCloserName[closer.name];
    closer.qbCloses = (qbData?.deals || 0) + (qbData?.cancelled || 0);
    closer.qbCancelled = qbData?.cancelled || 0;
    closer.totalKw = qbData?.kw || 0;
    closer.avgPpw =
      qbData && qbData.ppwCount > 0
        ? Math.round((qbData.ppwSum / qbData.ppwCount) * 100) / 100
        : 0;
    closer.cancelPct =
      closer.qbCloses > 0
        ? Math.round((closer.qbCancelled / closer.qbCloses) * 100)
        : 0;

    allClosers.push(closer);
    if (closer.qbOffice !== "Unknown") {
      getOrCreate(closer.qbOffice).closers.push(closer);
    }
  }

  // Attach office sales
  for (const [office, agg] of Object.entries(byOffice)) {
    const o = getOrCreate(office);
    const totalSold = agg.deals + agg.cancelled;
    o.sales = {
      deals: agg.deals + agg.cancelled,
      kw: agg.kw + agg.cancelledKw,
      cancelled: agg.cancelled,
      cancelledKw: agg.cancelledKw,
      rejected: agg.rejected,
      cancelPct:
        totalSold > 0 ? Math.round((agg.cancelled / totalSold) * 100) : 0,
    };
  }

  // Derive active reps from activity data
  const activeRepsByOffice: Record<string, number> = {};
  const activeRepsSeen: Record<string, Set<number>> = {};
  const activeSettersSeen: Record<string, Set<number>> = {};
  const activeClosersSeen: Record<string, Set<number>> = {};
  for (const s of allSetters) {
    if (s.DK > 0) {
      const office = s.qbOffice;
      if (office && office !== "Unknown") {
        if (!activeRepsSeen[office]) activeRepsSeen[office] = new Set();
        activeRepsSeen[office].add(s.userId);
        if (!activeSettersSeen[office]) activeSettersSeen[office] = new Set();
        activeSettersSeen[office].add(s.userId);
      }
    }
  }
  for (const c of allClosers) {
    if (c.SAT >= 1) {
      const office = c.qbOffice;
      if (office && office !== "Unknown") {
        if (!activeRepsSeen[office]) activeRepsSeen[office] = new Set();
        activeRepsSeen[office].add(c.userId);
        if (!activeClosersSeen[office]) activeClosersSeen[office] = new Set();
        activeClosersSeen[office].add(c.userId);
      }
    }
  }
  for (const [office, ids] of Object.entries(activeRepsSeen)) {
    activeRepsByOffice[office] = ids.size;
    const o = getOrCreate(office);
    o.activeReps = ids.size;
    o.activeSetters = activeSettersSeen[office]?.size || 0;
    o.activeClosers = activeClosersSeen[office]?.size || 0;
  }

  // Summary
  const activeSales = sales.filter((s) => !isCancel(s.status));
  const cancelledSales = sales.filter((s) => isCancel(s.status));
  const rejectedSales = sales.filter((s) => isRejected(s.status));

  const validPpwSales = activeSales.filter((s) => isValidPpw(s.netPpw));

  return {
    period: { from: fromDate, to: toDate },
    summary: {
      totalSales: sales.length,
      totalKw: sales.reduce((sum, s) => sum + s.systemSizeKw, 0),
      avgSystemSize:
        sales.length > 0
          ? sales.reduce((sum, s) => sum + s.systemSizeKw, 0) / sales.length
          : 0,
      avgPpw:
        validPpwSales.length > 0
          ? validPpwSales.reduce((sum, s) => sum + s.netPpw, 0) /
            validPpwSales.length
          : 0,
      cancelled: cancelledSales.length,
      cancelledKw: cancelledSales.reduce((sum, s) => sum + s.systemSizeKw, 0),
      rejected: rejectedSales.length,
      cancelPct:
        sales.length > 0
          ? Math.round((cancelledSales.length / sales.length) * 100)
          : 0,
      totalAppts: allSetters.reduce((sum, s) => sum + (s.APPT || 0), 0),
      totalSits: allSetters.reduce((sum, s) => sum + (s.SITS || 0), 0),
    },
    offices,
    allSetters,
    allClosers,
    salesByOffice: byOffice,
    activeRepsByOffice,
    avgStarsByOffice,
    avgFieldHoursByOffice,
  };
}
