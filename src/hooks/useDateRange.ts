"use client";

import { useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subWeeks,
  format,
} from "date-fns";

export type PresetKey =
  | "today"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-30"
  | "this-quarter"
  | "ytd";

export const PRESET_LABELS: Record<PresetKey, string> = {
  today: "Today",
  "this-week": "This Week",
  "last-week": "Last Week",
  "this-month": "This Month",
  "last-30": "Last 30 Days",
  "this-quarter": "This Quarter",
  ytd: "YTD",
};

/** Pure function — no React. Nav can call this for prefetch. */
export function computePreset(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  let rangeStart: Date;
  let rangeEnd: Date;

  switch (key) {
    case "today":
      rangeStart = now;
      rangeEnd = now;
      break;
    case "this-week":
      rangeStart = startOfWeek(now, { weekStartsOn: 0 });
      rangeEnd = now;
      break;
    case "last-week": {
      const prev = subWeeks(now, 1);
      rangeStart = startOfWeek(prev, { weekStartsOn: 0 });
      rangeEnd = endOfWeek(prev, { weekStartsOn: 0 });
      break;
    }
    case "this-month":
      rangeStart = startOfMonth(now);
      rangeEnd = now;
      break;
    case "last-30":
      rangeStart = subDays(now, 29);
      rangeEnd = now;
      break;
    case "this-quarter":
      rangeStart = startOfQuarter(now);
      rangeEnd = now;
      break;
    case "ytd":
      rangeStart = startOfYear(now);
      rangeEnd = now;
      break;
  }

  return {
    from: format(rangeStart, "yyyy-MM-dd"),
    to: format(rangeEnd, "yyyy-MM-dd"), // inclusive end
  };
}

export function useDateRange(defaultPreset: PresetKey = "this-week") {
  const [preset, setPresetState] = useState<PresetKey | null>(defaultPreset);
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);

  let from: string;
  let to: string;
  let displayFrom: string;
  let displayTo: string;

  if (preset) {
    const computed = computePreset(preset);
    from = computed.from;
    to = computed.to;
    displayFrom = from;
    displayTo = to;
  } else {
    // custom range
    displayFrom = customFrom!;
    displayTo = customTo!;
    from = displayFrom;
    to = displayTo;
  }

  const setPreset = (key: PresetKey) => {
    setPresetState(key);
    setCustomFrom(null);
    setCustomTo(null);
  };

  const setCustomRange = (cfrom: string, cto: string) => {
    setPresetState(null);
    setCustomFrom(cfrom);
    setCustomTo(cto);
  };

  return { preset, from, to, displayFrom, displayTo, setPreset, setCustomRange };
}
