import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getActiveOffices, teamIdToQBOffice } from "@/lib/config";
import { getTypedLeaderboards } from "@/lib/repcard";

export async function GET(req: NextRequest) {
  // Verify cron secret in production
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const weekStart = getMonday();
    const weekEnd = getSunday(weekStart);

    const [setterBoards, closerBoards] = await Promise.all([
      getTypedLeaderboards("setter", weekStart, weekEnd),
      getTypedLeaderboards("closer", weekStart, weekEnd),
    ]);

    // Process leaderboard into per-office stats
    const processLB = (boards: any[], lbName: string) => {
      const lb = boards.find((b: any) => b.leaderboard_name === lbName);
      if (!lb?.stats?.headers) return [];
      return (lb.stats.stats || [])
        .filter((s: any) => s.item_type === "user")
        .map((s: any) => {
          const values: Record<string, any> = {};
          for (const h of lb.stats.headers)
            values[h.short_name] = s[h.mapped_field] ?? 0;
          return {
            userId: s.item_id,
            office_team_id: s.office_team_id,
            qbOffice: teamIdToQBOffice(s.office_team_id),
            ...values,
          };
        })
        .filter((s: any) => s.qbOffice);
    };

    const setterStats = processLB(setterBoards, "Setter Leaderboard");
    const setterApptStats = processLB(
      setterBoards,
      "Setter Appointment Data",
    );
    const closerStats = processLB(closerBoards, "Closer Leaderboard");
    const closerApptStats = processLB(
      closerBoards,
      "Closer Appointment Data",
    );

    // Build per-office setter appt map for quick lookup
    const setterApptByOffice: Record<string, any[]> = {};
    for (const sa of setterApptStats) {
      if (!setterApptByOffice[sa.qbOffice])
        setterApptByOffice[sa.qbOffice] = [];
      setterApptByOffice[sa.qbOffice].push(sa);
    }

    const closerApptByOffice: Record<string, any[]> = {};
    for (const ca of closerApptStats) {
      if (!closerApptByOffice[ca.qbOffice])
        closerApptByOffice[ca.qbOffice] = [];
      closerApptByOffice[ca.qbOffice].push(ca);
    }

    const offices = getActiveOffices();
    const snapshots = offices.map((office) => {
      const officeSetters = setterStats.filter(
        (s: any) => s.qbOffice === office,
      );
      const officeClosers = closerStats.filter(
        (s: any) => s.qbOffice === office,
      );
      const officeSetterAppts = setterApptByOffice[office] || [];
      const officeCloserAppts = closerApptByOffice[office] || [];

      // Active reps: setters with DK > 0, closers with SAT >= 1, deduplicated
      const activeIds = new Set<number>();
      for (const s of officeSetters) {
        if ((s.DK || 0) > 0) activeIds.add(s.userId);
      }
      for (const c of officeClosers) {
        if ((c.SAT || 0) >= 1) activeIds.add(c.userId);
      }

      return {
        week_start: weekStart,
        office,
        data: {
          setters: officeSetterAppts.map((s: any) => ({
            setter_id: s.userId,
            office_team: office,
            total_appts: s.APPT || 0,
            no_show: s.NOSH || 0,
            canceled: s.CANC || 0,
            reschedule: s.RSCH || 0,
          })),
          closers: officeCloserAppts.map((c: any) => ({
            closer_id: c.userId,
            office_team: office,
            total_appts: c.LEAD || c.SAT || 0,
            closed: c.CLOS || 0,
            no_show: c.NOSH || 0,
            canceled: c.CANC || 0,
          })),
          active_reps: activeIds.size,
          total_appts: officeSetterAppts.reduce(
            (sum: number, s: any) => sum + (s.APPT || 0),
            0,
          ),
          quality_count: 0, // quality data lives in Supabase (webhooks), not in leaderboard
          closed: officeCloserAppts.reduce(
            (sum: number, c: any) => sum + (c.CLOS || 0),
            0,
          ),
        },
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabaseAdmin
      .from("weekly_snapshots")
      .upsert(snapshots, { onConflict: "week_start,office" });

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
  const now = new Date();
  const ct = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const day = ct.getDay();
  const diff = ct.getDate() - day + (day === 0 ? -6 : 1);
  ct.setDate(diff);
  const y = ct.getFullYear();
  const m = String(ct.getMonth() + 1).padStart(2, "0");
  const d = String(ct.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getSunday(monday: string): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}
