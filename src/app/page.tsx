"use client";

import { useState, useCallback, useMemo, Fragment } from "react";
import useSWR, { preload } from "swr";
import { fetcher } from "@/lib/swr";
import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { Section } from "@/components/Section";
import { DateFilter } from "@/components/DateFilter";
import { useDateRange } from "@/hooks/useDateRange";
import { Tooltip } from "@/components/Tooltip";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Target,
  Zap,
  ArrowRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Calendar,
  XCircle,
  TrendingUp,
  Inbox,
} from "lucide-react";
import {
  formatNumber,
  formatKw,
  formatCurrency,
  formatDate,
} from "@/lib/format";
import { THRESHOLDS } from "@/lib/thresholds";

// ── Types ──
interface ScorecardData {
  period: { from: string; to: string };
  summary: {
    totalSales: number;
    totalKw: number;
    avgSystemSize: number;
    avgPpw: number;
    cancelled: number;
    rejected: number;
    cancelPct: number;
    totalAppts: number;
    totalSits: number;
  };
  offices: Record<string, any>;
  allSetters: any[];
  allClosers: any[];
  salesByOffice: Record<string, any>;
  activeRepsByOffice: Record<string, number>;
}

type TabKey = "setters" | "closers" | "offices";
type SortDir = "asc" | "desc";
interface SortState {
  key: string;
  dir: SortDir;
}

// ── Skeleton ──
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-skeleton rounded-xl bg-secondary ${className}`} />
  );
}
function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-12" />
      <Skeleton className="h-96" />
    </div>
  );
}

// ── Sort helper ──
function sortBy<T>(arr: T[], key: string, dir: SortDir): T[] {
  return [...arr].sort((a: any, b: any) => {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    if (typeof av === "string" && typeof bv === "string")
      return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return dir === "asc" ? av - bv : bv - av;
  });
}

// ── Sortable header component ──
function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  tooltip,
  align = "right",
}: {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  tooltip?: string;
  align?: "left" | "right" | "center";
}) {
  const active = sort.key === sortKey;
  const Icon = active
    ? sort.dir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  return (
    <th
      className={`py-3 px-3 font-medium cursor-pointer select-none transition-colors hover:text-foreground ${align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right"} ${active ? "text-foreground" : ""}`}
      onClick={() => onSort(sortKey)}
    >
      <span
        className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}
      >
        {label}
        <Icon
          className={`h-3 w-3 shrink-0 ${active ? "text-primary" : "text-muted-foreground/30"}`}
        />
        {tooltip && <Tooltip text={tooltip} />}
      </span>
    </th>
  );
}

// ── Outcome breakdown component (expandable row content) ──
function OutcomeRow({
  outcomes,
  type,
}: {
  outcomes: Record<string, number>;
  type: "setter" | "closer";
}) {
  const items =
    type === "setter"
      ? [
          { key: "CANC", label: "Cancel", color: "text-destructive" },
          { key: "NOSH", label: "No Show", color: "text-warning" },
          { key: "NTR", label: "Not Reached", color: "text-muted-foreground" },
          { key: "RSCH", label: "Reschedule", color: "text-info" },
          { key: "CF", label: "Credit Fail", color: "text-muted-foreground" },
          { key: "SHAD", label: "Shade", color: "text-muted-foreground" },
        ]
      : [
          { key: "NOCL", label: "No Close", color: "text-warning" },
          { key: "CF", label: "Credit Fail", color: "text-muted-foreground" },
          { key: "FUS", label: "Follow Up", color: "text-info" },
          { key: "CANC", label: "Cancel", color: "text-destructive" },
          { key: "NOSH", label: "No Show", color: "text-warning" },
          { key: "RSCH", label: "Reschedule", color: "text-muted-foreground" },
          { key: "SHAD", label: "Shade", color: "text-muted-foreground" },
        ];

  return (
    <div className="flex flex-wrap gap-3 px-2 py-1">
      {items
        .filter((it) => (outcomes[it.key] || 0) > 0)
        .map((it) => (
          <span
            key={it.key}
            className={`inline-flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-1 text-2xs font-medium ${it.color}`}
          >
            <span className="font-mono font-semibold tabular-nums">
              {outcomes[it.key]}
            </span>
            {it.label}
          </span>
        ))}
      {items.every((it) => (outcomes[it.key] || 0) === 0) && (
        <span className="text-2xs text-muted-foreground/40">
          No outcome data
        </span>
      )}
    </div>
  );
}

