/**
 * Shared formatting utilities for consistent display across the app.
 */

/** Format a number with commas: 1234 → "1,234" */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** Format a percentage to 1 decimal max, capped at a reasonable value: 33.333 → "33.3%" */
export function formatPercent(n: number, decimals = 1): string {
  const capped = Math.min(Math.max(n, 0), 100);
  // Strip trailing zeros: 50.0 → "50", 33.3 → "33.3"
  const formatted = parseFloat(capped.toFixed(decimals)).toString();
  return `${formatted}%`;
}

/** Format an ISO date string to a clean date: "2026-02-17T21:04:00Z" → "Feb 17, 2026" */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format a short date without year: "2026-02-17" → "Feb 17" */
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Format as currency: 3.45 → "$3.45" */
export function formatCurrency(n: number, decimals = 2): string {
  return `$${n.toFixed(decimals)}`;
}

/** Format kW to 1 decimal: 12.345 → "12.3" */
export function formatKw(n: number): string {
  return n.toFixed(1);
}
