import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboards, getUsers } from '@/lib/repcard';
import { getSales } from '@/lib/quickbase';
import { OFFICE_MAPPING, teamIdToQBOffice } from '@/lib/config';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get('from') || getMonday();
  const toDate = searchParams.get('to') || getToday();

  try {
    const [leaderboards, users, sales] = await Promise.all([
      getLeaderboards(fromDate, toDate),
      getUsers(),
      getSales(fromDate, toDate),
    ]);

    // Build user lookup
    const userMap: Record<number, any> = {};
    for (const u of users) {
      userMap[u.id] = u;
    }

    // Process leaderboards
    const setterLB = leaderboards.find((lb: any) => lb.leaderboard_name === 'Setter Leaderboard');
    const closerLB = leaderboards.find((lb: any) => lb.leaderboard_name === 'Closer Leaderboard');
    const setterApptLB = leaderboards.find((lb: any) => lb.leaderboard_name === 'Setter Appointment Data');
    const closerApptLB = leaderboards.find((lb: any) => lb.leaderboard_name === 'Closer Appointment Data');

    // Process setter stats
    const setterStats = processLeaderboard(setterLB, userMap);
    const closerStats = processLeaderboard(closerLB, userMap);
    const setterApptStats = processLeaderboard(setterApptLB, userMap);
    const closerApptStats = processLeaderboard(closerApptLB, userMap);

    // Process QB sales by office
    const salesByOffice: Record<string, { deals: number; kw: number; closers: Record<string, { deals: number; kw: number }> }> = {};
    const salesByCloser: Record<string, { deals: number; kw: number; office: string }> = {};
    const salesBySetter: Record<string, { deals: number; kw: number }> = {};

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

      const setter = sale.setterName || 'Unknown';
      if (setter !== 'Unknown') {
        if (!salesBySetter[setter]) salesBySetter[setter] = { deals: 0, kw: 0 };
        salesBySetter[setter].deals++;
        salesBySetter[setter].kw += sale.systemSizeKw;
      }
    }

    // Build office scorecards
    const officeScores = buildOfficeScores(setterStats, closerStats, salesByOffice, userMap);

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
      // Filter to only active offices
      const mapping = OFFICE_MAPPING[s.teamId];
      return mapping?.active !== false;
    });
}

function buildOfficeScores(
  setterStats: any[],
  closerStats: any[],
  salesByOffice: Record<string, any>,
  _userMap: Record<number, any>
) {
  const offices: Record<string, any> = {};

  // Aggregate setter stats by QB office
  for (const s of setterStats) {
    const office = s.qbOffice;
    if (office === 'Unknown') continue;
    if (!offices[office]) offices[office] = { setters: [], closers: [], sales: { deals: 0, kw: 0 } };
    offices[office].setters.push(s);
  }

  // Aggregate closer stats by QB office
  for (const s of closerStats) {
    const office = s.qbOffice;
    if (office === 'Unknown') continue;
    if (!offices[office]) offices[office] = { setters: [], closers: [], sales: { deals: 0, kw: 0 } };
    offices[office].closers.push(s);
  }

  // Add sales data
  for (const [office, data] of Object.entries(salesByOffice)) {
    if (!offices[office]) offices[office] = { setters: [], closers: [], sales: { deals: 0, kw: 0 } };
    offices[office].sales = { deals: data.deals, kw: data.kw };
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
