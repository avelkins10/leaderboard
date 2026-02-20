import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { queryQBDeals, matchDeals } from "@/lib/deal-matching";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "backfill2026";

/**
 * Match QB deals to RepCard appointments on a rolling 7-day window.
 * Runs every 6 hours via Vercel cron.
 *
 * GET /api/cron/match-deals?key=<secret>
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  if (key !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const from = new Date(now.getTime() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const to = now.toISOString().slice(0, 10);

  try {
    // Query QB deals for the 7-day window
    const deals = await queryQBDeals(from, to);

    // Query Supabase appointments (wider window: 30 days before to 30 days after)
    const apptFrom = new Date(
      new Date(from).getTime() - 30 * 86400000,
    ).toISOString();
    const apptTo = new Date(
      new Date(to).getTime() + 30 * 86400000,
    ).toISOString();
    const { data: appointments, error } = await supabaseAdmin
      .from("appointments")
      .select("*")
      .gte("appointment_time", apptFrom)
      .lte("appointment_time", apptTo);
    if (error) throw error;

    const matches = matchDeals(deals, appointments || []);

    // Only store matches with confidence >= 0.5
    const matched = matches.filter(
      (m) => m.match_method !== "none" && m.match_confidence >= 0.5,
    );

    let stored = 0;
    let appointmentsUpdated = 0;
    for (const m of matched) {
      const { error: upsertErr } = await supabaseAdmin
        .from("deal_matches")
        .upsert(m, { onConflict: "qb_record_id" });
      if (!upsertErr) {
        stored++;
        // Update appointment's qb_record_id
        if (m.appointment_id) {
          const { error: updateErr } = await supabaseAdmin
            .from("appointments")
            .update({ qb_record_id: m.qb_record_id })
            .eq("id", m.appointment_id);
          if (!updateErr) appointmentsUpdated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      window: { from, to },
      total_deals: deals.length,
      total_matched: matched.length,
      stored,
      appointments_updated: appointmentsUpdated,
      unmatched: matches.filter((m) => m.match_method === "none").length,
      low_confidence_skipped: matches.filter(
        (m) =>
          m.match_method !== "none" && m.match_confidence < 0.5,
      ).length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
