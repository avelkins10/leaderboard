import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

const REPCARD_API_KEY = process.env.REPCARD_API_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET || "backfill2026";

const VISION_PROMPT = `Solar company reps upload photos when setting appointments. Is this image related to the homeowner's electricity or power usage? This includes: power bills, electric bills, utility bills, utility meters, energy usage charts/graphs, screenshots from utility apps, or any document showing kWh consumption. Reply with ONLY "YES" or "NO".`;

/** Paginate RepCard API */
async function fetchPages(baseUrl: string, maxPages = 10): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
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

/** Vision AI: classify an image as power bill or not */
async function classifyImage(imageUrl: string): Promise<boolean | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: VISION_PROMPT },
              { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            ],
          },
        ],
        max_tokens: 5,
      }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const answer = d.choices?.[0]?.message?.content?.trim().toUpperCase();
    return answer === "YES";
  } catch {
    return null;
  }
}

/**
 * Verify attachments with vision AI.
 *
 * Flow:
 * 1. Fetch appointment + customer attachments from RepCard
 * 2. Check which are already in our attachments table (by URL)
 * 3. For new ones: run vision AI classification
 * 4. Insert into attachments table with type "power_bill_verified" or "not_power_bill"
 * 5. Update appointments.has_power_bill based on verified attachments
 *
 * GET /api/cron/verify-attachments?key=<secret>
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  if (key !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const fromDate = new Date(now.getTime() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const toDate = now.toISOString().slice(0, 10);

  const stats = {
    fetched: { appointment: 0, customer: 0 },
    alreadyVerified: 0,
    newlyVerified: 0,
    isPowerBill: 0,
    notPowerBill: 0,
    errors: 0,
    appointmentsUpdated: 0,
  };

  try {
    // ── Step 1: Fetch attachments from RepCard ──
    const [apptAttachments, custAttachments] = await Promise.all([
      fetchPages(
        `https://app.repcard.com/api/appointments/attachments?from_date=${fromDate}&to_date=${toDate}`,
        5
      ),
      fetchPages(
        `https://app.repcard.com/api/customers/attachments?from_date=${fromDate}&to_date=${toDate}`,
        5
      ),
    ]);
    stats.fetched.appointment = apptAttachments.length;
    stats.fetched.customer = custAttachments.length;

    // ── Step 2: Get already-verified URLs from our attachments table ──
    const { data: existingAttachments } = await supabaseAdmin
      .from("attachments")
      .select("url");
    const verifiedUrls = new Set(
      (existingAttachments || []).map((a: any) => a.url)
    );

    // ── Step 3: Build list of new attachments to verify ──
    // We need to map appointment attachments to their contact_id
    // Fetch appointments for the period to get the contact mapping
    const apptIdSet = new Set(
      apptAttachments.map((a: any) => a.appointmentId).filter(Boolean)
    );
    const apptIds = Array.from(apptIdSet);

    // Get appointment → contact mapping from Supabase
    const apptToContact: Record<number, number> = {};
    if (apptIds.length > 0) {
      const { data: apptRows } = await supabaseAdmin
        .from("appointments")
        .select("id, contact_id")
        .in("id", apptIds);
      for (const row of apptRows || []) {
        if (row.contact_id) apptToContact[row.id] = row.contact_id;
      }
    }

    // Normalize all attachments into a common format
    type PendingAttachment = {
      url: string;
      appointmentId: number | null;
      contactId: number | null;
      source: "appointment" | "customer";
    };

    const pending: PendingAttachment[] = [];

    for (const a of apptAttachments) {
      if (!a.attachmentUrl || verifiedUrls.has(a.attachmentUrl)) {
        if (verifiedUrls.has(a.attachmentUrl)) stats.alreadyVerified++;
        continue;
      }
      pending.push({
        url: a.attachmentUrl,
        appointmentId: a.appointmentId || null,
        contactId: apptToContact[a.appointmentId] || null,
        source: "appointment",
      });
    }

    for (const a of custAttachments) {
      if (!a.attachmentUrl || verifiedUrls.has(a.attachmentUrl)) {
        if (verifiedUrls.has(a.attachmentUrl)) stats.alreadyVerified++;
        continue;
      }
      pending.push({
        url: a.attachmentUrl,
        appointmentId: null,
        contactId: a.customerId || null,
        source: "customer",
      });
    }

    // ── Step 4: Run vision AI on new attachments (batch of up to 30 per run) ──
    const toVerify = pending.slice(0, 30); // Cap to stay within timeout

    for (const att of toVerify) {
      const isPowerBill = await classifyImage(att.url);

      if (isPowerBill === null) {
        stats.errors++;
        continue;
      }

      const attachmentType = isPowerBill
        ? "power_bill_verified"
        : "not_power_bill";

      // Insert into attachments table
      await supabaseAdmin.from("attachments").insert({
        url: att.url,
        appointment_id: att.appointmentId,
        contact_id: att.contactId,
        source: att.source,
        attachment_type: attachmentType,
        uploaded_at: new Date().toISOString(),
      });

      stats.newlyVerified++;
      if (isPowerBill) stats.isPowerBill++;
      else stats.notPowerBill++;
    }

    // ── Step 5: Update appointments.has_power_bill based on verified attachments ──
    // Get all verified power bill attachments
    const { data: verifiedPBs } = await supabaseAdmin
      .from("attachments")
      .select("appointment_id, contact_id")
      .eq("attachment_type", "power_bill_verified");

    const apptIdsWithVerifiedPB = new Set<number>();
    const contactIdsWithVerifiedPB = new Set<number>();
    for (const v of verifiedPBs || []) {
      if (v.appointment_id) apptIdsWithVerifiedPB.add(v.appointment_id);
      if (v.contact_id) contactIdsWithVerifiedPB.add(v.contact_id);
    }

    // Get appointments that need updating
    const { data: apptsToCheck } = await supabaseAdmin
      .from("appointments")
      .select("id, contact_id, has_power_bill, hours_to_appointment")
      .gte("appointment_time", fromDate)
      .lte("appointment_time", toDate + "T23:59:59");

    for (const appt of apptsToCheck || []) {
      const hasVerifiedPB =
        apptIdsWithVerifiedPB.has(appt.id) ||
        contactIdsWithVerifiedPB.has(appt.contact_id);

      if (hasVerifiedPB !== appt.has_power_bill) {
        const hrs = appt.hours_to_appointment;
        const within2days = hrs != null && hrs > 0 && hrs <= 48;
        const star = hasVerifiedPB && within2days ? 3 : hasVerifiedPB ? 2 : 1;

        await supabaseAdmin
          .from("appointments")
          .update({
            has_power_bill: hasVerifiedPB,
            is_quality: hasVerifiedPB && within2days,
            star_rating: star,
          })
          .eq("id", appt.id);
        stats.appointmentsUpdated++;
      }
    }

    return NextResponse.json({
      success: true,
      window: { fromDate, toDate },
      ...stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
