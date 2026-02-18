import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const REPCARD_API_KEY = process.env.REPCARD_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET || "backfill2026";

/** Paginate through a RepCard API endpoint */
async function fetchAllPages(baseUrl: string): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 200; page++) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const res = await fetch(`${baseUrl}${sep}page=${page}&per_page=100`, {
      headers: { "x-api-key": REPCARD_API_KEY },
    });
    if (!res.ok) break;
    const d = await res.json();
    const items = d.result?.data || d.data || [];
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

/**
 * Cron-triggered quality data sync.
 * 1. Fetches recent appointments from RepCard → upserts to Supabase (fills webhook gaps)
 * 2. Fetches attachment endpoints → updates has_power_bill + star_rating
 *
 * Call: GET /api/cron/sync-quality?key=<CRON_SECRET>
 * Or via Vercel Cron with Authorization header.
 */
export async function GET(req: NextRequest) {
  // Auth
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  if (key !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const year = now.getFullYear();
  // Sync last 14 days of appointments (catches any gaps)
  const fromDate = new Date(now.getTime() - 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const toDate = now.toISOString().slice(0, 10);

  const stats = {
    appointmentsSynced: 0,
    attachmentsFound: { appointment: 0, customer: 0 },
    powerBillsUpdated: 0,
    starsUpdated: 0,
  };

  try {
    // ── Step 1: Sync recent appointments from RepCard → Supabase ──
    const recentAppts = await fetchAllPages(
      `https://app.repcard.com/api/appointments?from_date=${fromDate}&to_date=${toDate}`
    );

    if (recentAppts.length > 0) {
      // Batch upsert — only set fields that don't overwrite webhook-enriched data
      const mapped = recentAppts.map((a: any) => {
        const setter = a.setter || {};
        const closer = a.closer || {};
        const contact = a.contact || {};
        const leadCreated = contact.createdAt || a.createdAt;
        const startAt = a.startAt;

        let hoursToAppointment: number | null = null;
        if (startAt && leadCreated) {
          const diff =
            (new Date(startAt).getTime() - new Date(leadCreated).getTime()) /
            3600000;
          hoursToAppointment =
            diff < 0 || diff > 8760
              ? null
              : Math.round(diff * 100) / 100;
        }

        const address =
          contact.fullAddress ||
          [contact.address, contact.city, contact.state, contact.zip]
            .filter(Boolean)
            .join(" ") ||
          null;

        return {
          id: a.id,
          setter_id: setter.id ?? null,
          setter_name: setter.name || setter.fullName || null,
          closer_id: closer.id ?? null,
          closer_name: closer.name || closer.fullName || null,
          contact_id: contact.id ?? null,
          contact_name: contact.name || contact.fullName || null,
          contact_phone: contact.phoneNumber ?? null,
          contact_address: a.appointmentLocation || address,
          contact_city: contact.city ?? null,
          contact_state: contact.state ?? null,
          latitude: contact.latitude ? parseFloat(contact.latitude) : null,
          longitude: contact.longitude ? parseFloat(contact.longitude) : null,
          office_team: setter.team ?? null,
          office_region: setter.location ?? null,
          appointment_time: startAt ?? null,
          lead_created_at: leadCreated ?? null,
          hours_to_appointment: hoursToAppointment,
          disposition: a.status?.title ?? null,
          disposition_category: a.status?.category?.title ?? null,
          setter_notes: a.notes ?? null,
        };
      });

      // Upsert in chunks of 200
      for (let i = 0; i < mapped.length; i += 200) {
        const chunk = mapped.slice(i, i + 200);
        const { error } = await supabaseAdmin
          .from("appointments")
          .upsert(chunk, {
            onConflict: "id",
            ignoreDuplicates: false,
          });
        if (!error) stats.appointmentsSynced += chunk.length;
      }
    }

    // ── Step 2: Fetch power bill data from attachment endpoints ──
    const [apptAttachments, custAttachments] = await Promise.all([
      fetchAllPages(
        `https://app.repcard.com/api/appointments/attachments?from_date=${fromDate}&to_date=${toDate}`
      ),
      fetchAllPages(
        `https://app.repcard.com/api/customers/attachments?from_date=${fromDate}&to_date=${toDate}`
      ),
    ]);

    stats.attachmentsFound.appointment = apptAttachments.length;
    stats.attachmentsFound.customer = custAttachments.length;

    // Build lookup sets
    const apptIdsWithPB = new Set<number>();
    for (const a of apptAttachments) {
      if (a.appointmentId) apptIdsWithPB.add(a.appointmentId);
    }
    const customerIdsWithPB = new Set<number>();
    for (const a of custAttachments) {
      if (a.customerId) customerIdsWithPB.add(a.customerId);
    }

    // ── Step 3: Update power bills + star ratings on Supabase records ──
    const { data: allAppts } = await supabaseAdmin
      .from("appointments")
      .select("id, contact_id, has_power_bill, hours_to_appointment, star_rating")
      .gte("appointment_time", fromDate)
      .lte("appointment_time", toDate + "T23:59:59");

    for (const appt of allAppts || []) {
      const hasPB =
        apptIdsWithPB.has(appt.id) ||
        customerIdsWithPB.has(appt.contact_id);
      const hrs = appt.hours_to_appointment;
      const within2days = hrs != null && hrs > 0 && hrs <= 48;
      const correctStar = hasPB && within2days ? 3 : hasPB ? 2 : 1;

      // Update if power bill status changed OR star rating is wrong/missing
      if (
        (hasPB && !appt.has_power_bill) ||
        appt.star_rating !== correctStar
      ) {
        await supabaseAdmin
          .from("appointments")
          .update({
            has_power_bill: hasPB,
            is_quality: hasPB && within2days,
            star_rating: correctStar,
          })
          .eq("id", appt.id);

        if (hasPB && !appt.has_power_bill) stats.powerBillsUpdated++;
        if (appt.star_rating !== correctStar) stats.starsUpdated++;
      }
    }

    return NextResponse.json({ success: true, ...stats });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
