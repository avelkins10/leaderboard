import { NextRequest, NextResponse } from "next/server";
import { getLeaderboards, getTypedLeaderboards, getUsers } from "@/lib/repcard";
import { getSales } from "@/lib/quickbase";
import {
  OFFICE_MAPPING,
  REPCARD_API_KEY,
  teamIdToQBOffice,
  getOfficeTimezone,
} from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";
import { dateBoundsUTC } from "@/lib/data";
import { dispositionCategory, getFieldTimeStats } from "@/lib/supabase-queries";
import {
  getRepSales,
  computeCloserQBStats,
  getMonday,
  getToday,
} from "@/lib/data";
import repRoles from "@/lib/rep-roles.json";

/** Get short timezone abbreviation for an office */
function getTzAbbrev(qbOffice: string): string {
  const tz = getOfficeTimezone(qbOffice);
  try {
    return (
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value || ""
    );
  } catch {
    return "";
  }
}

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
    const [leaderboards, users, sales] = await Promise.all([
      getLeaderboards(fromDate, toDate),
      getUsers(),
      getSales(fromDate, toDate),
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

    // Fetch user-specific appointments from RepCard API (not all company appointments)
    const filterParam =
      role === "closer" ? `closer_ids=${userId}` : `setter_ids=${userId}`;
    const rcUrl = `https://app.repcard.com/api/appointments?${filterParam}&from_date=${fromDate}&to_date=${toDate}&per_page=100`;
    const rcRes = await fetch(rcUrl, {
      headers: { "x-api-key": REPCARD_API_KEY },
      next: { revalidate: 120 },
    });

    let userAppts: any[] = [];
    if (rcRes.ok) {
      const rcData = await rcRes.json();
      const apptRows = rcData.result?.data || rcData.data || [];
      userAppts = apptRows.map((a: any) => {
        const statusTitle = a.status?.title || null;
        const categoryTitle = a.status?.category?.title || null;
        return {
          id: a.id,
          setter_id: a.setter?.id || null,
          closer_id: a.closer?.id || null,
          contact_name: a.contact?.fullName || a.contact?.name || null,
          contact_address:
            a.appointmentLocation ||
            a.contact?.fullAddress ||
            [a.contact?.address, a.contact?.city, a.contact?.state]
              .filter(Boolean)
              .join(", ") ||
            null,
          appointment_time: a.startAt || null,
          disposition: statusTitle,
          disposition_category: categoryTitle
            ? categoryTitle.toLowerCase().replace(/\s+/g, "_")
            : statusTitle
              ? dispositionCategory(statusTitle)
              : "scheduled",
          setter_name: a.setter?.fullName || a.setter?.name || null,
          closer_name: a.closer?.fullName || a.closer?.name || null,
          office_team: a.setter?.team || null,
        };
      });
    }

    // Disposition breakdown for closers (exclude non-disposition stats like LEAD)
    const NON_DISPOSITION_KEYS = new Set(["LEAD", "SAT"]);
    const dispositions: Record<string, number> = {};
    if (closerApptStats) {
      for (const [key, val] of Object.entries(closerApptStats)) {
        if (
          typeof val === "number" &&
          val > 0 &&
          !NON_DISPOSITION_KEYS.has(key)
        )
          dispositions[key] = val;
      }
    }

    // QB sales — use shared attribution (RepCard ID primary, name fallback)
    const fullName = `${user.firstName} ${user.lastName}`;
    const { closerSales: repCloserSales, setterSales: repSetterSales, allSales: repSales } = getRepSales(
      sales,
      userId,
      fullName,
    );

    // Quality stats from Supabase — webhook-computed star_rating / power_bill data
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
        .gte("appointment_time", dateBoundsUTC(qualityFrom, qualityTo).gte)
        .lte("appointment_time", dateBoundsUTC(qualityFrom, qualityTo).lte);

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
          (a) => a.star_rating === 3,
        ).length;
        const twoStarCount = apptRows.filter(
          (a) => a.star_rating === 2,
        ).length;
        const oneStarCount = apptRows.filter(
          (a) => a.star_rating === 1,
        ).length;
        const withStars = apptRows.filter((a) => a.star_rating != null);
        const avgStars =
          withStars.length > 0
            ? Math.round(
                (withStars.reduce((s, a) => s + a.star_rating, 0) /
                  withStars.length) *
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

    // Enrich appointments with Supabase star/power bill data
    const apptIds = userAppts.map((a: any) => a.id).filter(Boolean);
    if (apptIds.length > 0) {
      const { data: starData } = await supabaseAdmin
        .from("appointments")
        .select("id, star_rating, has_power_bill, hours_to_appointment, power_bill_urls")
        .in("id", apptIds);
      if (starData) {
        const starMap = new Map(starData.map((s: any) => [s.id, s]));
        for (const appt of userAppts) {
          const sb = starMap.get(appt.id);
          if (sb) {
            appt.star_rating = sb.star_rating ?? null;
            appt.has_power_bill = sb.has_power_bill ?? null;
            appt.hours_to_appointment = sb.hours_to_appointment ?? null;
            appt.power_bill_urls = sb.power_bill_urls ?? null;
          }
        }
      }
    }

    // Appointment history from RepCard API (sorted by date descending, last 50)
    const appointmentHistory = userAppts
      .sort(
        (a, b) =>
          new Date(b.appointment_time).getTime() -
          new Date(a.appointment_time).getTime(),
      )
      .slice(0, 50);

    // Setter coaching metrics
    let setterCoaching = null;
    if (role === "setter" && setterStats) {
      const appt = setterStats.APPT || 0;
      const sits = setterStats.SITS || 0;
      const clos = setterStats.CLOS || 0;
      const dk = setterStats.DK || 0;
      const qp = setterStats.QP || 0;
      const nosh = setterApptStats?.NOSH || 0;
      const canc = setterApptStats?.CANC || 0;
      const rsch = setterApptStats?.RSCH || 0;
      const ntr = setterApptStats?.NTR || 0;
      const cf = setterApptStats?.CF || 0;
      const shad = setterApptStats?.SHAD || setterApptStats?.SHADE || 0;
      const qbCloses = repSetterSales.length;
      // "Good sits" = sits minus credit fails and shade (not closeable leads)
      const goodSits = Math.max(0, sits - cf - shad);

      // Compute schedule-out from RepCard appointments
      const schedHours = userAppts
        .map((a: any) => {
          if (!a.appointment_time) return null;
          // Use Supabase hours_to_appointment if available, else compute
          if (a.hours_to_appointment != null) return a.hours_to_appointment;
          return null;
        })
        .filter((h: any) => h != null && h > 0);
      const avgScheduleOut =
        schedHours.length > 0
          ? schedHours.reduce((sum: number, h: number) => sum + h, 0) /
            schedHours.length
          : null;

      setterCoaching = {
        doors: dk,
        qualifiedPitches: qp,
        appointments: appt,
        sits: sits,
        rcCloses: clos,
        qbCloses,
        noShows: nosh,
        cancels: canc,
        reschedules: rsch,
        notReached: ntr,
        pending: Math.max(0, appt - sits - nosh - canc),
        creditFails: cf,
        shadeFails: shad,
        goodSits,
        sitRate: appt > 0 ? Math.round((sits / appt) * 1000) / 10 : 0,
        closeRate: sits > 0 ? Math.round((qbCloses / sits) * 1000) / 10 : 0,
        wasteRate:
          appt > 0 ? Math.round(((nosh + canc) / appt) * 1000) / 10 : 0,
        doorToAppt: dk > 0 ? Math.round((appt / dk) * 1000) / 10 : 0,
        doorToQP: dk > 0 ? Math.round((qp / dk) * 1000) / 10 : 0,
        avgScheduleOutHours: avgScheduleOut,
        // Field time — computed from Supabase door_knocks
        qualityHours: null as string | null,
        firstDoorKnock: null as string | null,
        lastDoorKnock: null as string | null,
        timezone: getTzAbbrev(qbOffice),
      };

      // Fetch field time from Supabase door_knocks (accurate per-day averages)
      try {
        const tz = getOfficeTimezone(qbOffice);
        const fieldTime = await getFieldTimeStats(
          [userId],
          null,
          fromDate,
          toDate,
          tz,
        );
        if (fieldTime.length > 0) {
          const ft = fieldTime[0];
          setterCoaching.qualityHours = `${ft.avgHoursPerDay}h`;
          setterCoaching.firstDoorKnock = ft.avgStartTime;
          setterCoaching.lastDoorKnock = ft.avgEndTime;
        }
      } catch {
        // Graceful fallback — field time stays null
      }
    }

    // Closer QB stats — use shared computation from data.ts
    const closerQBStats =
      repCloserSales.length > 0 ? computeCloserQBStats(repCloserSales) : null;

    // Weekly trend — last 4 weeks of leaderboard data
    const weeklyTrend: any[] = [];
    try {
      const weeks: { weekLabel: string; from: string; to: string }[] = [];
      const today = new Date(toDate);
      for (let i = 3; i >= 0; i--) {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weeks.push({
          weekLabel: `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          from: weekStart.toISOString().split("T")[0],
          to: weekEnd.toISOString().split("T")[0],
        });
      }

      const weekBoards = await Promise.all(
        weeks.map((w) =>
          getTypedLeaderboards(
            role === "closer" ? "closer" : "setter",
            w.from,
            w.to,
          ).catch(() => []),
        ),
      );

      for (let i = 0; i < weeks.length; i++) {
        const boards = weekBoards[i];
        const lbName =
          role === "closer" ? "Closer Leaderboard" : "Setter Leaderboard";
        const lb = boards.find(
          (b: any) => b.leaderboard_name === lbName,
        ) as any;
        if (!lb || !lb.stats?.headers) continue;

        const stat = (lb.stats as any).stats?.find(
          (s: any) => s.item_id === userId && s.item_type === "user",
        );
        if (!stat) {
          weeklyTrend.push({
            week: weeks[i].weekLabel,
            DK: 0,
            APPT: 0,
            SITS: 0,
            CLOS: 0,
            SAT: 0,
            LEAD: 0,
          });
          continue;
        }

        const values: Record<string, any> = {};
        for (const h of (lb.stats as any).headers) {
          values[h.short_name] = stat[h.mapped_field] ?? 0;
        }
        weeklyTrend.push({
          week: weeks[i].weekLabel,
          DK: values.DK || 0,
          APPT: values.APPT || 0,
          SITS: values.SITS || 0,
          CLOS: values.CLOS || 0,
          SAT: values.SAT || 0,
          LEAD: values.LEAD || 0,
        });
      }
    } catch {
      // Graceful degradation — skip weekly trend on error
    }

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
      setterCoaching,
      closerQBStats,
      appointments: userAppts,
      appointmentHistory,
      weeklyTrend,
      sales: repSales,
      period: { from: fromDate, to: toDate },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
