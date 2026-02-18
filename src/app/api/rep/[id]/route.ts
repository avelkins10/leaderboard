import { NextRequest, NextResponse } from "next/server";
import { getLeaderboards, getUsers, getAppointments } from "@/lib/repcard";
import { getSales } from "@/lib/quickbase";
import { OFFICE_MAPPING, teamIdToQBOffice } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";
import { dispositionCategory } from "@/lib/supabase-queries";
import {
  getRepSales,
  computeCloserQBStats,
  getMonday,
  getToday,
} from "@/lib/data";
import repRoles from "@/lib/rep-roles.json";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = Number(params.id);
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get("from") || getMonday();
  const toDate = searchParams.get("to") || getToday();
  const qualityRange = searchParams.get("qualityRange") || "week"; // 'week' | 'ytd'

  // Quality stats date range
  const qualityFrom =
    qualityRange === "ytd" ? `${new Date().getFullYear()}-01-01` : fromDate;
  const qualityTo = toDate;

  try {
    const [leaderboards, users, sales, appointments] = await Promise.all([
      getLeaderboards(fromDate, toDate),
      getUsers(),
      getSales(fromDate, toDate),
      getAppointments(fromDate, toDate),
    ]);

    const user = users.find((u) => u.id === userId);
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const qbOffice = teamIdToQBOffice(user.officeTeamId) || "Unknown";
    const region = OFFICE_MAPPING[user.officeTeamId]?.region || user.office;

    // Find user in leaderboards
    const findInLB = (lbName: string) => {
      const lb = leaderboards.find((l: any) => l.leaderboard_name === lbName);
      if (!lb || Array.isArray(lb.stats) || !lb.stats?.headers) return null;
      const stat = (lb.stats as any).stats.find(
        (s: any) => s.item_id === userId && s.item_type === "user",
      );
      if (!stat) return null;
      const values: Record<string, any> = {};
      for (const h of (lb.stats as any).headers)
        values[h.short_name] = stat[h.mapped_field] ?? 0;
      return values;
    };

    const setterStats = findInLB("Setter Leaderboard");
    const closerStats = findInLB("Closer Leaderboard");
    const setterApptStats = findInLB("Setter Appointment Data");
    const closerApptStats = findInLB("Closer Appointment Data");
    // Determine role — check RepCard role field first, then fall back to leaderboard presence
    const rcRole = (user.role || "").toLowerCase();
    const role =
      rcRole.includes("closer") ||
      rcRole.includes("area director") ||
      rcRole.includes("regional manager")
        ? "closer"
        : rcRole.includes("setter")
          ? "setter"
          : closerStats
            ? "closer"
            : setterStats
              ? "setter"
              : "unknown";

    // User's appointments (from RepCard)
    const userAppts = appointments.filter(
      (a) => a.setter_id === userId || a.closer_id === userId,
    );

    // Disposition breakdown for closers
    const dispositions: Record<string, number> = {};
    if (closerApptStats) {
      for (const [key, val] of Object.entries(closerApptStats)) {
        if (typeof val === "number" && val > 0) dispositions[key] = val;
      }
    }

    // QB sales — use shared attribution (RepCard ID primary, name fallback)
    const fullName = `${user.firstName} ${user.lastName}`;
    const { closerSales: repCloserSales, allSales: repSales } = getRepSales(
      sales,
      userId,
      fullName,
    );

    // Quality stats from Supabase — query as setter for setters, as closer for closers
    let qualityStats = null;
    let qualityInsights = null;
    {
      const idField = role === "closer" ? "closer_id" : "setter_id";
      const { data: apptRows } = await supabaseAdmin
        .from("appointments")
        .select(
          "has_power_bill, hours_to_appointment, is_quality, disposition, star_rating",
        )
        .eq(idField, userId)
        .gte("appointment_time", qualityFrom)
        .lte("appointment_time", qualityTo + "T23:59:59");

      if (apptRows && apptRows.length > 0) {
        const total = apptRows.length;
        const withPowerBill = apptRows.filter(
          (a) => a.has_power_bill === true,
        ).length;
        const within48hrs = apptRows.filter(
          (a) =>
            a.hours_to_appointment != null &&
            a.hours_to_appointment > 0 &&
            a.hours_to_appointment <= 48,
        ).length;
        const threeStarCount = apptRows.filter(
          (a) => a.is_quality === true,
        ).length;
        const twoStarCount = apptRows.filter(
          (a) =>
            a.has_power_bill === true &&
            (a.hours_to_appointment == null || a.hours_to_appointment > 48),
        ).length;
        const oneStarCount = total - threeStarCount - twoStarCount;
        const avgStars =
          total > 0
            ? Math.round(
                ((threeStarCount * 3 + twoStarCount * 2 + oneStarCount * 1) /
                  total) *
                  100,
              ) / 100
            : 0;

        qualityStats = {
          total,
          withPowerBill,
          within48hrs,
          threeStarCount,
          twoStarCount,
          oneStarCount,
          avgStars,
          range: qualityRange,
        };

        // Quality insights — sit rate by quality factors
        const SAT_CATS = new Set([
          "closed",
          "no_close",
          "one_legger",
          "follow_up",
          "credit_fail",
          "shade",
        ]);
        const isSat = (row: any) =>
          SAT_CATS.has(dispositionCategory(row.disposition));
        const hasDisposition = (row: any) =>
          dispositionCategory(row.disposition) !== "unknown";

        const dispositioned = apptRows.filter(hasDisposition);

        const withPB = dispositioned.filter((a) => a.has_power_bill === true);
        const withoutPB = dispositioned.filter(
          (a) => a.has_power_bill !== true,
        );
        const within48 = dispositioned.filter(
          (a) =>
            a.hours_to_appointment != null &&
            a.hours_to_appointment > 0 &&
            a.hours_to_appointment <= 48,
        );
        const over48 = dispositioned.filter(
          (a) => a.hours_to_appointment != null && a.hours_to_appointment > 48,
        );
        const star3 = dispositioned.filter((a) => a.star_rating === 3);
        const star2 = dispositioned.filter((a) => a.star_rating === 2);
        const star1 = dispositioned.filter((a) => a.star_rating === 1);

        const rate = (arr: any[]) =>
          arr.length > 0
            ? Math.round((arr.filter(isSat).length / arr.length) * 1000) / 10
            : 0;
        const MIN_SAMPLE = 3;

        qualityInsights = {
          sitRate_withPB: withPB.length >= MIN_SAMPLE ? rate(withPB) : null,
          sitRate_withoutPB:
            withoutPB.length >= MIN_SAMPLE ? rate(withoutPB) : null,
          n_withPB: withPB.length,
          n_withoutPB: withoutPB.length,
          sitRate_within48:
            within48.length >= MIN_SAMPLE ? rate(within48) : null,
          sitRate_over48: over48.length >= MIN_SAMPLE ? rate(over48) : null,
          n_within48: within48.length,
          n_over48: over48.length,
          sitRate_3star: star3.length >= MIN_SAMPLE ? rate(star3) : null,
          sitRate_2star: star2.length >= MIN_SAMPLE ? rate(star2) : null,
          sitRate_1star: star1.length >= MIN_SAMPLE ? rate(star1) : null,
          n_3star: star3.length,
          n_2star: star2.length,
          n_1star: star1.length,
        };
      }
    }

    // Appointment history from Supabase
    const { data: appointmentHistory } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, contact_name, contact_address, appointment_time, disposition, disposition_category, has_power_bill, hours_to_appointment, is_quality, setter_notes, closer_name, setter_name, star_rating",
      )
      .or(`setter_id.eq.${userId},closer_id.eq.${userId}`)
      .order("appointment_time", { ascending: false })
      .limit(50);

    // Closer QB stats — use shared computation from data.ts
    const closerQBStats =
      repCloserSales.length > 0 ? computeCloserQBStats(repCloserSales) : null;

    return NextResponse.json({
      user: {
        id: user.id,
        name: fullName,
        email: user.email,
        office: qbOffice,
        team: user.team,
        region,
        role,
        roleBadge:
          (repRoles as Record<string, string>)[String(userId)] ||
          user.jobTitle ||
          null,
        jobTitle: user.jobTitle,
        status: user.status,
        image: user.image,
      },
      stats: role === "setter" ? setterStats : closerStats,
      setterStats: setterStats,
      closerStats: closerStats,
      appointmentStats: role === "setter" ? setterApptStats : closerApptStats,
      setterApptStats: setterApptStats,
      closerApptStats: closerApptStats,
      dispositions,
      qualityStats,
      qualityInsights,
      closerQBStats,
      appointments: userAppts,
      appointmentHistory: appointmentHistory || [],
      sales: repSales,
      period: { from: fromDate, to: toDate },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
