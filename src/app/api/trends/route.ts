import { NextRequest, NextResponse } from "next/server";
import { getLeaderboards, getUsers } from "@/lib/repcard";
import { getSales } from "@/lib/quickbase";
import { teamIdToQBOffice } from "@/lib/config";
import {
  format,
  parseISO,
  subWeeks,
  startOfWeek,
  endOfWeek,
  addWeeks,
  isBefore,
} from "date-fns";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const weeksParam = searchParams.get("weeks");

  try {
    const users = await getUsers();
    const userMap: Record<number, any> = {};
    for (const u of users) userMap[u.id] = u;

    // Build week ranges, then fetch all weeks in parallel
    const weekRanges: {
      weekStart: Date;
      weekEnd: Date;
      from: string;
      to: string;
    }[] = [];

    if (fromParam && toParam) {
      // Compute Sun-Sat weekly buckets within the from/to range
      let cursor = startOfWeek(parseISO(fromParam), { weekStartsOn: 0 });
      const rangeEnd = parseISO(toParam); // exclusive
      while (isBefore(cursor, rangeEnd)) {
        const wEnd = endOfWeek(cursor, { weekStartsOn: 0 });
        weekRanges.push({
          weekStart: cursor,
          weekEnd: wEnd,
          from: format(cursor, "yyyy-MM-dd"),
          to: format(wEnd, "yyyy-MM-dd"),
        });
        cursor = addWeeks(cursor, 1);
      }
    } else {
      // Legacy: use weeks param
      const weeks = Number(weeksParam || "4");
      for (let w = weeks - 1; w >= 0; w--) {
        const wStart = startOfWeek(subWeeks(new Date(), w), {
          weekStartsOn: 0,
        });
        const wEnd = endOfWeek(subWeeks(new Date(), w), { weekStartsOn: 0 });
        weekRanges.push({
          weekStart: wStart,
          weekEnd: wEnd,
          from: format(wStart, "yyyy-MM-dd"),
          to: format(wEnd, "yyyy-MM-dd"),
        });
      }
    }

    const weekResults = await Promise.all(
      weekRanges.map(({ from, to }) =>
        Promise.all([getLeaderboards(from, to), getSales(from, to)]),
      ),
    );

    const weeklyData = weekRanges.map(({ weekStart, from, to }, i) => {
      const [leaderboards, sales] = weekResults[i];

      // Aggregate by office
      const officeData: Record<
        string,
        {
          doors: number;
          appts: number;
          sits: number;
          closes: number;
          deals: number;
          kw: number;
          activeReps: number;
        }
      > = {};

      const setterLB = leaderboards.find(
        (lb: any) => lb.leaderboard_name === "Setter Leaderboard",
      ) as any;
      if (setterLB?.stats?.headers) {
        const dkHeader = setterLB.stats.headers.find(
          (h: any) => h.short_name === "DK",
        );
        const apptHeader = setterLB.stats.headers.find(
          (h: any) => h.short_name === "APPT",
        );
        for (const s of setterLB.stats.stats) {
          if (s.item_type !== "user") continue;
          const office = teamIdToQBOffice(s.office_team_id);
          if (!office) continue;
          if (!officeData[office])
            officeData[office] = {
              doors: 0,
              appts: 0,
              sits: 0,
              closes: 0,
              deals: 0,
              kw: 0,
              activeReps: 0,
            };
          officeData[office].doors += dkHeader
            ? s[dkHeader.mapped_field] || 0
            : 0;
          officeData[office].appts += apptHeader
            ? s[apptHeader.mapped_field] || 0
            : 0;
        }
      }

      const closerLB = leaderboards.find(
        (lb: any) => lb.leaderboard_name === "Closer Leaderboard",
      ) as any;
      if (closerLB?.stats?.headers) {
        const satHeader = closerLB.stats.headers.find(
          (h: any) => h.short_name === "SAT",
        );
        const closHeader = closerLB.stats.headers.find(
          (h: any) => h.short_name === "CLOS",
        );
        for (const s of closerLB.stats.stats) {
          if (s.item_type !== "user") continue;
          const office = teamIdToQBOffice(s.office_team_id);
          if (!office) continue;
          if (!officeData[office])
            officeData[office] = {
              doors: 0,
              appts: 0,
              sits: 0,
              closes: 0,
              deals: 0,
              kw: 0,
              activeReps: 0,
            };
          officeData[office].sits += satHeader
            ? s[satHeader.mapped_field] || 0
            : 0;
          officeData[office].closes += closHeader
            ? s[closHeader.mapped_field] || 0
            : 0;
        }
      }

      // Count active reps per office (deduplicated by userId)
      const activeByOffice: Record<string, Set<number>> = {};
      if (setterLB?.stats?.headers) {
        const dkHeader = setterLB.stats.headers.find(
          (h: any) => h.short_name === "DK",
        );
        for (const s of setterLB.stats.stats) {
          if (s.item_type !== "user") continue;
          const office = teamIdToQBOffice(s.office_team_id);
          if (!office) continue;
          const dk = dkHeader ? s[dkHeader.mapped_field] || 0 : 0;
          if (dk > 0) {
            if (!activeByOffice[office]) activeByOffice[office] = new Set();
            activeByOffice[office].add(s.user_id);
          }
        }
      }
      if (closerLB?.stats?.headers) {
        const satHeader = closerLB.stats.headers.find(
          (h: any) => h.short_name === "SAT",
        );
        for (const s of closerLB.stats.stats) {
          if (s.item_type !== "user") continue;
          const office = teamIdToQBOffice(s.office_team_id);
          if (!office) continue;
          const sat = satHeader ? s[satHeader.mapped_field] || 0 : 0;
          if (sat >= 1) {
            if (!activeByOffice[office]) activeByOffice[office] = new Set();
            activeByOffice[office].add(s.user_id);
          }
        }
      }
      for (const [office, ids] of Object.entries(activeByOffice)) {
        if (officeData[office]) {
          officeData[office].activeReps = ids.size;
        }
      }

      for (const sale of sales) {
        const office = sale.salesOffice || "Unknown";
        if (!officeData[office])
          officeData[office] = {
            doors: 0,
            appts: 0,
            sits: 0,
            closes: 0,
            deals: 0,
            kw: 0,
          };
        officeData[office].deals++;
        officeData[office].kw += sale.systemSizeKw;
      }

      return {
        week: format(weekStart, "MMM d"),
        weekStart: from,
        weekEnd: to,
        totalDeals: sales.length,
        totalKw: sales.reduce((s, sale) => s + sale.systemSizeKw, 0),
        offices: officeData,
      };
    });

    return NextResponse.json({ weeks: weeklyData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
