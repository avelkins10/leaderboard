import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 100);

  try {
    // Fetch recent events from 3 tables in parallel
    const [knocks, appointments, typeChanges] = await Promise.all([
      supabaseAdmin
        .from("door_knocks")
        .select("rep_name, office_team, knocked_at, address")
        .order("knocked_at", { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from("appointments")
        .select(
          "setter_name, closer_name, contact_name, office_team, appointment_time, disposition, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from("contact_type_changes")
        .select(
          "contact_name, old_type, new_type, closer_name, office_team, changed_at",
        )
        .order("changed_at", { ascending: false })
        .limit(limit),
    ]);

    if (knocks.error) throw knocks.error;
    if (appointments.error) throw appointments.error;
    if (typeChanges.error) throw typeChanges.error;

    // Unify into a single feed
    const feed: {
      type: string;
      time: string;
      text: string;
      office: string;
    }[] = [];

    for (const k of knocks.data || []) {
      feed.push({
        type: "knock",
        time: k.knocked_at,
        text: `${k.rep_name || "Unknown"} knocked ${k.address || "a door"}`,
        office: k.office_team || "",
      });
    }

    for (const a of appointments.data || []) {
      if (a.disposition) {
        feed.push({
          type: "disposition",
          time: a.created_at || a.appointment_time,
          text: `${a.closer_name || "Closer"} — ${a.disposition} (${a.contact_name || "contact"})`,
          office: a.office_team || "",
        });
      } else {
        feed.push({
          type: "appointment",
          time: a.created_at || a.appointment_time,
          text: `${a.setter_name || "Setter"} set appt for ${a.contact_name || "contact"} with ${a.closer_name || "closer"}`,
          office: a.office_team || "",
        });
      }
    }

    for (const tc of typeChanges.data || []) {
      if (
        tc.new_type?.toLowerCase() === "customer" &&
        tc.old_type?.toLowerCase() === "lead"
      ) {
        feed.push({
          type: "conversion",
          time: tc.changed_at,
          text: `${tc.contact_name || "Contact"} converted Lead → Customer (${tc.closer_name || "unknown closer"})`,
          office: tc.office_team || "",
        });
      }
    }

    // Sort by time descending, take top N
    feed.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    );

    return NextResponse.json({ feed: feed.slice(0, limit) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
