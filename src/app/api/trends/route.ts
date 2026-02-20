import { NextRequest, NextResponse } from "next/server";
import { getUsers, fetchRepCardAppointmentsCT } from "@/lib/repcard";
import { getSales } from "@/lib/quickbase";
import { teamIdToQBOffice } from "@/lib/config";
import {
  getSetterActivity,
  getCloserActivity,
} from "@/lib/supabase-queries";
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
      let cursor = startOfWeek(parseISO(fromParam), { weekStartsOn: 0 });
      const rangeEnd = parseISO(toParam);
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

    // Fetch RepCard appointments + activity + sales for each week in parallel
    // One RepCard fetch per week, then derive setter + closer activity from it
    const weekResults = await Promise.all(
      weekRanges.map(async ({ from, to }) => {
        const [prefetchedAppts, sales] = await Promise.all([
          fetchRepCardAppointmentsCT(from, to),
          getSales(from, to),
        ]);
        const [setterActivityMap, closerActivityMap] = await Promise.all([
          getSetterActivity(from, to, undefined, prefetchedAppts),
          getCloserActivity(from, to, undefined, prefetchedAppts),
        ]);
        return [setterActivityMap, closerActivityMap, sales] as const;
      }),
    );

    const weeklyData = weekRanges.map(({ weekStart, from, to }, i) => {
      const [setterActivityMap, closerActivityMap, sales] = weekResults[i];

      // Aggregate by office using user→office mapping
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

      const newOffice = () => ({
        doors: 0,
        appts: 0,
        sits: 0,
        closes: 0,
        deals: 0,
        kw: 0,
        activeReps: 0,
      });

      const activeByOffice: Record<string, Set<number>> = {};

      // Setter activity → office aggregation
      for (const idStr of Object.keys(setterActivityMap)) {
        const id = Number(idStr);
        const act = setterActivityMap[id];
        const user = userMap[id];
        const office = user ? teamIdToQBOffice(user.officeTeamId) : null;
        if (!office) continue;
        if (!officeData[office]) officeData[office] = newOffice();
        officeData[office].doors += act.DK;
        officeData[office].appts += act.APPT;
        officeData[office].sits += act.SITS;
        if (act.DK > 0) {
          if (!activeByOffice[office]) activeByOffice[office] = new Set();
          activeByOffice[office].add(id);
        }
      }

      // Closer activity → office aggregation
      for (const idStr of Object.keys(closerActivityMap)) {
        const id = Number(idStr);
        const act = closerActivityMap[id];
        const user = userMap[id];
        const office = user ? teamIdToQBOffice(user.officeTeamId) : null;
        if (!office) continue;
        if (!officeData[office]) officeData[office] = newOffice();
        officeData[office].closes += act.CLOS;
        if (act.SAT >= 1) {
          if (!activeByOffice[office]) activeByOffice[office] = new Set();
          activeByOffice[office].add(id);
        }
      }

      for (const [office, ids] of Object.entries(activeByOffice)) {
        if (officeData[office]) {
          officeData[office].activeReps = ids.size;
        }
      }

      for (const sale of sales) {
        const office = sale.salesOffice || "Unknown";
        if (!officeData[office]) officeData[office] = newOffice();
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
