import { NextRequest, NextResponse } from "next/server";
import { getLeaderboards, getUsers, getAppointments } from "@/lib/repcard";
import { getSales } from "@/lib/quickbase";
import { teamIdToQBOffice } from "@/lib/config";
import { format, startOfWeek, endOfWeek } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    // Dynamically import supabase to avoid issues if env vars aren't set
    let supabaseAdmin: any;
    try {
      const mod = await import("@/lib/supabase");
      supabaseAdmin = mod.supabaseAdmin;
    } catch {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const weekStart =
      body.weekStart ||
      format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd");
    const weekEnd =
      body.weekEnd ||
      format(endOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd");

    const [leaderboards, users, sales, appointments] = await Promise.all([
      getLeaderboards(weekStart, weekEnd),
      getUsers(),
      getSales(weekStart, weekEnd),
      getAppointments(weekStart, weekEnd),
    ]);

    const snapshot = {
      week_start: weekStart,
      week_end: weekEnd,
      created_at: new Date().toISOString(),
      total_deals: sales.length,
      total_kw: sales.reduce((s, sale) => s + sale.systemSizeKw, 0),
      data: {
        leaderboards: leaderboards?.length,
        users: users?.length,
        sales: sales?.length,
        appointments: appointments?.length,
      },
    };

    const { error } = await supabaseAdmin
      .from("weekly_snapshots")
      .upsert(snapshot, { onConflict: "week_start" });

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, snapshot });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
