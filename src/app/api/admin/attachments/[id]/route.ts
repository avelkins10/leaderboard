import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const CRON_SECRET = process.env.CRON_SECRET || "backfill2026";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  if (key !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Update attachment type
  const { data: attachment, error: attErr } = await supabaseAdmin
    .from("attachments")
    .update({ attachment_type: "power_bill_verified" })
    .eq("id", id)
    .select("url, appointment_id, contact_id")
    .single();

  if (attErr) {
    return NextResponse.json({ error: attErr.message }, { status: 500 });
  }

  // Find linked appointment(s) and update has_power_bill + recompute stars
  const apptIds: number[] = [];
  if (attachment.appointment_id) {
    apptIds.push(attachment.appointment_id);
  }
  if (attachment.contact_id) {
    // Find appointments linked to this contact
    const { data: contactAppts } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("contact_id", attachment.contact_id);
    if (contactAppts) {
      for (const a of contactAppts) {
        if (!apptIds.includes(a.id)) apptIds.push(a.id);
      }
    }
  }

  let appointmentsUpdated = 0;
  if (apptIds.length > 0) {
    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("id, has_power_bill, hours_to_appointment, power_bill_urls")
      .in("id", apptIds);

    for (const appt of appts || []) {
      const hrs = appt.hours_to_appointment;
      const within2days = hrs != null && hrs > 0 && hrs <= 48;

      // Append the approved URL to power_bill_urls
      const existingUrls: string[] = appt.power_bill_urls || [];
      const updatedUrls = existingUrls.includes(attachment.url)
        ? existingUrls
        : [...existingUrls, attachment.url];

      if (!appt.has_power_bill) {
        await supabaseAdmin
          .from("appointments")
          .update({
            has_power_bill: true,
            is_quality: within2days,
            star_rating: within2days ? 3 : 2,
            power_bill_urls: updatedUrls,
          })
          .eq("id", appt.id);
        appointmentsUpdated++;
      } else if (updatedUrls.length !== existingUrls.length) {
        // Already has power bill, but add the new URL so it's viewable
        await supabaseAdmin
          .from("appointments")
          .update({ power_bill_urls: updatedUrls })
          .eq("id", appt.id);
      }
    }
  }

  return NextResponse.json({ success: true, appointmentsUpdated });
}
