import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getActiveOffices, teamIdToQBOffice } from "@/lib/config";
import { getUsers, fetchRepCardAppointmentsCT } from "@/lib/repcard";
import { getSetterActivity, getCloserActivity } from "@/lib/supabase-queries";

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

    // Prefetch RepCard appointments once, derive both setter + closer activity
    const [prefetchedAppts, users] = await Promise.all([
      fetchRepCardAppointmentsCT(weekStart, weekEnd),
      getUsers(),
    ]);
    const [setterActivityMap, closerActivityMap] = await Promise.all([
      getSetterActivity(weekStart, weekEnd, undefined, prefetchedAppts),
      getCloserActivity(weekStart, weekEnd, undefined, prefetchedAppts),
    ]);

    // Build user→office mapping
    const userOfficeMap: Record<number, string> = {};
    for (const u of users) {
      const office = teamIdToQBOffice(u.officeTeamId);
      if (office) userOfficeMap[u.id] = office;
    }

    // Aggregate activity by office
    const officeSetterData: Record<string, any[]> = {};
    const officeCloserData: Record<string, any[]> = {};
    const activeByOffice: Record<string, Set<number>> = {};

    for (const idStr of Object.keys(setterActivityMap)) {
      const id = Number(idStr);
      const act = setterActivityMap[id];
      const office = userOfficeMap[id];
      if (!office) continue;
      if (!officeSetterData[office]) officeSetterData[office] = [];
      officeSetterData[office].push(act);
      if (act.DK > 0) {
        if (!activeByOffice[office]) activeByOffice[office] = new Set();
        activeByOffice[office].add(id);
      }
    }

    for (const idStr of Object.keys(closerActivityMap)) {
      const id = Number(idStr);
      const act = closerActivityMap[id];
      const office = userOfficeMap[id];
      if (!office) continue;
      if (!officeCloserData[office]) officeCloserData[office] = [];
      officeCloserData[office].push(act);
      if (act.SAT >= 1) {
        if (!activeByOffice[office]) activeByOffice[office] = new Set();
        activeByOffice[office].add(id);
      }
    }

    const offices = getActiveOffices();
    const snapshots = offices.map((office) => {
      const officeSetters = officeSetterData[office] || [];
      const officeClosers = officeCloserData[office] || [];

      return {
        week_start: weekStart,
        office,
        data: {
          setters: officeSetters.map((s) => ({
            setter_id: s.userId,
            office_team: office,
            total_appts: s.APPT || 0,
            no_show: s.outcomes?.NOSH || 0,
            canceled: s.outcomes?.CANC || 0,
            reschedule: s.outcomes?.RSCH || 0,
          })),
          closers: officeClosers.map((c) => ({
            closer_id: c.userId,
            office_team: office,
            total_appts: c.LEAD || c.SAT || 0,
            closed: c.CLOS || 0,
            no_show: c.outcomes?.NOSH || 0,
            canceled: c.outcomes?.CANC || 0,
          })),
          active_reps: activeByOffice[office]?.size || 0,
          total_appts: officeSetters.reduce(
            (sum: number, s) => sum + (s.APPT || 0),
            0,
          ),
          quality_count: 0,
          closed: officeClosers.reduce(
            (sum: number, c) => sum + (c.CLOS || 0),
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
