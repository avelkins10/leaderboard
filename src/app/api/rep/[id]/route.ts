import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboards, getUsers, getAppointments } from '@/lib/repcard';
import { getSales } from '@/lib/quickbase';
import { OFFICE_MAPPING, teamIdToQBOffice } from '@/lib/config';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = Number(params.id);
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

    const user = users.find(u => u.id === userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const qbOffice = teamIdToQBOffice(user.officeTeamId) || 'Unknown';
    const region = OFFICE_MAPPING[user.officeTeamId]?.region || user.office;

    // Find user in leaderboards
    const findInLB = (lbName: string) => {
      const lb = leaderboards.find((l: any) => l.leaderboard_name === lbName);
      if (!lb || Array.isArray(lb.stats) || !lb.stats?.headers) return null;
      const stat = (lb.stats as any).stats.find((s: any) => s.item_id === userId && s.item_type === 'user');
      if (!stat) return null;
      const values: Record<string, any> = {};
      for (const h of (lb.stats as any).headers) values[h.short_name] = stat[h.mapped_field] ?? 0;
      return values;
    };

    const setterStats = findInLB('Setter Leaderboard');
    const closerStats = findInLB('Closer Leaderboard');
    const setterApptStats = findInLB('Setter Appointment Data');
    const closerApptStats = findInLB('Closer Appointment Data');
    const role = setterStats ? 'setter' : closerStats ? 'closer' : 'unknown';

    // User's appointments
    const userAppts = appointments.filter(a => a.setter_id === userId || a.closer_id === userId);

    // Disposition breakdown for closers
    const dispositions: Record<string, number> = {};
    if (closerApptStats) {
      for (const [key, val] of Object.entries(closerApptStats)) {
        if (typeof val === 'number' && val > 0) dispositions[key] = val;
      }
    }

    // QB sales for this rep
    const fullName = `${user.firstName} ${user.lastName}`;
    const repSales = sales.filter(s =>
      s.closerName?.toLowerCase().includes(fullName.toLowerCase()) ||
      s.setterName?.toLowerCase().includes(fullName.toLowerCase())
    );

    return NextResponse.json({
      user: {
        id: user.id,
        name: fullName,
        email: user.email,
        office: qbOffice,
        team: user.team,
        region,
        role,
        jobTitle: user.jobTitle,
        status: user.status,
      },
      stats: role === 'setter' ? setterStats : closerStats,
      appointmentStats: role === 'setter' ? setterApptStats : closerApptStats,
      dispositions,
      appointments: userAppts,
      sales: repSales,
      period: { from: fromDate, to: toDate },
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
