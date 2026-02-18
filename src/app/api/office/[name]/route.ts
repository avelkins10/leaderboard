import { NextRequest, NextResponse } from "next/server";
import { getTypedLeaderboards, getUsers } from "@/lib/repcard";
import { getSales } from "@/lib/quickbase";
import { OFFICE_MAPPING, qbOfficeToRepCardTeams } from "@/lib/config";
import {
  getOfficeAppointmentBreakdown,
  getActiveClosers,
  getActiveSettersForOffice,
  getOfficeSetterQualityStats,
  getOfficePartnerships,
} from "@/lib/supabase-queries";
import { isCancel, getMonday, getToday } from "@/lib/data";

export async function GET(
  req: NextRequest,
  { params }: { params: { name: string } },
) {
  const officeName = decodeURIComponent(params.name);
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get("from") || getMonday();
  const toDate = searchParams.get("to") || getToday();

  try {
    // Get RepCard team names for this QB office (for Supabase queries)
    const repCardTeamNames = qbOfficeToRepCardTeams(officeName);

    const [
      closerBoards,
      setterBoards,
      users,
      sales,
      apptBreakdown,
      activeCloserCount,
      activeSetterCount,
      qualityStats,
      partnerships,
    ] = await Promise.all([
      getTypedLeaderboards("closer", fromDate, toDate),
      getTypedLeaderboards("setter", fromDate, toDate),
      getUsers(),
      getSales(fromDate, toDate),
      repCardTeamNames.length > 0
        ? getOfficeAppointmentBreakdown(repCardTeamNames, fromDate, toDate)
        : Promise.resolve({
            total: 0,
            sat: 0,
            no_show: 0,
            canceled: 0,
            rescheduled: 0,
            scheduled: 0,
            other: 0,
          }),
      repCardTeamNames.length > 0
        ? getActiveClosers(repCardTeamNames, fromDate, toDate)
        : Promise.resolve(0),
      repCardTeamNames.length > 0
        ? getActiveSettersForOffice(repCardTeamNames, fromDate, toDate)
        : Promise.resolve(0),
      repCardTeamNames.length > 0
        ? getOfficeSetterQualityStats(repCardTeamNames, fromDate, toDate)
        : Promise.resolve([]),
      repCardTeamNames.length > 0
        ? getOfficePartnerships(repCardTeamNames, fromDate, toDate)
        : Promise.resolve([]),
    ]);

    const userMap: Record<number, any> = {};
    for (const u of users) userMap[u.id] = u;

    // Find team IDs that map to this office
    const teamIds = Object.entries(OFFICE_MAPPING)
      .filter(([, m]) => m.qbName === officeName && m.active)
      .map(([id]) => Number(id));

    const region =
      Object.values(OFFICE_MAPPING).find((m) => m.qbName === officeName)
        ?.region || "Unknown";

    // Process all leaderboards filtered to this office's teams
    const processLB = (lb: any) => {
      if (!lb?.stats?.headers) return [];
      return (lb.stats.stats || [])
        .filter(
          (s: any) =>
            s.item_type === "user" && teamIds.includes(s.office_team_id),
        )
        .map((s: any) => {
          const user = userMap[s.item_id];
          const values: Record<string, any> = {};
          for (const h of lb.stats.headers)
            values[h.short_name] = s[h.mapped_field] ?? 0;
          return {
            userId: s.item_id,
            name: user
              ? `${user.firstName} ${user.lastName}`
              : `User #${s.item_id}`,
            ...values,
          };
        });
    };

    const setterLB = setterBoards.find(
      (lb: any) => lb.leaderboard_name === "Setter Leaderboard",
    );
    const closerLB = closerBoards.find(
      (lb: any) => lb.leaderboard_name === "Closer Leaderboard",
    );
    const setterApptLB = setterBoards.find(
      (lb: any) => lb.leaderboard_name === "Setter Appointment Data",
    );
    const closerApptLB = closerBoards.find(
      (lb: any) => lb.leaderboard_name === "Closer Appointment Data",
    );
    const setters = processLB(setterLB);
    const closers = processLB(closerLB);
    const setterAppts = processLB(setterApptLB);
    const closerAppts = processLB(closerApptLB);

    // Sales for this office — split active vs cancelled using shared isCancel()
    const officeSales = sales.filter((s) => s.salesOffice === officeName);
    const activeOfficeSales = officeSales.filter((s) => !isCancel(s.status));
    const cancelledOfficeSales = officeSales.filter((s) => isCancel(s.status));

    // QB sales by closer/setter — indexed by both name and RepCard ID
    // Track active + cancelled separately for consistent cancel %
    type CloserAgg = {
      deals: number;
      cancelled: number;
      kw: number;
      ppwSum: number;
      ppwCount: number;
    };
    const newCloserAgg = (): CloserAgg => ({
      deals: 0,
      cancelled: 0,
      kw: 0,
      ppwSum: 0,
      ppwCount: 0,
    });
    const qbByCloserRC: Record<string, CloserAgg> = {};
    const qbByCloserName: Record<string, CloserAgg> = {};
    const qbClosesBySetter: Record<string, number> = {};
    const qbClosesBySetterRC: Record<string, number> = {};
    for (const sale of officeSales) {
      const cancelled = isCancel(sale.status);
      const closer = sale.closerName || "Unknown";

      if (!qbByCloserName[closer]) qbByCloserName[closer] = newCloserAgg();
      if (cancelled) {
        qbByCloserName[closer].cancelled++;
      } else {
        qbByCloserName[closer].deals++;
        qbByCloserName[closer].kw += sale.systemSizeKw;
        qbByCloserName[closer].ppwSum += sale.netPpw;
        qbByCloserName[closer].ppwCount++;
      }

      if (sale.closerRepCardId) {
        if (!qbByCloserRC[sale.closerRepCardId])
          qbByCloserRC[sale.closerRepCardId] = newCloserAgg();
        if (cancelled) {
          qbByCloserRC[sale.closerRepCardId].cancelled++;
        } else {
          qbByCloserRC[sale.closerRepCardId].deals++;
          qbByCloserRC[sale.closerRepCardId].kw += sale.systemSizeKw;
          qbByCloserRC[sale.closerRepCardId].ppwSum += sale.netPpw;
          qbByCloserRC[sale.closerRepCardId].ppwCount++;
        }
      }
      const setter = sale.setterName || "Unknown";
      if (!cancelled) {
        if (setter !== "Unknown")
          qbClosesBySetter[setter] = (qbClosesBySetter[setter] || 0) + 1;
        if (sale.setterRepCardId)
          qbClosesBySetterRC[sale.setterRepCardId] =
            (qbClosesBySetterRC[sale.setterRepCardId] || 0) + 1;
      }
    }

    // Attach QB stats to closers — RepCard ID primary, name fallback
    for (const c of closers) {
      const agg = qbByCloserRC[c.userId] || qbByCloserName[c.name];
      c.qbCloses = agg?.deals || 0;
      c.qbCancelled = agg?.cancelled || 0;
      const total = c.qbCloses + c.qbCancelled;
      c.cancelPct = total > 0 ? Math.round((c.qbCancelled / total) * 100) : 0;
      c.totalKw = agg?.kw || 0;
      c.avgPpw =
        agg && agg.ppwCount > 0
          ? Math.round((agg.ppwSum / agg.ppwCount) * 100) / 100
          : 0;
    }

    // Build setter accountability by merging setter LB + setter appt data + QB closes + quality stats
    const setterApptMap: Record<number, any> = {};
    for (const sa of setterAppts) setterApptMap[sa.userId] = sa;

    // Index quality stats by setter_id for merge
    const qualityMap: Record<number, any> = {};
    for (const qs of qualityStats) qualityMap[qs.setter_id] = qs;

    const setterAccountability = setters.map((s: any) => {
      const apptData = setterApptMap[s.userId] || {};
      const quality = qualityMap[s.userId];
      const qbCloses =
        qbClosesBySetterRC[s.userId] || qbClosesBySetter[s.name] || 0;
      const appt = s.APPT || 0;
      const sits = s.SITS || 0;
      const nosh = apptData.NOSH || 0;
      const canc = apptData.CANC || 0;
      const sitRate = appt > 0 ? (sits / appt) * 100 : 0;
      const closeRate = appt > 0 ? (qbCloses / appt) * 100 : 0;
      const wasteRate = appt > 0 ? ((nosh + canc) / appt) * 100 : 0;
      return {
        ...s,
        nosh,
        canc,
        qbCloses,
        sitRate,
        closeRate,
        wasteRate,
        avgStars: quality?.avg_stars || 0,
        powerBillCount: quality?.power_bill_count || 0,
        qualityCount: quality?.quality_count || 0,
      };
    });

    // Funnel data - use QB closes instead of RC CLOS
    const totalDoors = setters.reduce(
      (s: number, r: any) => s + (r.DK || 0),
      0,
    );
    const totalAppts = setters.reduce(
      (s: number, r: any) => s + (r.APPT || 0),
      0,
    );
    const totalSits = closers.reduce(
      (s: number, r: any) => s + (r.SAT || 0),
      0,
    );
    const totalQBCloses = activeOfficeSales.length;
    const totalRCClaims = closers.reduce(
      (s: number, r: any) => s + (r.CLOS || 0),
      0,
    );

    return NextResponse.json({
      office: officeName,
      region,
      period: { from: fromDate, to: toDate },
      setters: setterAccountability,
      closers,
      closerAppts,
      sales: officeSales,
      activeSetters: activeSetterCount,
      activeClosers: activeCloserCount,
      funnel: {
        doors: totalDoors,
        appointments: totalAppts,
        sits: totalSits,
        qbCloses: totalQBCloses,
        rcClaims: totalRCClaims,
        breakdown: apptBreakdown,
      },
      partnerships,
      summary: {
        deals: activeOfficeSales.length,
        kw: activeOfficeSales.reduce((s, sale) => s + sale.systemSizeKw, 0),
        cancelled: cancelledOfficeSales.length,
        cancelPct:
          officeSales.length > 0
            ? Math.round(
                (cancelledOfficeSales.length / officeSales.length) * 100,
              )
            : 0,
        avgPpw:
          activeOfficeSales.length > 0
            ? activeOfficeSales.reduce((s, sale) => s + sale.netPpw, 0) /
              activeOfficeSales.length
            : 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
