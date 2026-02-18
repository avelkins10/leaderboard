import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getActiveOffices } from '@/lib/config';
import { getSetterAppointmentStats, getCloserAppointmentStats, getActiveRepsToday } from '@/lib/supabase-queries';

export async function GET(req: NextRequest) {
  // Verify cron secret in production
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const weekStart = getMonday();
    const weekEnd = getSunday(weekStart);

    const [setterStats, closerStats, activeReps] = await Promise.all([
      getSetterAppointmentStats(weekStart, weekEnd),
      getCloserAppointmentStats(weekStart, weekEnd),
      getActiveRepsToday(),
    ]);

    const offices = getActiveOffices();
    const snapshots = offices.map(office => {
      const officeSetters = setterStats.filter(s => s.office_team === office);
      const officeClosers = closerStats.filter(s => s.office_team === office);

      return {
        week_start: weekStart,
        office,
        data: {
          setters: officeSetters,
          closers: officeClosers,
          active_reps: activeReps[office] || 0,
          total_appts: officeSetters.reduce((sum, s) => sum + s.total_appts, 0),
          quality_count: officeSetters.reduce((sum, s) => sum + s.quality_count, 0),
          closed: officeSetters.reduce((sum, s) => sum + s.closed, 0),
        },
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabaseAdmin
      .from('weekly_snapshots')
      .upsert(snapshots, { onConflict: 'week_start,office' });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      week_start: weekStart,
      offices_snapshotted: snapshots.length,
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

function getSunday(monday: string): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}
