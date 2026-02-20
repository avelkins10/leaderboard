/**
 * Coaching threshold constants.
 * good = green badge, ok = yellow badge, below ok = red badge.
 * For "inverted" metrics (lower is better), good < ok.
 */
export const THRESHOLDS = {
  /** Sit Rate: Sits / Appts (higher is better) */
  sitRate: { good: 50, ok: 30 },
  /** Close Rate per Sit: Closes / Sits (higher is better) */
  closeRatePerSit: { good: 35, ok: 25 },
  /** Close Rate per Appt: Closes / Appts — setter accountability (higher is better) */
  closeRatePerAppt: { good: 15, ok: 8 },
  /** Waste Rate: (No Shows + Cancels) / Appts — inverted (lower is better) */
  wasteRate: { good: 15, ok: 30 },
  /** Cancel Rate: Cancelled / Total Closes — inverted (lower is better) */
  cancelRate: { good: 15, ok: 30 },
} as const;

export type ThresholdKey = keyof typeof THRESHOLDS;
