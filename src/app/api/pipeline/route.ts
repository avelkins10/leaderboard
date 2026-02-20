import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    let query = supabaseAdmin
      .from("lead_status_changes")
      .select("new_status, office_team");

    if (from) query = query.gte("changed_at", `${from}T00:00:00Z`);
    if (to) query = query.lte("changed_at", `${to}T23:59:59Z`);

    const { data, error } = await query;
    if (error) throw error;

    // Aggregate by new_status
    const statusCounts: Record<string, number> = {};
    const byOffice: Record<string, Record<string, number>> = {};

    for (const row of data || []) {
      const status = row.new_status || "Unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      const office = row.office_team || "Unknown";
      if (!byOffice[office]) byOffice[office] = {};
      byOffice[office][status] = (byOffice[office][status] || 0) + 1;
    }

    // Sort statuses by count descending
    const statuses = Object.entries(statusCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([status, count]) => ({ status, count }));

    return NextResponse.json({
      total: (data || []).length,
      statuses,
      byOffice,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
