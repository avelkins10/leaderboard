import { NextRequest, NextResponse } from 'next/server';
import { getTypedLeaderboards, getUsers } from '@/lib/repcard';
import { getSales } from '@/lib/quickbase';
import { OFFICE_MAPPING, teamIdToQBOffice } from '@/lib/config';
import { getActiveReps } from '@/lib/supabase-queries';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get('from') || getMonday();
  const toDate = searchParams.get('to') || getToday();
  const today = getToday();

  try {
    const [closerBoards, setterBoards, users, sales, activeRepsByOffice] = await Promise.all([
      getTypedLeaderboards('closer', fromDate, toDate),
      getTypedLeaderboards('setter', fromDate, toDate),
      getUsers(),
      getSales(fromDate, toDate),
      getActiveReps(fromDate, toDate),
    ]);

    // Build user lookup
    const userMap: Record<number, any> = {};
    for (const u of users) userMap[u.id] = u;

    // Process leaderboards
    const setterLB = setterBoards.find((lb: any) => lb.leaderboard_name === 'Setter Leaderboard');
    const closerLB = closerBoards.find((lb: any) => lb.leaderboard_name === 'Closer Leaderboard');
    const setterApptLB = setterBoards.find((lb: any) => lb.leaderboard_name === 'Setter Appointment Data');
    const closerApptLB = closerBoards.find((lb: any) => lb.leaderboard_name === 'Closer Appointment Data');

    const setterStats = processLeaderboard(setterLB, userMap);
    const closerStats = processLeaderboard(closerLB, userMap);
    const setterApptStats = processLeaderboard(setterApptLB, userMap);
    const closerApptStats = processLeaderboard(closerApptLB, userMap);

    // Process QB sales — split active vs cancelled
    const CANCEL_STATUSES = ['cancelled', 'pending cancel'];
    const isCancel = (status: string) => CANCEL_STATUSES.some(cs => status.toLowerCase().includes(cs));

    const activeSales = sales.filter(s => !isCancel(s.status));
    const cancelledSales = sales.filter(s => isCancel(s.status));

    type SalesAgg = { deals: number; kw: number; cancelled: number; cancelledKw: number; office?: string; closers?: Record<string, SalesAgg> };
    const newAgg = (office?: string): SalesAgg => ({ deals: 0, kw: 0, cancelled: 0, cancelledKw: 0, ...(office ? { office } : {}) });

    const salesByOffice: Record<string, SalesAgg> = {};
    const salesByCloser: Record<string, SalesAgg> = {};
    const salesBySetter: Record<string, SalesAgg> = {};
    const salesByCloserRC: Record<string, SalesAgg> = {};
    const salesBySetterRC: Record<string, SalesAgg> = {};

    for (const sale of sales) {
      const cancelled = isCancel(sale.status);
      const office = sale.salesOffice || 'Unknown';
      if (!salesByOffice[office]) salesByOffice[office] = { ...newAgg(), closers: {} };
      if (cancelled) { salesByOffice[office].cancelled++; salesByOffice[office].cancelledKw += sale.systemSizeKw; }
      else { salesByOffice[office].deals++; salesByOffice[office].kw += sale.systemSizeKw; }

      const closer = sale.closerName || 'Unknown';
      if (!salesByOffice[office].closers![closer]) salesByOffice[office].closers![closer] = newAgg();
      if (cancelled) { salesByOffice[office].closers![closer].cancelled++; salesByOffice[office].closers![closer].cancelledKw += sale.systemSizeKw; }
      else { salesByOffice[office].closers![closer].deals++; salesByOffice[office].closers![closer].kw += sale.systemSizeKw; }

      if (!salesByCloser[closer]) salesByCloser[closer] = { ...newAgg(), office };
      if (cancelled) { salesByCloser[closer].cancelled++; salesByCloser[closer].cancelledKw += sale.systemSizeKw; }
      else { salesByCloser[closer].deals++; salesByCloser[closer].kw += sale.systemSizeKw; }

      if (sale.closerRepCardId) {
        if (!salesByCloserRC[sale.closerRepCardId]) salesByCloserRC[sale.closerRepCardId] = { ...newAgg(), office };
        if (cancelled) { salesByCloserRC[sale.closerRepCardId].cancelled++; salesByCloserRC[sale.closerRepCardId].cancelledKw += sale.systemSizeKw; }
        else { salesByCloserRC[sale.closerRepCardId].deals++; salesByCloserRC[sale.closerRepCardId].kw += sale.systemSizeKw; }
      }

      const setter = sale.setterName || 'Unknown';
      if (setter !== 'Unknown') {
        if (!salesBySetter[setter]) salesBySetter[setter] = newAgg();
        if (cancelled) { salesBySetter[setter].cancelled++; salesBySetter[setter].cancelledKw += sale.systemSizeKw; }
        else { salesBySetter[setter].deals++; salesBySetter[setter].kw += sale.systemSizeKw; }
      }

      if (sale.setterRepCardId) {
        if (!salesBySetterRC[sale.setterRepCardId]) salesBySetterRC[sale.setterRepCardId] = newAgg();
        if (cancelled) { salesBySetterRC[sale.setterRepCardId].cancelled++; salesBySetterRC[sale.setterRepCardId].cancelledKw += sale.systemSizeKw; }
        else { salesBySetterRC[sale.setterRepCardId].deals++; salesBySetterRC[sale.setterRepCardId].kw += sale.systemSizeKw; }
      }
    }

    // Build office scorecards
    const officeScores = buildOfficeScores(setterStats, closerStats, setterApptStats, closerApptStats, salesByOffice, salesByCloser, salesBySetter, salesByCloserRC, salesBySetterRC, activeRepsByOffice);

    return NextResponse.json({
      period: { from: fromDate, to: toDate },
      summary: {
        totalSales: activeSales.length,
        totalKw: activeSales.reduce((sum, s) => sum + s.systemSizeKw, 0),
        avgSystemSize: activeSales.length > 0 ? activeSales.reduce((sum, s) => sum + s.systemSizeKw, 0) / activeSales.length : 0,
        avgPpw: activeSales.length > 0 ? activeSales.reduce((sum, s) => sum + s.netPpw, 0) / activeSales.length : 0,
        cancelled: cancelledSales.length,
        cancelledKw: cancelledSales.reduce((sum, s) => sum + s.systemSizeKw, 0),
        cancelPct: sales.length > 0 ? Math.round((cancelledSales.length / sales.length) * 100) : 0,
      },
      offices: officeScores,
      setterLeaderboard: setterStats,
      closerLeaderboard: closerStats,
      setterAppointments: setterApptStats,
      closerAppointments: closerApptStats,
      salesByOffice,
      salesByCloser,
      salesBySetter,
      activeRepsByOffice,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function processLeaderboard(lb: any, userMap: Record<number, any>) {
  if (!lb || !lb.stats?.headers) return [];

  const headers = lb.stats.headers;
  const stats = lb.stats.stats || [];

  return stats
    .filter((s: any) => s.item_type === 'user')
    .map((s: any) => {
      const user = userMap[s.item_id];
      const values: Record<string, any> = {};
      for (const h of headers) {
        values[h.short_name] = s[h.mapped_field] ?? 0;
      }
      const qbOffice = teamIdToQBOffice(s.office_team_id);
      return {
        userId: s.item_id,
        name: user ? `${user.firstName} ${user.lastName}` : `User #${s.item_id}`,
        region: user?.office || OFFICE_MAPPING[s.office_id]?.name || 'Unknown',
        team: user?.team || OFFICE_MAPPING[s.office_team_id]?.name || 'Unknown',
        qbOffice: qbOffice || 'Unknown',
        teamId: s.office_team_id,
        ...values,
      };
    })
    .filter((s: any) => {
      const mapping = OFFICE_MAPPING[s.teamId];
      return mapping?.active !== false;
    });
}

function buildOfficeScores(
  setterStats: any[],
  closerStats: any[],
  setterApptStats: any[],
  closerApptStats: any[],
  salesByOffice: Record<string, any>,
  salesByCloser: Record<string, any>,
  salesBySetter: Record<string, any>,
  salesByCloserRC: Record<string, any>,
  salesBySetterRC: Record<string, any>,
  activeRepsByOffice: Record<string, number>
) {
  const offices: Record<string, any> = {};

  const getOrCreate = (office: string) => {
    if (!offices[office]) offices[office] = {
      setters: [], closers: [], setterAppts: [], closerAppts: [],
      sales: { deals: 0, kw: 0 }, activeReps: 0,
    };
    return offices[office];
  };

  // Build lookup maps for appointment data by userId
  const setterApptMap: Record<number, any> = {};
  for (const sa of setterApptStats) setterApptMap[sa.userId] = sa;
  const closerApptMap: Record<number, any> = {};
  for (const ca of closerApptStats) closerApptMap[ca.userId] = ca;

  for (const s of setterStats) {
    const office = s.qbOffice;
    if (office === 'Unknown') continue;
    const o = getOrCreate(office);
    // Attach QB closes to setter — prefer RepCard ID match, fallback to name
    const qbData = salesBySetterRC[s.userId] || salesBySetter[s.name];
    s.qbCloses = qbData?.deals || 0;
    s.qbCancelled = qbData?.cancelled || 0;
    // Merge appointment outcome breakdown (CANC, NOSH, NTR, RSCH, CF, SHAD)
    const apptData = setterApptMap[s.userId];
    if (apptData) {
      s.outcomes = {
        CANC: apptData.CANC || 0,
        NOSH: apptData.NOSH || 0,
        NTR: apptData.NTR || 0,
        RSCH: apptData.RSCH || 0,
        CF: apptData.CF || 0,
        SHAD: apptData.SHAD || 0,
      };
    }
    o.setters.push(s);
  }

  for (const s of closerStats) {
    const office = s.qbOffice;
    if (office === 'Unknown') continue;
    const o = getOrCreate(office);
    // Attach QB closes to closer — prefer RepCard ID match, fallback to name
    const qbData = salesByCloserRC[s.userId] || salesByCloser[s.name];
    s.qbCloses = qbData?.deals || 0;
    s.qbCancelled = qbData?.cancelled || 0;
    const totalSold = s.qbCloses + s.qbCancelled;
    s.cancelPct = totalSold > 0 ? Math.round((s.qbCancelled / totalSold) * 100) : 0;
    // Merge appointment outcome breakdown
    const apptData = closerApptMap[s.userId];
    if (apptData) {
      s.outcomes = {
        CANC: apptData.CANC || 0,
        NOSH: apptData.NOSH || 0,
        NTR: apptData.NTR || 0,
        RSCH: apptData.RSCH || 0,
        CF: apptData.CF || 0,
        SHAD: apptData.SHAD || 0,
        FUS: apptData.FUS || 0,
        NOCL: apptData.NOCL || 0,
      };
    }
    o.closers.push(s);
  }

  // Keep setterAppts/closerAppts arrays for backward compat
  for (const s of setterApptStats) {
    const office = s.qbOffice;
    if (office === 'Unknown') continue;
    getOrCreate(office).setterAppts.push(s);
  }

  for (const s of closerApptStats) {
    const office = s.qbOffice;
    if (office === 'Unknown') continue;
    getOrCreate(office).closerAppts.push(s);
  }

  for (const [office, data] of Object.entries(salesByOffice)) {
    const o = getOrCreate(office);
    const totalSold = data.deals + data.cancelled;
    o.sales = {
      deals: data.deals,
      kw: data.kw,
      cancelled: data.cancelled,
      cancelledKw: data.cancelledKw,
      cancelPct: totalSold > 0 ? Math.round((data.cancelled / totalSold) * 100) : 0,
    };
  }

  for (const [office, count] of Object.entries(activeRepsByOffice)) {
    const o = getOrCreate(office);
    o.activeReps = count;
  }

  return offices;
}

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
