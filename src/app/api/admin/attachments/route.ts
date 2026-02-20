import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const CRON_SECRET = process.env.CRON_SECRET || "backfill2026";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  if (key !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filter = searchParams.get("filter") || "not_power_bill";

  let query = supabaseAdmin
    .from("attachments")
    .select("id, url, appointment_id, contact_id, source, attachment_type, uploaded_at")
    .order("uploaded_at", { ascending: false })
    .limit(200);

  if (filter !== "all") {
    query = query.eq("attachment_type", filter);
  }

  const { data: attachments, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch related appointment context for items that have appointment_id
  const apptIds = (attachments || [])
    .map((a) => a.appointment_id)
    .filter(Boolean);

  let apptMap = new Map<number, any>();
  if (apptIds.length > 0) {
    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("id, setter_name, contact_name, appointment_time")
      .in("id", apptIds);
    if (appts) {
      apptMap = new Map(appts.map((a) => [a.id, a]));
    }
  }

  // Also look up appointments by contact_id for customer attachments
  const contactIds = (attachments || [])
    .filter((a) => !a.appointment_id && a.contact_id)
    .map((a) => a.contact_id);

  let contactApptMap = new Map<number, any>();
  if (contactIds.length > 0) {
    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("id, contact_id, setter_name, contact_name, appointment_time")
      .in("contact_id", contactIds);
    if (appts) {
      contactApptMap = new Map(appts.map((a) => [a.contact_id, a]));
    }
  }

  const enriched = (attachments || []).map((att) => {
    const appt = att.appointment_id
      ? apptMap.get(att.appointment_id)
      : contactApptMap.get(att.contact_id);
    return {
      ...att,
      setter_name: appt?.setter_name || null,
      contact_name: appt?.contact_name || null,
      appointment_time: appt?.appointment_time || null,
    };
  });

  return NextResponse.json({ attachments: enriched });
}
