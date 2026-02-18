import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboards, getUsers, getAppointments } from '@/lib/repcard';
import { getSales } from '@/lib/quickbase';
import { OFFICE_MAPPING, teamIdToQBOffice } from '@/lib/config';

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const officeName = decodeURIComponent(params.name);
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get('from') || getMonday();
  const toDate = searchParams.get('to') || getToday();

  try {
    const [leaderboards, users, sales, appointments] = await Promise.all([
      getLeaderboards(fromDate, toDate),
      getUsers(),
      getSales(fromDate, toDate),
      getAppointments(fromDate, toDate),
    ]);

    const userMap: Record<number, any> = {};
    for (const u of users) userMap[u.id] = u;

    // Find team IDs that map to this office
    const teamIds = Object.entries(OFFICE_MAPPING)
      .filter(([, m]) => m.qbName === officeName && m.active)
      .map(([id]) => Number(id));

    // Get region from mapping
    const region = Object.values(OFFICE_MAPPING).find(m => m.qbName === officeName)?.region || 'Unknown';

    // Process leaderboards
    const setterLB = leaderboards.find((lb: any) => lb.leaderboard_name === 'Setter Leaderboard');
    const closerLB = leaderboards.find((lb: any) => lb.leaderboard_name === 'Closer Leaderboard');

    const processLB = (lb: any) => {
      if (!lb?.stats?.headers) return [];
      return lb.stats.stats
        .filter((s: any) => s.item_type === 'user' && teamIds.includes(s.office_team_id))
        .map((s: any) => {
          const user = userMap[s.item_id];
          const values: Record<string, any> = {};
          for (const h of lb.stats.headers) values[h.short_name] = s[h.mapped_field] ?? 0;
          return {
            userId: s.item_id,
            name: user ? `${user.firstName} ${user.lastName}` : `User #${s.item_id}`,
            ...values,
          };
        });
    };

    const setters = processLB(setterLB);
    const closers = processLB(closerLB);

    // Sales for this office
    const officeSales = sales.filter(s => s.salesOffice === officeName);

    // Appointments for users in this office
    const officeUserIds = new Set([...setters.map((s: any) => s.userId), ...closers.map((c: any) => c.userId)]);
    const officeAppts = appointments.filter(a => officeUserIds.has(a.setter_id) || officeUserIds.has(a.closer_id));

    // Funnel data
    const totalDoors = setters.reduce((s: number, r: any) => s + (r.DK || 0), 0);
    const totalAppts = setters.reduce((s: number, r: any) => s + (r.APPT || 0), 0);
    const totalSits = closers.reduce((s: number, r: any) => s + (r.SAT || 0), 0);
    const totalCloses = closers.reduce((s: number, r: any) => s + (r.CLOS || 0), 0);

    return NextResponse.json({
      office: officeName,
      region,
      period: { from: fromDate, to: toDate },
      setters,
      closers,
      sales: officeSales,
      appointments: officeAppts,
      funnel: { doors: totalDoors, appointments: totalAppts, sits: totalSits, closes: totalCloses },
      summary: {
        deals: officeSales.length,
        kw: officeSales.reduce((s, sale) => s + sale.systemSizeKw, 0),
        avgPpw: officeSales.length > 0 ? officeSales.reduce((s, sale) => s + sale.netPpw, 0) / officeSales.length : 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}
function getToday(): string { return new Date().toISOString().split('T')[0]; }