// ── Disposition category → badge color ──
function dispositionBadgeClass(cat: string) {
  switch (cat) {
    case "closed":
      return "bg-primary/10 text-primary";
    case "no_show":
      return "bg-destructive/10 text-destructive";
    case "canceled":
      return "bg-warning/10 text-warning";
    case "credit_fail":
      return "bg-secondary text-muted-foreground";
    case "no_close":
      return "bg-warning/10 text-warning";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

// ── Lazy-loaded rep drill-down (appointments + sales) ──
function RepDrillDown({
  repId,
  type,
  from,
  to,
  outcomes,
}: {
  repId: number;
  type: "setter" | "closer";
  from: string;
  to: string;
  outcomes?: Record<string, number>;
}) {
  const { data, isLoading } = useSWR(
    `/api/rep/${repId}/appointments?from=${from}&to=${to}`,
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {outcomes && <OutcomeRow outcomes={outcomes} type={type} />}
        <div className="flex items-center gap-2 text-2xs text-muted-foreground/50">
          <svg
            className="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading appointments...
        </div>
      </div>
    );
  }

  const appts: any[] = data?.appointments || [];
  const sales: any[] = data?.sales || [];

  return (
    <div className="space-y-3">
      {/* Outcome badges + avg schedule-out */}
      <div className="flex flex-wrap items-center gap-3">
        {outcomes && <OutcomeRow outcomes={outcomes} type={type} />}
        {type === "setter" && data?.avgScheduleOutHours != null && (
          <span
            className={`rounded px-2 py-0.5 text-2xs font-medium ${
              data.avgScheduleOutHours <= 48
                ? "bg-primary/10 text-primary"
                : data.avgScheduleOutHours <= 72
                  ? "bg-warning/10 text-warning"
                  : "bg-destructive/10 text-destructive"
            }`}
          >
            Avg{" "}
            {data.avgScheduleOutHours < 48
              ? `${Math.round(data.avgScheduleOutHours)}h`
              : `${(data.avgScheduleOutHours / 24).toFixed(1)}d`}{" "}
            out
          </span>
        )}
      </div>

      {appts.length > 0 ? (
        <div className="mt-2 overflow-x-auto rounded-lg border border-border/40">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40 bg-secondary/20 text-2xs uppercase tracking-widest text-muted-foreground">
                <th className="py-2 px-3 text-left font-medium">Date</th>
                <th className="py-2 px-3 text-left font-medium">Customer</th>
                {type === "closer" && (
                  <th className="py-2 px-3 text-left font-medium">Setter</th>
                )}
                {type === "setter" && (
                  <th className="py-2 px-3 text-left font-medium">Closer</th>
                )}
                <th className="py-2 px-3 text-left font-medium">Disposition</th>
                {type === "setter" && (
                  <th className="py-2 px-3 text-center font-medium">Sched</th>
                )}
                {type === "setter" && (
                  <th className="py-2 px-3 text-center font-medium">Stars</th>
                )}
              </tr>
            </thead>
            <tbody>
              {appts.slice(0, 10).map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-border/20 hover:bg-secondary/20 transition-colors"
                >
                  <td className="py-2 px-3 font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                    {a.appointment_time
                      ? new Date(a.appointment_time).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" },
                        )
                      : "-"}
                  </td>
                  <td className="py-2 px-3 text-foreground max-w-[160px] truncate">
                    {a.contact_name || "-"}
                  </td>
                  {type === "closer" && (
                    <td className="py-2 px-3 text-muted-foreground">
                      {a.setter_name || "-"}
                    </td>
                  )}
                  {type === "setter" && (
                    <td className="py-2 px-3 text-muted-foreground">
                      {a.closer_name || "-"}
                    </td>
                  )}
                  <td className="py-2 px-3">
                    {a.disposition ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-2xs font-medium ${dispositionBadgeClass(a.disposition_category)}`}
                      >
                        {a.disposition}
                      </span>
                    ) : (
                      <span className="rounded bg-info/10 px-1.5 py-0.5 text-2xs font-medium text-info">
                        Scheduled
                      </span>
                    )}
                  </td>
                  {type === "setter" && (
                    <td className="py-2 px-3 text-center font-mono tabular-nums text-2xs">
                      {a.hours_scheduled_out != null ? (
                        <span
                          className={
                            a.hours_scheduled_out <= 48
                              ? "text-primary"
                              : a.hours_scheduled_out <= 72
                                ? "text-warning"
                                : "text-destructive"
                          }
                        >
                          {a.hours_scheduled_out < 48
                            ? `${Math.round(a.hours_scheduled_out)}h`
                            : `${(a.hours_scheduled_out / 24).toFixed(1)}d`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/25">-</span>
                      )}
                    </td>
                  )}
                  {type === "setter" && (
                    <td className="py-2 px-3 text-center font-mono">
                      {a.star_rating ? (
                        <span
                          className={
                            a.star_rating === 3
                              ? "text-primary"
                              : a.star_rating === 2
                                ? "text-warning"
                                : "text-destructive"
                          }
                        >
                          {a.star_rating}★
                        </span>
                      ) : (
                        <span className="text-muted-foreground/25">-</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {appts.length > 10 && (
            <Link
              href={`/rep/${repId}`}
              onClick={(e) => e.stopPropagation()}
              className="block px-3 py-2 text-2xs text-primary text-center border-t border-border/20 hover:bg-secondary/30 transition-colors"
            >
              +{appts.length - 10} more — view full profile &rarr;
            </Link>
          )}
        </div>
      ) : (
        data && (
          <p className="text-2xs text-muted-foreground/40">
            No appointments in this period
          </p>
        )
      )}

      {/* QB Sales inline for closers */}
      {type === "closer" && sales.length > 0 && (
        <div className="mt-2">
          <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
            QB Sales (
            {
              sales.filter(
                (s: any) =>
                  !["cancelled", "pending cancel"].some((p) =>
                    s.status?.toLowerCase().includes(p),
                  ),
              ).length
            }{" "}
            active)
          </p>
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/20 text-2xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 px-3 text-left font-medium">Date</th>
                  <th className="py-2 px-3 text-left font-medium">Customer</th>
                  <th className="py-2 px-3 text-right font-medium">kW</th>
                  <th className="py-2 px-3 text-right font-medium">PPW</th>
                  <th className="py-2 px-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 5).map((s: any, i: number) => (
                  <tr
                    key={i}
                    className="border-b border-border/20 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="py-2 px-3 font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatDate(s.saleDate)}
                    </td>
                    <td className="py-2 px-3 text-foreground max-w-[160px] truncate">
                      {s.customerName || "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {formatKw(s.systemSizeKw)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      {s.netPpw > 0 ? formatCurrency(s.netPpw) : "-"}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-2xs font-medium ${
                          ["cancelled", "pending cancel"].some((p) =>
                            s.status?.toLowerCase().includes(p),
                          )
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ──
export default function Dashboard() {
  const {
    preset,
    from,
    to,
    displayFrom,
    displayTo,
    setPreset,
    setCustomRange,
  } = useDateRange("this-week");
  const { data, error, isLoading } = useSWR<ScorecardData>(
    `/api/scorecard?from=${from}&to=${to}`,
    { refreshInterval: 60_000 },
  );

  // Tab state
  const [tab, setTab] = useState<TabKey>("setters");

  // Sort state per tab
  const [setterSort, setSetterSort] = useState<SortState>({
    key: "APPT",
    dir: "desc",
  });
  const [closerSort, setCloserSort] = useState<SortState>({
    key: "qbCloses",
    dir: "desc",
  });
  const [officeSort, setOfficeSort] = useState<SortState>({
    key: "qbCloses",
    dir: "desc",
  });

  // Expanded rows
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Prefetch helpers
  const prefetchRep = useCallback(
    (id: number) => {
      preload(`/api/rep/${id}?from=${from}&to=${to}`, fetcher);
    },
    [from, to],
  );
  const prefetchOffice = useCallback(
    (name: string) => {
      preload(
        `/api/office/${encodeURIComponent(name)}?from=${from}&to=${to}`,
        fetcher,
      );
    },
    [from, to],
  );

  // Toggle sort direction or set new column
  const handleSort = (
    current: SortState,
    setter: (s: SortState) => void,
    key: string,
  ) => {
    if (current.key === key) {
      setter({ key, dir: current.dir === "desc" ? "asc" : "desc" });
    } else {
      setter({ key, dir: "desc" });
    }
  };

  // ── Computed data ──
  const setterList = useMemo(() => {
    if (!data) return [];
    const withComputed = data.allSetters
      .filter((s) => (s.DK || 0) > 0 || (s.APPT || 0) > 0)
      .map((s) => {
        const appts = s.APPT || 0;
        const sits = s.SITS || 0;
        return {
          ...s,
          sitRate: appts > 0 ? Math.round((sits / appts) * 100) : 0,
          closeRate:
            sits > 0 ? Math.round(((s.qbCloses || 0) / sits) * 100) : 0,
          wasteRate:
            appts > 0
              ? Math.min(
                  100,
                  Math.round(
                    (((s.outcomes?.NOSH || 0) + (s.outcomes?.CANC || 0)) /
                      appts) *
                      100,
                  ),
                )
              : 0,
          avgStars: s.avgStars || 0,
        };
      });
    return sortBy(withComputed, setterSort.key, setterSort.dir);
  }, [data, setterSort]);

  const closerList = useMemo(() => {
    if (!data) return [];
    const withComputed = data.allClosers
      .filter((c) => (c.SAT || 0) > 0 || (c.qbCloses || 0) > 0)
      .map((c) => {
        const sits = c.SAT || 0;
        return {
          ...c,
          sitCloseRate:
            sits > 0 ? Math.round(((c.qbCloses || 0) / sits) * 100) : 0,
        };
      });
    return sortBy(withComputed, closerSort.key, closerSort.dir);
  }, [data, closerSort]);

  const officeList = useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(data.offices).map(
      ([name, d]: [string, any]) => {
        const totalDoors =
          d.setters?.reduce((s: number, r: any) => s + (r.DK || 0), 0) || 0;
        const totalAppts =
          d.setters?.reduce((s: number, r: any) => s + (r.APPT || 0), 0) || 0;
        const totalSits =
          d.closers?.reduce((s: number, r: any) => s + (r.SAT || 0), 0) || 0;
        const qbCloses = d.sales?.deals || 0;
        const kw = d.sales?.kw || 0;
        const cancelPct = d.sales?.cancelPct || 0;
        const rejected = d.sales?.rejected || 0;
        const activeReps = d.activeReps || 0;
        const activeSetters = d.activeSetters || 0;
        const activeClosers = d.activeClosers || 0;
        const closeRate = totalSits > 0 ? (qbCloses / totalSits) * 100 : 0;
        const sitRate = totalAppts > 0 ? (totalSits / totalAppts) * 100 : 0;
        // Weekly average: divide closes by number of weeks in the period
        const periodMs =
          new Date(data.period.to).getTime() -
          new Date(data.period.from).getTime();
        const weeks = Math.max(1, periodMs / (7 * 86400000));
        const weeklyAvg = qbCloses > 0 ? +(qbCloses / weeks).toFixed(1) : 0;
        return {
          name,
          qbCloses,
          kw,
          totalAppts,
          totalSits,
          totalDoors,
          cancelPct,
          rejected,
          activeReps,
          activeSetters,
          activeClosers,
          closeRate,
          sitRate,
          weeklyAvg,
          setters: d.setters || [],
          closers: d.closers || [],
        };
      },
    );
    return sortBy(entries, officeSort.key, officeSort.dir);
  }, [data, officeSort]);

  // Company close rate
  const companyCloseRate = useMemo(() => {
    if (!data) return 0;
    return data.summary.totalSits > 0
      ? Math.round((data.summary.totalSales / data.summary.totalSits) * 100)
      : 0;
  }, [data]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Company-wide performance overview
          </p>
        </div>
        <DateFilter
          preset={preset}
          displayFrom={displayFrom}
          displayTo={displayTo}
          onPreset={setPreset}
          onCustomRange={setCustomRange}
        />
      </div>

      {isLoading && <LoadingSkeleton />}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {data && !isLoading && (
        <div className="animate-enter space-y-6 sm:space-y-8">
          {/* ── KPI Cards ── */}
          <div>
            <p className="mb-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
              Company Stats
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <MetricCard
                label="Appts Set"
                value={formatNumber(data.summary.totalAppts)}
                color="blue"
                subtitle="Appointments"
                icon={<Calendar className="h-5 w-5" />}
                tooltip="Total appointments set by all setters"
              />
              <MetricCard
                label="Closes"
                value={formatNumber(data.summary.totalSales)}
                color="green"
                subtitle={`${data.summary.cancelled} cxl · ${data.summary.rejected} rej`}
                icon={<Target className="h-5 w-5" />}
                tooltip="All QB deals this period"
              />
              <MetricCard
                label="kW Sold"
                value={formatKw(data.summary.totalKw)}
                color="blue"
                subtitle="Total kilowatts"
                icon={<Zap className="h-5 w-5" />}
                tooltip="Total kW sold across all deals"
              />
              <MetricCard
                label="Close Rate"
                value={`${companyCloseRate}%`}
                subtitle="Closes / sits"
                icon={<TrendingUp className="h-5 w-5" />}
                tooltip="Company-wide: Closes / total sits"
              />
              <MetricCard
                label="Cancel Rate"
                value={`${data.summary.cancelPct}%`}
                color={data.summary.cancelPct > 20 ? "red" : "default"}
                subtitle={`${data.summary.cancelled} cancelled`}
                icon={<XCircle className="h-5 w-5" />}
                tooltip="Cancelled / total closes"
              />
            </div>
          </div>

          {/* ── Tab Toggles ── */}
          <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1 w-fit">
            {(
              [
                { key: "setters", label: "Setters" },
                { key: "closers", label: "Closers" },
                { key: "offices", label: "Offices" },
              ] as { key: TabKey; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                  tab === t.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── SETTER LEADERBOARD ── */}
          {tab === "setters" && (
            <div key="setters" className="animate-enter">
              <Section
                title="Setter Leaderboard"
                subtitle={`${setterList.length} setters with activity`}
                noPadding
              >
                {setterList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-16">
                    <Inbox className="h-10 w-10 text-muted-foreground/20" />
                    <p className="mt-3 text-sm font-medium text-muted-foreground">
                      No activity yet this period
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Check back later or change the date range
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto scrollable-table">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30 text-2xs uppercase tracking-widest text-muted-foreground">
                          <th className="py-3 px-4 text-left font-medium w-8 sm:px-6">
                            #
                          </th>
                          <SortHeader
                            label="Name"
                            sortKey="name"
                            sort={setterSort}
                            onSort={(k) =>
                              handleSort(setterSort, setSetterSort, k)
                            }
                            align="left"
                          />
                          <th className="py-3 px-3 text-left font-medium hidden sm:table-cell">
                            Office
                          </th>
                          <SortHeader
                            label="Appts"
                            sortKey="APPT"
                            sort={setterSort}
                            onSort={(k) =>
                              handleSort(setterSort, setSetterSort, k)
                            }
                            tooltip="Appointments set"
                          />
                          <SortHeader
                            label="Sits"
                            sortKey="SITS"
                            sort={setterSort}
                            onSort={(k) =>
                              handleSort(setterSort, setSetterSort, k)
                            }
                            tooltip="Appointments that sat"
                          />
                          <SortHeader
                            label="Sit %"
                            sortKey="sitRate"
                            sort={setterSort}
                            onSort={(k) =>
                              handleSort(setterSort, setSetterSort, k)
                            }
                            tooltip="Sits / appointments"
                          />
                          <SortHeader
                            label="Closes"
                            sortKey="qbCloses"
                            sort={setterSort}
                            onSort={(k) =>
                              handleSort(setterSort, setSetterSort, k)
                            }
                            tooltip="Verified closes from QuickBase"
                          />
                          <SortHeader
                            label="Close %"
                            sortKey="closeRate"
                            sort={setterSort}
                            onSort={(k) =>
                              handleSort(setterSort, setSetterSort, k)
                            }
                            tooltip="Closes / sits"
                          />
                          <SortHeader
                            label="Avg Stars"
                            sortKey="avgStars"
                            sort={setterSort}
                            onSort={(k) =>
                              handleSort(setterSort, setSetterSort, k)
                            }
                            tooltip="Average appointment quality (1-3 stars)"
                          />
                          <SortHeader
                            label="Waste %"
                            sortKey="wasteRate"
                            sort={setterSort}
                            onSort={(k) =>
                              handleSort(setterSort, setSetterSort, k)
                            }
                            tooltip="(No shows + Cancels) / Appointments"
                          />
                        </tr>
                      </thead>
                      <tbody className="text-[13px]">
                        {setterList.map((s, i) => {
                          const id = `setter-${s.userId}`;
                          const isExpanded = expanded.has(id);
                          const sits = s.SITS || 0;
                          const appts = s.APPT || 0;
                          const { sitRate, closeRate, wasteRate } = s;
                          return (
                            <Fragment key={s.userId}>
                              <tr
                                className={`border-b border-border/60 transition-colors hover:bg-secondary/30 cursor-pointer min-h-[44px] ${isExpanded ? "bg-secondary/20" : ""}`}
                                onClick={() => toggleExpand(id)}
                              >
                                <td className="py-3 px-4 sm:px-6">
                                  <span
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono ${
                                      i === 0
                                        ? "bg-primary/15 text-primary"
                                        : i < 3
                                          ? "bg-secondary text-foreground"
                                          : "text-muted-foreground/40"
                                    }`}
                                  >
                                    {i + 1}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <ChevronRight
                                      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90 text-muted-foreground" : "text-muted-foreground/30"}`}
                                    />
                                    <Link
                                      href={`/rep/${s.userId}`}
                                      onMouseEnter={() => prefetchRep(s.userId)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="font-medium text-foreground transition-colors hover:text-primary"
                                    >
                                      {s.name}
                                      {s.isRecruit && (
                                        <span className="ml-1 text-[10px] bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded">
                                          R
                                        </span>
                                      )}
                                    </Link>
                                  </div>
                                  <div className="sm:hidden text-2xs text-muted-foreground mt-0.5 ml-5.5">
                                    {s.qbOffice?.split(" - ")[0]}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-muted-foreground hidden sm:table-cell">
                                  {s.qbOffice?.split(" - ")[0]}
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-info">
                                  {appts}
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                  {sits}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  {appts > 0 ? (
                                    <StatusBadge
                                      value={sitRate}
                                      good={THRESHOLDS.sitRate.good}
                                      ok={THRESHOLDS.sitRate.ok}
                                    />
                                  ) : (
                                    <span className="text-muted-foreground/25 font-mono">
                                      --
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-primary">
                                  {s.qbCloses || 0}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  {sits > 0 ? (
                                    <StatusBadge
                                      value={closeRate}
                                      good={THRESHOLDS.closeRatePerSit.good}
                                      ok={THRESHOLDS.closeRatePerSit.ok}
                                    />
                                  ) : (
                                    <span className="text-muted-foreground/25 font-mono">
                                      --
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                  {s.avgStars > 0
                                    ? `${s.avgStars.toFixed(1)}`
                                    : "--"}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  {appts > 0 ? (
                                    <span
                                      className={`font-mono tabular-nums text-2xs font-semibold ${wasteRate > 50 ? "text-destructive" : wasteRate > 30 ? "text-warning" : "text-muted-foreground"}`}
                                    >
                                      {wasteRate}%
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/25 font-mono">
                                      --
                                    </span>
                                  )}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-secondary/10 border-b border-border/40">
                                  <td
                                    colSpan={99}
                                    className="py-3 px-6 sm:px-12"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1 min-w-0">
                                        <RepDrillDown
                                          repId={s.userId}
                                          type="setter"
                                          from={from}
                                          to={to}
                                          outcomes={s.outcomes}
                                        />
                                      </div>
                                      <Link
                                        href={`/rep/${s.userId}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-2xs text-primary hover:underline shrink-0 hidden sm:inline"
                                      >
                                        Full profile &rarr;
                                      </Link>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* ── CLOSER LEADERBOARD ── */}
          {tab === "closers" && (
            <div key="closers" className="animate-enter">
              <Section
                title="Closer Leaderboard"
                subtitle={`${closerList.length} closers with activity`}
                noPadding
              >
                {closerList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-16">
                    <Inbox className="h-10 w-10 text-muted-foreground/20" />
                    <p className="mt-3 text-sm font-medium text-muted-foreground">
                      No activity yet this period
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Check back later or change the date range
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto scrollable-table">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30 text-2xs uppercase tracking-widest text-muted-foreground">
                          <th className="py-3 px-4 text-left font-medium w-8 sm:px-6">
                            #
                          </th>
                          <SortHeader
                            label="Name"
                            sortKey="name"
                            sort={closerSort}
                            onSort={(k) =>
                              handleSort(closerSort, setCloserSort, k)
                            }
                            align="left"
                          />
                          <th className="py-3 px-3 text-left font-medium hidden sm:table-cell">
                            Office
                          </th>
                          <SortHeader
                            label="Closes"
                            sortKey="qbCloses"
                            sort={closerSort}
                            onSort={(k) =>
                              handleSort(closerSort, setCloserSort, k)
                            }
                            tooltip="Verified closes from QuickBase"
                          />
                          <SortHeader
                            label="kW"
                            sortKey="totalKw"
                            sort={closerSort}
                            onSort={(k) =>
                              handleSort(closerSort, setCloserSort, k)
                            }
                            tooltip="Total kilowatts sold"
                          />
                          <SortHeader
                            label="Avg PPW"
                            sortKey="avgPpw"
                            sort={closerSort}
                            onSort={(k) =>
                              handleSort(closerSort, setCloserSort, k)
                            }
                            tooltip="Average net price per watt"
                          />
                          <SortHeader
                            label="Sits"
                            sortKey="SAT"
                            sort={closerSort}
                            onSort={(k) =>
                              handleSort(closerSort, setCloserSort, k)
                            }
                            tooltip="Appointments sat"
                          />
                          <SortHeader
                            label="Close %"
                            sortKey="sitCloseRate"
                            sort={closerSort}
                            onSort={(k) =>
                              handleSort(closerSort, setCloserSort, k)
                            }
                            tooltip="Closes / sits"
                          />
                          <SortHeader
                            label="Cancel %"
                            sortKey="cancelPct"
                            sort={closerSort}
                            onSort={(k) =>
                              handleSort(closerSort, setCloserSort, k)
                            }
                            tooltip="Cancelled / total closes"
                          />
                          <th className="py-3 px-3 text-right font-medium hidden lg:table-cell">
                            Cancels
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-[13px]">
                        {closerList.map((c, i) => {
                          const id = `closer-${c.userId}`;
                          const isExpanded = expanded.has(id);
                          const sits = c.SAT || 0;
                          const { sitCloseRate } = c;
                          return (
                            <Fragment key={c.userId}>
                              <tr
                                className={`border-b border-border/60 transition-colors hover:bg-secondary/30 cursor-pointer min-h-[44px] ${isExpanded ? "bg-secondary/20" : ""}`}
                                onClick={() => toggleExpand(id)}
                              >
                                <td className="py-3 px-4 sm:px-6">
                                  <span
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono ${
                                      i === 0
                                        ? "bg-primary/15 text-primary"
                                        : i < 3
                                          ? "bg-secondary text-foreground"
                                          : "text-muted-foreground/40"
                                    }`}
                                  >
                                    {i + 1}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <ChevronRight
                                      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90 text-muted-foreground" : "text-muted-foreground/30"}`}
                                    />
                                    <Link
                                      href={`/rep/${c.userId}`}
                                      onMouseEnter={() => prefetchRep(c.userId)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="font-medium text-foreground transition-colors hover:text-primary"
                                    >
                                      {c.name}
                                    </Link>
                                  </div>
                                  <div className="sm:hidden text-2xs text-muted-foreground mt-0.5 ml-5.5">
                                    {c.qbOffice?.split(" - ")[0]}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-muted-foreground hidden sm:table-cell">
                                  {c.qbOffice?.split(" - ")[0]}
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-primary">
                                  {c.qbCloses || 0}
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                  {formatKw(c.totalKw || 0)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                  {c.avgPpw > 0
                                    ? formatCurrency(c.avgPpw)
                                    : "--"}
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                  {sits}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  {sits > 0 ? (
                                    <StatusBadge
                                      value={sitCloseRate}
                                      good={THRESHOLDS.closeRatePerSit.good}
                                      ok={THRESHOLDS.closeRatePerSit.ok}
                                    />
                                  ) : (
                                    <span className="text-muted-foreground/25 font-mono">
                                      --
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  {(c.qbCloses || 0) + (c.qbCancelled || 0) >
                                  0 ? (
                                    <span
                                      className={`font-mono tabular-nums text-2xs font-semibold ${c.cancelPct > 30 ? "text-destructive" : c.cancelPct > 15 ? "text-warning" : "text-muted-foreground"}`}
                                    >
                                      {c.cancelPct}%
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/25 font-mono">
                                      --
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground hidden lg:table-cell">
                                  {c.qbCancelled || 0}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-secondary/10 border-b border-border/40">
                                  <td
                                    colSpan={99}
                                    className="py-3 px-6 sm:px-12"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1 min-w-0">
                                        <RepDrillDown
                                          repId={c.userId}
                                          type="closer"
                                          from={from}
                                          to={to}
                                          outcomes={c.outcomes}
                                        />
                                      </div>
                                      <Link
                                        href={`/rep/${c.userId}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-2xs text-primary hover:underline shrink-0 hidden sm:inline"
                                      >
                                        Full profile &rarr;
                                      </Link>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </div>
          )}

          {/* ── OFFICE LEADERBOARD ── */}
          {tab === "offices" && (
            <div key="offices" className="animate-enter">
              <Section
                title="Office Leaderboard"
                subtitle="Click any office for detailed breakdown"
                noPadding
              >
                <div className="overflow-x-auto scrollable-table">
                  <table className="w-full min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30 text-2xs uppercase tracking-widest text-muted-foreground">
                        <th className="py-3 px-4 text-left font-medium w-8 sm:px-6">
                          #
                        </th>
                        <SortHeader
                          label="Office"
                          sortKey="name"
                          sort={officeSort}
                          onSort={(k) =>
                            handleSort(officeSort, setOfficeSort, k)
                          }
                          align="left"
                        />
                        <SortHeader
                          label="Closes"
                          sortKey="qbCloses"
                          sort={officeSort}
                          onSort={(k) =>
                            handleSort(officeSort, setOfficeSort, k)
                          }
                          tooltip="Verified closed deals"
                        />
                        <SortHeader
                          label="kW"
                          sortKey="kw"
                          sort={officeSort}
                          onSort={(k) =>
                            handleSort(officeSort, setOfficeSort, k)
                          }
                          tooltip="Total kilowatts sold"
                        />
                        <SortHeader
                          label="Appts"
                          sortKey="totalAppts"
                          sort={officeSort}
                          onSort={(k) =>
                            handleSort(officeSort, setOfficeSort, k)
                          }
                          tooltip="Appointments set"
                        />
                        <SortHeader
                          label="Sits"
                          sortKey="totalSits"
                          sort={officeSort}
                          onSort={(k) =>
                            handleSort(officeSort, setOfficeSort, k)
                          }
                          tooltip="Appointments sat"
                        />
                        <SortHeader
                          label="Sit %"
                          sortKey="sitRate"
                          sort={officeSort}
                          onSort={(k) =>
                            handleSort(officeSort, setOfficeSort, k)
                          }
                          tooltip="Sits / appointments"
                        />
                        <SortHeader
                          label="Close %"
                          sortKey="closeRate"
                          sort={officeSort}
                          onSort={(k) =>
                            handleSort(officeSort, setOfficeSort, k)
                          }
                          tooltip="Closes / sits"
                        />
                        <SortHeader
                          label="Wk Avg"
                          sortKey="weeklyAvg"
                          sort={officeSort}
                          onSort={(k) =>
                            handleSort(officeSort, setOfficeSort, k)
                          }
                          tooltip="Average closes per week"
                        />
                        <SortHeader
                          label="Cancel %"
                          sortKey="cancelPct"
                          sort={officeSort}
                          onSort={(k) =>
                            handleSort(officeSort, setOfficeSort, k)
                          }
                          tooltip="Cancelled / total closes"
                        />
                        <SortHeader
                          label="Setters"
                          sortKey="activeSetters"
                          sort={officeSort}
                          onSort={(k) =>
                            handleSort(officeSort, setOfficeSort, k)
                          }
                          tooltip="Active setters (DK > 0)"
                          align="center"
                        />
                        <SortHeader
                          label="Closers"
                          sortKey="activeClosers"
                          sort={officeSort}
                          onSort={(k) =>
                            handleSort(officeSort, setOfficeSort, k)
                          }
                          tooltip="Active closers (SAT >= 1)"
                          align="center"
                        />
                      </tr>
                    </thead>
                    <tbody className="text-[13px]">
                      {officeList.map((o, i) => {
                        const id = `office-${o.name}`;
                        const isExpanded = expanded.has(id);
                        return (
                          <Fragment key={o.name}>
                            <tr
                              className={`border-b border-border/60 transition-colors hover:bg-secondary/30 cursor-pointer ${o.qbCloses === 0 ? "opacity-40" : ""} ${isExpanded ? "bg-secondary/20" : ""}`}
                              onClick={() => toggleExpand(id)}
                            >
                              <td className="py-3 px-4 sm:px-6">
                                <span
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono ${
                                    i === 0
                                      ? "bg-primary/15 text-primary"
                                      : i < 3
                                        ? "bg-secondary text-foreground"
                                        : "text-muted-foreground/40"
                                  }`}
                                >
                                  {i + 1}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <ChevronRight
                                    className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90 text-muted-foreground" : "text-muted-foreground/30"}`}
                                  />
                                  <Link
                                    href={`/office/${encodeURIComponent(o.name)}`}
                                    onMouseEnter={() => prefetchOffice(o.name)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="group/link inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-primary"
                                  >
                                    {o.name}
                                    <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 transition-all group-hover/link:opacity-100 group-hover/link:translate-x-0 text-primary" />
                                  </Link>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-semibold font-mono tabular-nums text-primary">
                                {formatNumber(o.qbCloses)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                {formatKw(o.kw)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                {formatNumber(o.totalAppts)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                {formatNumber(o.totalSits)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {o.totalAppts > 0 ? (
                                  <StatusBadge
                                    value={Math.round(o.sitRate)}
                                    good={THRESHOLDS.sitRate.good}
                                    ok={THRESHOLDS.sitRate.ok}
                                  />
                                ) : (
                                  <span className="text-muted-foreground/25 font-mono">
                                    --
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {o.totalSits > 0 ? (
                                  <StatusBadge
                                    value={Math.round(o.closeRate)}
                                    good={THRESHOLDS.closeRatePerSit.good}
                                    ok={THRESHOLDS.closeRatePerSit.ok}
                                  />
                                ) : (
                                  <span className="text-muted-foreground/25 font-mono">
                                    --
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                {o.weeklyAvg > 0 ? o.weeklyAvg : "--"}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {o.cancelPct > 0 ? (
                                  <span
                                    className={`font-mono tabular-nums text-2xs font-semibold ${o.cancelPct > 30 ? "text-destructive" : o.cancelPct > 15 ? "text-warning" : "text-muted-foreground"}`}
                                  >
                                    {o.cancelPct}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/25 font-mono">
                                    --
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center font-mono tabular-nums text-muted-foreground">
                                {o.activeSetters}
                              </td>
                              <td className="py-3 px-3 text-center font-mono tabular-nums text-muted-foreground">
                                {o.activeClosers}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-secondary/10 border-b border-border/40">
                                <td colSpan={99} className="py-4 px-6 sm:px-12">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Top closers */}
                                    <div>
                                      <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                                        Top Closers
                                      </p>
                                      <div className="space-y-1.5">
                                        {o.closers
                                          .sort(
                                            (a: any, b: any) =>
                                              (b.qbCloses || 0) -
                                              (a.qbCloses || 0),
                                          )
                                          .slice(0, 3)
                                          .map((c: any) => (
                                            <div
                                              key={c.userId}
                                              className="flex items-center justify-between text-xs"
                                            >
                                              <Link
                                                href={`/rep/${c.userId}`}
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                                className="text-foreground hover:text-primary"
                                              >
                                                {c.name}
                                              </Link>
                                              <span className="font-mono tabular-nums text-primary font-semibold">
                                                {c.qbCloses || 0}
                                              </span>
                                            </div>
                                          ))}
                                        {o.closers.length === 0 && (
                                          <span className="text-2xs text-muted-foreground/40">
                                            No closers
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {/* Top setters */}
                                    <div>
                                      <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                                        Top Setters
                                      </p>
                                      <div className="space-y-1.5">
                                        {o.setters
                                          .sort(
                                            (a: any, b: any) =>
                                              (b.APPT || 0) - (a.APPT || 0),
                                          )
                                          .slice(0, 3)
                                          .map((s: any) => (
                                            <div
                                              key={s.userId}
                                              className="flex items-center justify-between text-xs"
                                            >
                                              <Link
                                                href={`/rep/${s.userId}`}
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                                className="text-foreground hover:text-primary"
                                              >
                                                {s.name}
                                                {s.isRecruit && (
                                                  <span className="ml-1 text-[10px] bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded">
                                                    R
                                                  </span>
                                                )}
                                              </Link>
                                              <span className="font-mono tabular-nums text-info font-semibold">
                                                {s.APPT || 0} appts
                                              </span>
                                            </div>
                                          ))}
                                        {o.setters.length === 0 && (
                                          <span className="text-2xs text-muted-foreground/40">
                                            No setters
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                                    <span className="text-2xs text-muted-foreground">
                                      {o.setters.length} setters,{" "}
                                      {o.closers.length} closers
                                    </span>
                                    <Link
                                      href={`/office/${encodeURIComponent(o.name)}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-2xs text-primary hover:underline"
                                    >
                                      Full office page &rarr;
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="text-[13px] font-semibold bg-secondary/20">
                        <td className="py-3 px-4 sm:px-6" />
                        <td className="py-3 px-3 text-muted-foreground">
                          Total
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-primary">
                          {formatNumber(data.summary.totalSales)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {formatKw(data.summary.totalKw)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {formatNumber(
                            officeList.reduce((s, o) => s + o.totalAppts, 0),
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {formatNumber(
                            officeList.reduce((s, o) => s + o.totalSits, 0),
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {data.summary.totalAppts > 0 && (
                            <StatusBadge
                              value={Math.round(
                                (data.summary.totalSits /
                                  data.summary.totalAppts) *
                                  100,
                              )}
                              good={THRESHOLDS.sitRate.good}
                              ok={THRESHOLDS.sitRate.ok}
                            />
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {data.summary.totalSits > 0 && (
                            <StatusBadge
                              value={companyCloseRate}
                              good={THRESHOLDS.closeRatePerSit.good}
                              ok={THRESHOLDS.closeRatePerSit.ok}
                            />
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {(() => {
                            const totalWkAvg = officeList.reduce(
                              (s, o) => s + o.weeklyAvg,
                              0,
                            );
                            return totalWkAvg > 0
                              ? totalWkAvg.toFixed(1)
                              : "--";
                          })()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {data.summary.cancelPct}%
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-muted-foreground">
                          {officeList.reduce((s, o) => s + o.activeSetters, 0)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-muted-foreground">
                          {officeList.reduce((s, o) => s + o.activeClosers, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
