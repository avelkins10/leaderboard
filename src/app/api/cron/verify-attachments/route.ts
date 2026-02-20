import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

const REPCARD_API_KEY = process.env.REPCARD_API_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET || "backfill2026";

const VISION_PROMPT = `Solar company reps upload photos when setting appointments. Is this image related to the homeowner's electricity or power usage? This includes: power bills, electric bills, utility bills, energy usage charts/graphs, screenshots from utility apps, or any document showing kWh consumption. Photos of utility meters do NOT count — only actual bills or usage documents. Reply with ONLY "YES" or "NO".`;

/** Classify an image as power bill or not via GPT-4o-mini vision */
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
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "low" },
              },
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
 * Lightweight: single page fetch, parallel vision, minimal DB writes.
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
  const fromDate = new Date(now.getTime() - 3 * 86400000)
    .toISOString()
    .slice(0, 10);
  const toDate = now.toISOString().slice(0, 10);

  const stats = {
    fetched: { appointment: 0, customer: 0 },
    alreadyVerified: 0,
    verified: 0,
    isPowerBill: 0,
    notPowerBill: 0,
    errors: 0,
    appointmentsUpdated: 0,
  };

  try {
    // ── Step 1: Single page fetch from each attachment endpoint (fast) ──
    const [apptRes, custRes] = await Promise.all([
      fetch(
        `https://app.repcard.com/api/appointments/attachments?from_date=${fromDate}&to_date=${toDate}&per_page=100&page=1`,
        { headers: { "x-api-key": REPCARD_API_KEY } },
      ),
      fetch(
        `https://app.repcard.com/api/customers/attachments?from_date=${fromDate}&to_date=${toDate}&per_page=100&page=1`,
        { headers: { "x-api-key": REPCARD_API_KEY } },
      ),
    ]);

    const apptData = apptRes.ok
      ? await apptRes.json()
      : { result: { data: [] } };
    const custData = custRes.ok
      ? await custRes.json()
      : { result: { data: [] } };
    const apptAttachments = apptData.result?.data || apptData.data || [];
    const custAttachments = custData.result?.data || custData.data || [];
    stats.fetched.appointment = apptAttachments.length;
    stats.fetched.customer = custAttachments.length;

    // ── Step 2: Get already-verified URLs ──
    const { data: existingAttachments } = await supabaseAdmin
      .from("attachments")
      .select("url");
    const verifiedUrls = new Set(
      (existingAttachments || []).map((a: any) => a.url),
    );

    // ── Step 3: Build pending list ──
    type Pending = {
      url: string;
      appointmentId: number | null;
      contactId: number | null;
      source: "appointment" | "customer";
    };
    const pending: Pending[] = [];

    for (const a of apptAttachments) {
      if (!a.attachmentUrl) continue;
      if (verifiedUrls.has(a.attachmentUrl)) {
        stats.alreadyVerified++;
        continue;
      }
      pending.push({
        url: a.attachmentUrl,
        appointmentId: a.appointmentId || null,
        contactId: null,
        source: "appointment",
      });
    }
    for (const a of custAttachments) {
      if (!a.attachmentUrl) continue;
      if (verifiedUrls.has(a.attachmentUrl)) {
        stats.alreadyVerified++;
        continue;
      }
      pending.push({
        url: a.attachmentUrl,
        appointmentId: null,
        contactId: a.customerId || null,
        source: "customer",
      });
    }

    // ── Step 4: Parallel vision AI (cap 40) ──
    const batch = pending.slice(0, 40);
    const results = await Promise.all(
      batch.map(async (att) => ({
        att,
        isPowerBill: await classifyImage(att.url),
      })),
    );

    // ── Step 5: Store results + update appointments ──
    for (const { att, isPowerBill } of results) {
      if (isPowerBill === null) {
        stats.errors++;
        continue;
      }

      await supabaseAdmin.from("attachments").insert({
        url: att.url,
        appointment_id: att.appointmentId,
        contact_id: att.contactId,
        source: att.source,
        attachment_type: isPowerBill ? "power_bill_verified" : "not_power_bill",
        uploaded_at: new Date().toISOString(),
      });

      stats.verified++;
      if (isPowerBill) stats.isPowerBill++;
      else stats.notPowerBill++;
    }

    // ── Step 6: Recompute has_power_bill on affected appointments ──
    const { data: allVerified } = await supabaseAdmin
      .from("attachments")
      .select("appointment_id, contact_id")
      .eq("attachment_type", "power_bill_verified");

    const verifiedApptIds = new Set<number>();
    const verifiedContactIds = new Set<number>();
    for (const v of allVerified || []) {
      if (v.appointment_id) verifiedApptIds.add(v.appointment_id);
      if (v.contact_id) verifiedContactIds.add(v.contact_id);
    }

    const { data: recentAppts } = await supabaseAdmin
      .from("appointments")
      .select("id, contact_id, has_power_bill, hours_to_appointment")
      .gte("appointment_time", fromDate)
      .lte("appointment_time", toDate + "T23:59:59");

    for (const appt of recentAppts || []) {
      const hasVerifiedPB =
        verifiedApptIds.has(appt.id) || verifiedContactIds.has(appt.contact_id);

      if (hasVerifiedPB !== appt.has_power_bill) {
        const hrs = appt.hours_to_appointment;
        const within2days = hrs != null && hrs > 0 && hrs <= 48;
        await supabaseAdmin
          .from("appointments")
          .update({
            has_power_bill: hasVerifiedPB,
            is_quality: hasVerifiedPB && within2days,
            star_rating:
              hasVerifiedPB && within2days ? 3 : hasVerifiedPB ? 2 : 1,
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
      { status: 500 },
    );
  }
}
