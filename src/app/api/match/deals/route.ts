import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { queryQBDeals, matchDeals } from "@/lib/deal-matching";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const urlKey = req.nextUrl.searchParams.get("key");
  if (authHeader !== `Bearer ${CRON_SECRET}` && urlKey !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { from, to } = await req.json();
  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to required" },
      { status: 400 },
    );
  }

  try {
    // Query QB deals
    const deals = await queryQBDeals(from, to);

    // Query RC appointments (wider window: 30 days before to 30 days after)
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

    // Store matches (only those with actual matches)
    const matched = matches.filter((m) => m.match_method !== "none");
    let stored = 0;
    for (const m of matched) {
      const { error: upsertErr } = await supabaseAdmin
        .from("deal_matches")
        .upsert(m, { onConflict: "qb_record_id" });
      if (!upsertErr) {
        stored++;
        // Update appointment's qb_record_id
        if (m.appointment_id) {
          await supabaseAdmin
            .from("appointments")
            .update({ qb_record_id: m.qb_record_id })
            .eq("id", m.appointment_id);
        }
      }
    }

    return NextResponse.json({
      total_deals: deals.length,
      total_matched: matched.length,
      stored,
      unmatched: matches.filter((m) => m.match_method === "none").length,
      matches: matches.slice(0, 50), // Return first 50 for preview
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  let query = supabaseAdmin
    .from("deal_matches")
    .select("*")
    .order("qb_sale_date", { ascending: false });
  if (from) query = query.gte("qb_sale_date", from);
  if (to) query = query.lte("qb_sale_date", to);

  const { data, error } = await query.limit(500);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ matches: data, count: data?.length ?? 0 });
}
