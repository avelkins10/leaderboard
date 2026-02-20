import { NextRequest, NextResponse } from "next/server";
import { getTypedLeaderboards, getUsers } from "@/lib/repcard";
import { getSales, getInstalls } from "@/lib/quickbase";
import {
  OFFICE_MAPPING,
  qbOfficeToRepCardTeams,
  normalizeQBOffice,
} from "@/lib/config";
import {
  getOfficeSetterQualityStats,
  getOfficePartnerships,
  getSpeedToClose,
  getCloserQualityByStars,
} from "@/lib/supabase-queries";
import { isCancel, isValidPpw, getMonday, getToday } from "@/lib/data";

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
      qualityStats,
      partnerships,
      speedToClose,
      closerQualityByStars,
      installs,
    ] = await Promise.all([
      getTypedLeaderboards("closer", fromDate, toDate),
      getTypedLeaderboards("setter", fromDate, toDate),
      getUsers(),
      getSales(fromDate, toDate),
      repCardTeamNames.length > 0
        ? getOfficeSetterQualityStats(repCardTeamNames, fromDate, toDate)
        : Promise.resolve([]),
      repCardTeamNames.length > 0
        ? getOfficePartnerships(repCardTeamNames, fromDate, toDate)
        : Promise.resolve([]),
      getSpeedToClose(fromDate, toDate).catch(() => null),
      repCardTeamNames.length > 0
        ? getCloserQualityByStars(repCardTeamNames, fromDate, toDate).catch(
            () => [],
          )
        : Promise.resolve([]),
      getInstalls(fromDate, toDate).catch(() => []),
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

    // Derive active rep counts from leaderboard data (DK > 0 for setters, SAT >= 1 for closers)
    // Deduplicate: same person can be setter AND closer
    const activeRepIds = new Set<number>();
    const activeSetterIds = new Set<number>();
    const activeCloserIds = new Set<number>();
    for (const s of setters) {
      if ((s.DK || 0) > 0) {
        activeSetterIds.add(s.userId);
        activeRepIds.add(s.userId);
      }
    }
    for (const c of closers) {
      if ((c.SAT || 0) >= 1) {
        activeCloserIds.add(c.userId);
        activeRepIds.add(c.userId);
      }
    }
    const activeSetterCount = activeSetterIds.size;
    const activeCloserCount = activeCloserIds.size;

    // Derive appointment breakdown from leaderboard data
    const apptBreakdown = {
      total: setterAppts.reduce((s: number, r: any) => s + (r.APPT || 0), 0),
      sat: closerAppts.reduce((s: number, r: any) => s + (r.SAT || 0), 0),
      closed: closerAppts.reduce((s: number, r: any) => s + (r.CLOS || 0), 0),
      closer_fault: closerAppts.reduce(
        (s: number, r: any) => s + (r.NOCL || 0) + (r.FUS || 0),
        0,
      ),
      setter_fault: closerAppts.reduce(
        (s: number, r: any) => s + (r.CF || 0) + (r.SHAD || 0),
        0,
      ),
      no_show: setterAppts.reduce((s: number, r: any) => s + (r.NOSH || 0), 0),
      canceled: setterAppts.reduce((s: number, r: any) => s + (r.CANC || 0), 0),
      rescheduled: setterAppts.reduce(
        (s: number, r: any) => s + (r.RSCH || 0),
        0,
      ),
      scheduled: 0, // leaderboard doesn't track pending separately
      other: 0,
    };

    // Sales for this office — split active vs cancelled using shared isCancel()
    const officeSales = sales.filter(
      (s) => normalizeQBOffice(s.salesOffice || "") === officeName,
    );
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
      // A close is a close — count all deals for setter attribution
      const setter = sale.setterName || "Unknown";
      if (setter !== "Unknown")
        qbClosesBySetter[setter] = (qbClosesBySetter[setter] || 0) + 1;
      if (sale.setterRepCardId)
        qbClosesBySetterRC[sale.setterRepCardId] =
          (qbClosesBySetterRC[sale.setterRepCardId] || 0) + 1;
    }

    // Attach QB stats to closers — RepCard ID primary, name fallback
    for (const c of closers) {
      const agg = qbByCloserRC[c.userId] || qbByCloserName[c.name];
      c.qbCloses = (agg?.deals || 0) + (agg?.cancelled || 0);
      c.qbCancelled = agg?.cancelled || 0;
      c.cancelPct =
        c.qbCloses > 0 ? Math.round((c.qbCancelled / c.qbCloses) * 100) : 0;
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
    const totalQBCloses = officeSales.length;
    const totalRCClaims = closers.reduce(
      (s: number, r: any) => s + (r.CLOS || 0),
      0,
    );

    // Filter installs for this office
    const officeInstalls = (installs || []).filter(
      (i) => normalizeQBOffice(i.salesOffice || "") === officeName,
    );

    // Filter speed-to-close for this office (null if no office-specific data)
    const officeStc = speedToClose?.byOffice[officeName];
    const officeSpeedToClose = officeStc
      ? {
          avgDays: officeStc.avgDays,
          count: officeStc.count,
          byCloser: speedToClose!.byCloser,
        }
      : null;

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
      speedToClose: officeSpeedToClose,
      closerQualityByStars: closerQualityByStars || [],
      installs: officeInstalls.length,
      installsKw: officeInstalls.reduce((s, i) => s + i.systemSizeKw, 0),
      summary: {
        deals: officeSales.length,
        kw: officeSales.reduce((s, sale) => s + sale.systemSizeKw, 0),
        cancelled: cancelledOfficeSales.length,
        cancelPct:
          officeSales.length > 0
            ? Math.round(
                (cancelledOfficeSales.length / officeSales.length) * 100,
              )
            : 0,
        avgPpw: (() => {
          const valid = officeSales.filter((s) => isValidPpw(s.netPpw));
          return valid.length > 0
            ? valid.reduce((s, sale) => s + sale.netPpw, 0) / valid.length
            : 0;
        })(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
