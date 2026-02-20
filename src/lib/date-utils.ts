/**
 * Date utilities — shared across data.ts, repcard.ts, supabase-queries.ts, and route files.
 * Extracted to break circular imports (repcard.ts needs dateBoundsUTC, data.ts imports repcard.ts).
 */

export const CT_TZ = "America/Chicago";

export function getMonday(): string {
  const now = new Date();
  const ctDate = new Date(
    now.toLocaleString("en-US", { timeZone: CT_TZ }),
  );
  const day = ctDate.getDay();
  const diff = ctDate.getDate() - day + (day === 0 ? -6 : 1);
  ctDate.setDate(diff);
  const y = ctDate.getFullYear();
  const m = String(ctDate.getMonth() + 1).padStart(2, "0");
  const d = String(ctDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getToday(): string {
  const now = new Date();
  const ctDate = new Date(
    now.toLocaleString("en-US", { timeZone: CT_TZ }),
  );
  const y = ctDate.getFullYear();
  const m = String(ctDate.getMonth() + 1).padStart(2, "0");
  const d = String(ctDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Convert YYYY-MM-DD date range to UTC timestamp boundaries aligned to
 * America/Chicago timezone. Most KIN offices are Central; the small offset
 * for Mountain offices is acceptable for aggregate queries.
 */
export function dateBoundsUTC(
  from: string,
  to: string,
): { gte: string; lte: string } {
  function getOffset(dateStr: string): number {
    const [y, m, d] = dateStr.split("-").map(Number);
    // Probe at 18:00 UTC — safely in the middle of a CT day
    const dt = new Date(Date.UTC(y, m - 1, d, 18, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: CT_TZ,
      hour: "numeric",
      hour12: false,
    }).formatToParts(dt);
    const ctHour = parseInt(parts.find((p) => p.type === "hour")!.value);
    return 18 - ctHour; // 6 for CST, 5 for CDT
  }

  const [fy, fm, fd] = from.split("-").map(Number);
  const fromOff = getOffset(from);
  const toOff = getOffset(to);
  const [ty, tm, td] = to.split("-").map(Number);

  return {
    gte: new Date(Date.UTC(fy, fm - 1, fd, fromOff, 0, 0)).toISOString(),
    lte: new Date(
      Date.UTC(ty, tm - 1, td + 1, toOff, 0, 0) - 1000,
    ).toISOString(),
  };
}

/** Add N days to a YYYY-MM-DD date string */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
