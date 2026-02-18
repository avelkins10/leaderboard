import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboards, getUsers } from '@/lib/repcard';
import { getSales } from '@/lib/quickbase';
import { teamIdToQBOffice, OFFICE_MAPPING } from '@/lib/config';
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const weeks = Number(searchParams.get('weeks') || '4');

  try {
    const users = await getUsers();
    const userMap: Record<number, any> = {};
    for (const u of users) userMap[u.id] = u;

    const weeklyData = [];

    for (let w = weeks - 1; w >= 0; w--) {
      const weekStart = startOfWeek(subWeeks(new Date(), w), { weekStartsOn: 0 });
      const weekEnd = endOfWeek(subWeeks(new Date(), w), { weekStartsOn: 0 });
      const from = format(weekStart, 'yyyy-MM-dd');
      const to = format(weekEnd, 'yyyy-MM-dd');

      const [leaderboards, sales] = await Promise.all([
        getLeaderboards(from, to),
        getSales(from, to),
      ]);

      // Aggregate by office
      const officeData: Record<string, { doors: number; appts: number; sits: number; closes: number; deals: number; kw: number }> = {};

      const setterLB = leaderboards.find((lb: any) => lb.leaderboard_name === 'Setter Leaderboard') as any;
      if (setterLB?.stats?.headers) {
        const dkHeader = setterLB.stats.headers.find((h: any) => h.short_name === 'DK');
        const apptHeader = setterLB.stats.headers.find((h: any) => h.short_name === 'APPT');
        for (const s of setterLB.stats.stats) {
          if (s.item_type !== 'user') continue;
          const office = teamIdToQBOffice(s.office_team_id);
          if (!office) continue;
          if (!officeData[office]) officeData[office] = { doors: 0, appts: 0, sits: 0, closes: 0, deals: 0, kw: 0 };
          officeData[office].doors += dkHeader ? (s[dkHeader.mapped_field] || 0) : 0;
          officeData[office].appts += apptHeader ? (s[apptHeader.mapped_field] || 0) : 0;
        }
      }

      const closerLB = leaderboards.find((lb: any) => lb.leaderboard_name === 'Closer Leaderboard') as any;
      if (closerLB?.stats?.headers) {
        const satHeader = closerLB.stats.headers.find((h: any) => h.short_name === 'SAT');
        const closHeader = closerLB.stats.headers.find((h: any) => h.short_name === 'CLOS');
        for (const s of closerLB.stats.stats) {
          if (s.item_type !== 'user') continue;
          const office = teamIdToQBOffice(s.office_team_id);
          if (!office) continue;
          if (!officeData[office]) officeData[office] = { doors: 0, appts: 0, sits: 0, closes: 0, deals: 0, kw: 0 };
          officeData[office].sits += satHeader ? (s[satHeader.mapped_field] || 0) : 0;
          officeData[office].closes += closHeader ? (s[closHeader.mapped_field] || 0) : 0;
        }
      }

      for (const sale of sales) {
        const office = sale.salesOffice || 'Unknown';
        if (!officeData[office]) officeData[office] = { doors: 0, appts: 0, sits: 0, closes: 0, deals: 0, kw: 0 };
        officeData[office].deals++;
        officeData[office].kw += sale.systemSizeKw;
      }

      weeklyData.push({
        week: format(weekStart, 'MMM d'),
        weekStart: from,
        weekEnd: to,
        totalDeals: sales.length,
        totalKw: sales.reduce((s, sale) => s + sale.systemSizeKw, 0),
        offices: officeData,
      });
    }

    return NextResponse.json({ weeks: weeklyData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
