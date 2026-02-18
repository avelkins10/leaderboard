import { NextRequest, NextResponse } from 'next/server';
import { getTypedLeaderboards, getUsers } from '@/lib/repcard';
import { getSales } from '@/lib/quickbase';
import { OFFICE_MAPPING, teamIdToQBOffice } from '@/lib/config';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get('from') || getMonday();
  const toDate = searchParams.get('to') || getToday();
  const today = getToday();

  try {
    const [closerBoards, setterBoards, setterBoardsToday, users, sales] = await Promise.all([
      getTypedLeaderboards('closer', fromDate, toDate),
      getTypedLeaderboards('setter', fromDate, toDate),
      getTypedLeaderboards('setter', today, today),
      getUsers(),
      getSales(fromDate, toDate),
    ]);

    // Build user lookup
    const userMap: Record<number, any> = {};
    for (const u of users) userMap[u.id] = u;

    // Process leaderboards
    const setterLB = setterBoards.find((lb: any) => lb.leaderboard_name === 'Setter Leaderboard');
    const closerLB = closerBoards.find((lb: any) => lb.leaderboard_name === 'Closer Leaderboard');
    const setterApptLB = setterBoards.find((lb: any) => lb.leaderboard_name === 'Setter Appointment Data');
    const closerApptLB = closerBoards.find((lb: any) => lb.leaderboard_name === 'Closer Appointment Data');
    const setterTodayLB = setterBoardsToday.find((lb: any) => lb.leaderboard_name === 'Setter Leaderboard');

    const setterStats = processLeaderboard(setterLB, userMap);
    const closerStats = processLeaderboard(closerLB, userMap);
    const setterApptStats = processLeaderboard(setterApptLB, userMap);
    const closerApptStats = processLeaderboard(closerApptLB, userMap);
    const setterTodayStats = processLeaderboard(setterTodayLB, userMap);

    // Active reps per office (setters with DK > 0 today)
    const activeRepsByOffice: Record<string, number> = {};
    for (const s of setterTodayStats) {
      if ((s.DK || 0) > 0) {
        const office = s.qbOffice;
        if (office && office !== 'Unknown') {
          activeRepsByOffice[office] = (activeRepsByOffice[office] || 0) + 1;
        }
      }
    }

    // Process QB sales — index by both name and RepCard ID
    const salesByOffice: Record<string, { deals: number; kw: number; closers: Record<string, { deals: number; kw: number }> }> = {};
    const salesByCloser: Record<string, { deals: number; kw: number; office: string }> = {};
    const salesBySetter: Record<string, { deals: number; kw: number }> = {};
    const salesByCloserRC: Record<string, { deals: number; kw: number; office: string }> = {};
    const salesBySetterRC: Record<string, { deals: number; kw: number }> = {};

    for (const sale of sales) {
      const office = sale.salesOffice || 'Unknown';
      if (!salesByOffice[office]) salesByOffice[office] = { deals: 0, kw: 0, closers: {} };
      salesByOffice[office].deals++;
      salesByOffice[office].kw += sale.systemSizeKw;

      const closer = sale.closerName || 'Unknown';
      if (!salesByOffice[office].closers[closer]) salesByOffice[office].closers[closer] = { deals: 0, kw: 0 };
      salesByOffice[office].closers[closer].deals++;
      salesByOffice[office].closers[closer].kw += sale.systemSizeKw;

      if (!salesByCloser[closer]) salesByCloser[closer] = { deals: 0, kw: 0, office };
      salesByCloser[closer].deals++;
      salesByCloser[closer].kw += sale.systemSizeKw;

      if (sale.closerRepCardId) {
        if (!salesByCloserRC[sale.closerRepCardId]) salesByCloserRC[sale.closerRepCardId] = { deals: 0, kw: 0, office };
        salesByCloserRC[sale.closerRepCardId].deals++;
        salesByCloserRC[sale.closerRepCardId].kw += sale.systemSizeKw;
      }

      const setter = sale.setterName || 'Unknown';
      if (setter !== 'Unknown') {
        if (!salesBySetter[setter]) salesBySetter[setter] = { deals: 0, kw: 0 };
        salesBySetter[setter].deals++;
        salesBySetter[setter].kw += sale.systemSizeKw;
      }

      if (sale.setterRepCardId) {
        if (!salesBySetterRC[sale.setterRepCardId]) salesBySetterRC[sale.setterRepCardId] = { deals: 0, kw: 0 };
        salesBySetterRC[sale.setterRepCardId].deals++;
        salesBySetterRC[sale.setterRepCardId].kw += sale.systemSizeKw;
      }
    }

    // Build office scorecards
    const officeScores = buildOfficeScores(setterStats, closerStats, setterApptStats, closerApptStats, salesByOffice, salesByCloser, salesBySetter, salesByCloserRC, salesBySetterRC, activeRepsByOffice);

    return NextResponse.json({
      period: { from: fromDate, to: toDate },
      summary: {
        totalSales: sales.length,
        totalKw: sales.reduce((sum, s) => sum + s.systemSizeKw, 0),
        avgSystemSize: sales.length > 0 ? sales.reduce((sum, s) => sum + s.systemSizeKw, 0) / sales.length : 0,
        avgPpw: sales.length > 0 ? sales.reduce((sum, s) => sum + s.netPpw, 0) / sales.length : 0,
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

  for (const s of setterStats) {
    const office = s.qbOffice;
    if (office === 'Unknown') continue;
    const o = getOrCreate(office);
    // Attach QB closes to setter — prefer RepCard ID match, fallback to name
    const qbData = salesBySetterRC[s.userId] || salesBySetter[s.name];
    s.qbCloses = qbData?.deals || 0;
    o.setters.push(s);
  }

  for (const s of closerStats) {
    const office = s.qbOffice;
    if (office === 'Unknown') continue;
    const o = getOrCreate(office);
    // Attach QB closes to closer — prefer RepCard ID match, fallback to name
    const qbData = salesByCloserRC[s.userId] || salesByCloser[s.name];
    s.qbCloses = qbData?.deals || 0;
    o.closers.push(s);
  }

  // Attach setter appointment data (CANC, NOSH, etc.)
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
    o.sales = { deals: data.deals, kw: data.kw };
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
