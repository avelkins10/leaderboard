import { NextRequest, NextResponse } from "next/server";
import { getTypedLeaderboards, getUsers } from "@/lib/repcard";
import { getSales } from "@/lib/quickbase";
import { OFFICE_MAPPING, teamIdToQBOffice } from "@/lib/config";

export async function GET(
  req: NextRequest,
  { params }: { params: { name: string } },
) {
  const officeName = decodeURIComponent(params.name);
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get("from") || getMonday();
  const toDate = searchParams.get("to") || getToday();
  const today = getToday();

  try {
    const needsToday = toDate >= today;
    const [closerBoards, setterBoards, setterBoardsToday, users, sales] =
      await Promise.all([
        getTypedLeaderboards("closer", fromDate, toDate),
        getTypedLeaderboards("setter", fromDate, toDate),
        needsToday
          ? getTypedLeaderboards("setter", today, today)
          : Promise.resolve([]),
        getUsers(),
        getSales(fromDate, toDate),
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
    const setterTodayLB = setterBoardsToday.find(
      (lb: any) => lb.leaderboard_name === "Setter Leaderboard",
    );

    const setters = processLB(setterLB);
    const closers = processLB(closerLB);
    const setterAppts = processLB(setterApptLB);
    const closerAppts = processLB(closerApptLB);
    const settersToday = processLB(setterTodayLB);

    // Active reps today
    const activeReps = settersToday.filter((s: any) => (s.DK || 0) > 0).length;

    // Sales for this office
    const officeSales = sales.filter((s) => s.salesOffice === officeName);

    // QB closes by closer/setter — indexed by both name and RepCard ID
    const qbClosesByCloser: Record<string, number> = {};
    const qbClosesBySetter: Record<string, number> = {};
    const qbClosesByCloserRC: Record<string, number> = {};
    const qbClosesBySetterRC: Record<string, number> = {};
    for (const sale of officeSales) {
      const closer = sale.closerName || "Unknown";
      qbClosesByCloser[closer] = (qbClosesByCloser[closer] || 0) + 1;
      if (sale.closerRepCardId) {
        qbClosesByCloserRC[sale.closerRepCardId] =
          (qbClosesByCloserRC[sale.closerRepCardId] || 0) + 1;
      }
      const setter = sale.setterName || "Unknown";
      if (setter !== "Unknown") {
        qbClosesBySetter[setter] = (qbClosesBySetter[setter] || 0) + 1;
      }
      if (sale.setterRepCardId) {
        qbClosesBySetterRC[sale.setterRepCardId] =
          (qbClosesBySetterRC[sale.setterRepCardId] || 0) + 1;
      }
    }

    // Attach QB closes to closers — prefer RepCard ID, fallback to name
    for (const c of closers) {
      c.qbCloses =
        qbClosesByCloserRC[c.userId] || qbClosesByCloser[c.name] || 0;
    }

    // Build setter accountability by merging setter LB + setter appt data + QB closes
    const setterApptMap: Record<number, any> = {};
    for (const sa of setterAppts) setterApptMap[sa.userId] = sa;

    const setterAccountability = setters.map((s: any) => {
      const apptData = setterApptMap[s.userId] || {};
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

    return NextResponse.json({
      office: officeName,
      region,
      period: { from: fromDate, to: toDate },
      setters: setterAccountability,
      closers,
      closerAppts,
      sales: officeSales,
      activeReps,
      funnel: {
        doors: totalDoors,
        appointments: totalAppts,
        sits: totalSits,
        qbCloses: totalQBCloses,
        rcClaims: totalRCClaims,
      },
      summary: {
        deals: officeSales.length,
        kw: officeSales.reduce((s, sale) => s + sale.systemSizeKw, 0),
        avgPpw:
          officeSales.length > 0
            ? officeSales.reduce((s, sale) => s + sale.netPpw, 0) /
              officeSales.length
            : 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split("T")[0];
}
function getToday(): string {
  return new Date().toISOString().split("T")[0];
}
