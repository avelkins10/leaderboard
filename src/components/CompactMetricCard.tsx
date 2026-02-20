"use client";
import { Tooltip } from "./Tooltip";

type Color = "default" | "green" | "blue" | "yellow" | "red";

interface Row {
  label: string;
  value: string | number;
  color?: Color;
}

interface CompactMetricCardProps {
  title: string;
  tooltip?: string;
  rows: Row[];
}

const valueColor: Record<string, string> = {
  default: "text-card-dark-foreground",
  green: "text-primary",
  blue: "text-info",
  yellow: "text-warning",
  red: "text-destructive",
};

export function CompactMetricCard({
  title,
  tooltip,
  rows,
}: CompactMetricCardProps) {
  return (
    <div className="relative rounded-xl bg-card-dark p-5">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-card-dark-foreground/50">
          {title}
        </span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-xs text-card-dark-foreground/50">
              {row.label}
            </span>
            <span
              className={`text-sm font-semibold font-mono tabular-nums ${valueColor[row.color || "default"]}`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
