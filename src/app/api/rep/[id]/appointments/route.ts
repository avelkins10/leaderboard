import { NextRequest, NextResponse } from "next/server";
import { getUsers } from "@/lib/repcard";
import { getSales } from "@/lib/quickbase";
import { REPCARD_API_KEY } from "@/lib/config";
import { getRepSales, getMonday, getToday } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase";

// Map RepCard status to a disposition category for badge coloring
function dispositionCategory(status?: string | null): string {
  if (!status) return "scheduled";
  const lower = status.toLowerCase();
  if (lower.includes("closed") || lower.includes("signed")) return "closed";
  if (lower.includes("no show")) return "noshow";
  if (lower.includes("cancel")) return "cancel";
  if (lower.includes("reschedule") || lower.includes("follow up"))
    return "reschedule";
  if (lower.includes("not reached") || lower.includes("no answer"))
    return "notreached";
  if (lower.includes("credit fail") || lower.includes("credit")) return "cf";
  if (lower.includes("shade") || lower.includes("shading")) return "shade";
  if (
    lower.includes("no close") ||
    lower.includes("no interest") ||
    lower.includes("not interested")
  )
    return "noclose";
  return "other";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = Number(params.id);
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get("from") || getMonday();
  const toDate = searchParams.get("to") || getToday();

  try {
    const [users, sales] = await Promise.all([
      getUsers(),
      getSales(fromDate, toDate),
    ]);

    const user = users.find((u) => u.id === userId);
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Determine role
    const rcRole = (user.role || "").toLowerCase();
    const isCloser =
      rcRole.includes("closer") ||
      rcRole.includes("area director") ||
      rcRole.includes("regional manager");
    const role = isCloser ? "closer" : "setter";

    // Fetch appointments from RepCard API directly (with setter_ids / closer_ids filter)
    const filterParam =
      role === "closer" ? `closer_ids=${userId}` : `setter_ids=${userId}`;

    const rcUrl = `https://app.repcard.com/api/appointments?${filterParam}&from_date=${fromDate}&to_date=${toDate}&per_page=100`;
    const rcRes = await fetch(rcUrl, {
      headers: { "x-api-key": REPCARD_API_KEY },
      next: { revalidate: 120 },
    });

    let appointments: any[] = [];
    if (rcRes.ok) {
      const rcData = await rcRes.json();
      const apptRows = rcData.result?.data || rcData.data || [];
      const seen = new Set<number>();
      appointments = apptRows
        .filter((a: any) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        })
        .map((a: any) => {
          const statusTitle = a.status?.title || null;
          // Schedule-out: hours between when appointment was created and when it's scheduled
          let hoursScheduledOut: number | null = null;
          if (a.createdAt && a.startAt) {
            const created = new Date(a.createdAt);
            const start = new Date(a.startAt);
            hoursScheduledOut = Math.max(
              0,
              (start.getTime() - created.getTime()) / (1000 * 60 * 60),
            );
          }

          return {
            id: a.id,
            contact_name: a.contact?.fullName || a.contact?.name || null,
            contact_address:
              a.appointmentLocation ||
              a.contact?.fullAddress ||
              [a.contact?.address, a.contact?.city, a.contact?.state]
                .filter(Boolean)
                .join(", ") ||
              null,
            appointment_time: a.startAt || null,
            created_at: a.createdAt || null,
            hours_scheduled_out: hoursScheduledOut,
            disposition: statusTitle,
            disposition_category: dispositionCategory(statusTitle),
            star_rating: a.contact?.rating ?? null,
            setter_name: a.setter?.fullName || a.setter?.name || null,
            closer_name: a.closer?.fullName || a.closer?.name || null,
            has_power_bill: a.contact?.hasPowerBill ?? null,
            office_team: a.setter?.team || null,
          };
        });
    }

    // Enrich with star ratings from Supabase (webhooks compute these)
    const apptIds = appointments.map((a: any) => a.id).filter(Boolean);
    if (apptIds.length > 0) {
      const { data: starData } = await supabaseAdmin
        .from("appointments")
        .select("id, star_rating, has_power_bill")
        .in("id", apptIds);
      if (starData) {
        const starMap = new Map(starData.map((s: any) => [s.id, s]));
        for (const appt of appointments) {
          const sb = starMap.get(appt.id);
          if (sb) {
            appt.star_rating = sb.star_rating ?? null;
            appt.has_power_bill = sb.has_power_bill ?? null;
          }
        }
      }
    }

    // QB sales attributed to this rep
    const fullName = `${user.firstName} ${user.lastName}`;
    const { allSales: repSales } = getRepSales(sales, userId, fullName);

    // Compute avg schedule-out hours
    const schedHours = appointments
      .map((a: any) => a.hours_scheduled_out)
      .filter((h: any) => h != null && h >= 0);
    const avgScheduleOutHours =
      schedHours.length > 0
        ? schedHours.reduce((sum: number, h: number) => sum + h, 0) /
          schedHours.length
        : null;

    return NextResponse.json({
      role,
      appointments,
      sales: repSales,
      avgScheduleOutHours,
      period: { from: fromDate, to: toDate },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
