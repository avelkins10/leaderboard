"use client";

import { useState, useRef, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Calendar } from "lucide-react";
import { type PresetKey, PRESET_LABELS } from "@/hooks/useDateRange";

const PRESETS: PresetKey[] = [
  "today",
  "this-week",
  "last-week",
  "this-month",
  "last-30",
  "this-quarter",
  "ytd",
];

interface DateFilterProps {
  preset: PresetKey | null;
  displayFrom: string;
  displayTo: string;
  onPreset: (key: PresetKey) => void;
  onCustomRange: (from: string, to: string) => void;
}

function formatDisplay(from: string, to: string): string {
  const f = parseISO(from);
  const t = parseISO(to);
  if (from === to) return format(f, "MMM d, yyyy");
  if (f.getFullYear() === t.getFullYear()) {
    return `${format(f, "MMM d")} – ${format(t, "MMM d")}`;
  }
  return `${format(f, "MMM d, yyyy")} – ${format(t, "MMM d, yyyy")}`;
}

export function DateFilter({
  preset,
  displayFrom,
  displayTo,
  onPreset,
  onCustomRange,
}: DateFilterProps) {
  const [open, setOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(displayFrom);
  const [localTo, setLocalTo] = useState(displayTo);
  const ref = useRef<HTMLDivElement>(null);

  // Sync local inputs when props change (e.g. preset selection)
  useEffect(() => {
    setLocalFrom(displayFrom);
    setLocalTo(displayTo);
  }, [displayFrom, displayTo]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handlePreset = (key: PresetKey) => {
    onPreset(key);
    setOpen(false);
  };

  const handleApply = () => {
    if (localFrom && localTo && localFrom <= localTo) {
      onCustomRange(localFrom, localTo);
      setOpen(false);
    }
  };

  const label = preset ? PRESET_LABELS[preset] : formatDisplay(displayFrom, displayTo);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 h-9 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono tabular-nums">{label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[280px] rounded-xl border border-border bg-card p-4 shadow-lg">
          {/* Preset grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((key) => (
              <button
                key={key}
                onClick={() => handlePreset(key)}
                className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                  preset === key
                    ? "bg-card-dark text-card-dark-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {PRESET_LABELS[key]}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="my-3 border-t border-border" />

          {/* Custom range */}
          <div className="space-y-2">
            <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
              Custom Range
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={localFrom}
                onChange={(e) => setLocalFrom(e.target.value)}
                className="h-8 flex-1 rounded-md border border-border bg-secondary px-2 text-xs font-mono text-foreground"
              />
              <span className="text-muted-foreground text-xs">–</span>
              <input
                type="date"
                value={localTo}
                onChange={(e) => setLocalTo(e.target.value)}
                className="h-8 flex-1 rounded-md border border-border bg-secondary px-2 text-xs font-mono text-foreground"
              />
            </div>
            <button
              onClick={handleApply}
              disabled={!localFrom || !localTo || localFrom > localTo}
              className="w-full rounded-lg bg-card-dark px-3 py-2 text-xs font-semibold text-card-dark-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
