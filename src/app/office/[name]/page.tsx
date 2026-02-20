"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Section } from "@/components/Section";
import { MetricCard } from "@/components/MetricCard";
import { CompactMetricCard } from "@/components/CompactMetricCard";
import { DateFilter } from "@/components/DateFilter";
import { useDateRange } from "@/hooks/useDateRange";
import { FunnelChart } from "@/components/FunnelChart";
import { StatusBadge } from "@/components/StatusBadge";
import { Tooltip } from "@/components/Tooltip";
import { THRESHOLDS } from "@/lib/thresholds";
import { Target, Users, Zap, Clock } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { formatNumber, formatKw, formatCurrency } from "@/lib/format";

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-skeleton rounded-xl bg-secondary ${className}`} />
  );
}

const DISPOSITION_CARDS: {
  key: string;
  label: string;
  color: string;
  tip?: string;
}[] = [
  {
    key: "closed",
    label: "Closed",
    color: "bg-primary/10 text-primary border-primary/20",
    tip: "Deal closed — closer converted",
  },
  {
    key: "closer_fault",
    label: "No Close",
    color: "bg-warning/10 text-warning border-warning/20",
    tip: "Closer sat but didn't close (No Close, 1-Legger, Follow Up)",
  },
  {
    key: "setter_fault",
    label: "Bad Lead",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    tip: "Setter accountability — Credit Fail or Shade",
  },
  {
    key: "no_show",
    label: "No Show",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    tip: "Closer didn't meet homeowner — appointment wasted",
  },
  {
    key: "canceled",
    label: "Cancelled",
    color: "bg-secondary text-muted-foreground border-border",
    tip: "Appointment cancelled before the sit",
  },
  {
    key: "rescheduled",
    label: "Rescheduled",
    color: "bg-secondary text-muted-foreground border-border",
  },
  {
    key: "scheduled",
    label: "Scheduled",
    color: "bg-info/10 text-info border-info/20",
    tip: "Pending — no disposition yet",
  },
  {
    key: "other",
    label: "Other",
    color: "bg-secondary text-muted-foreground border-border",
  },
];

export default function OfficePage() {
  const params = useParams();
  const officeName = decodeURIComponent(params.name as string);
  const {
    preset,
    from,
    to,
    displayFrom,
    displayTo,
    setPreset,
    setCustomRange,
  } = useDateRange("today");
  const { data, error, isLoading } = useSWR(
    `/api/office/${encodeURIComponent(officeName)}?from=${from}&to=${to}`,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-4">
            <Breadcrumb
              segments={[
                { label: "Dashboard", href: "/" },
                { label: officeName },
              ]}
            />
          </div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-foreground">
            {officeName}
            {data && (
              <span className="inline-flex items-center gap-2.5 text-2xs font-semibold">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 ${
                    (data.activeSetters || 0) > 0
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${(data.activeSetters || 0) > 0 ? "bg-primary" : "bg-muted-foreground"}`}
                  />
                  {data.activeSetters || 0} setters
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 ${
                    (data.activeClosers || 0) > 0
                      ? "bg-info/10 text-info"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${(data.activeClosers || 0) > 0 ? "bg-info" : "bg-muted-foreground"}`}
                  />
                  {data.activeClosers || 0} closers
                </span>
              </span>
            )}
          </h1>
          {data && (
            <p className="mt-1 text-sm text-muted-foreground">{data.region}</p>
          )}
        </div>
        <DateFilter
          preset={preset}
          displayFrom={displayFrom}
          displayTo={displayTo}
          onPreset={setPreset}
          onCustomRange={setCustomRange}
        />
      </div>

      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {data && !isLoading && (
        <div className="animate-enter space-y-8">
          {/* ── Setter Summary ── */}
          <Section title="Setter Summary">
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                label="Appts Set"
                value={formatNumber(data.setterSummary.totalAppts)}
                icon={<Target className="h-5 w-5" />}
                tooltip="Total appointments set by all setters"
              />
              <MetricCard
                label="Sat"
                value={formatNumber(data.setterSummary.totalSits)}
                tooltip="Appointments that sat (from RepCard)"
              />
              <MetricCard
                label="QB Closes"
                value={formatNumber(data.setterSummary.totalQBCloses)}
                color="green"
                tooltip="Verified closes from QuickBase attributed to setters"
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <CompactMetricCard
                title="Conversion"
                tooltip="Set/Sit = Sits / Appts, Sit/Close = QB Closes / Sits"
                rows={[
                  {
                    label: "Set/Sit %",
                    value: `${data.setterSummary.setSitPct}%`,
                    color:
                      data.setterSummary.setSitPct >= THRESHOLDS.sitRate.good
                        ? "green"
                        : data.setterSummary.setSitPct >= THRESHOLDS.sitRate.ok
                          ? "yellow"
                          : "red",
                  },
                  {
                    label: "Sit/Close %",
                    value: `${data.setterSummary.sitClosePct}%`,
                    color:
                      data.setterSummary.sitClosePct >=
                      THRESHOLDS.closeRatePerSit.good
                        ? "green"
                        : data.setterSummary.sitClosePct >=
                            THRESHOLDS.closeRatePerSit.ok
                          ? "yellow"
                          : "red",
                  },
                ]}
              />
              <CompactMetricCard
                title="Quality"
                tooltip="PB% = Power bills / Appts, Stars = avg star rating"
                rows={[
                  {
                    label: "PB %",
                    value: `${data.setterSummary.pbPct}%`,
                    color:
                      data.setterSummary.pbPct >= 80
                        ? "green"
                        : data.setterSummary.pbPct >= 50
                          ? "yellow"
                          : "red",
                  },
                  {
                    label: "Avg Stars",
                    value:
                      data.setterSummary.avgStars > 0
                        ? `${data.setterSummary.avgStars.toFixed(1)} \u2605`
                        : "--",
                  },
                ]}
              />
              <CompactMetricCard
                title={`Field Time${data.timezone ? ` (${data.timezone})` : ""}`}
                tooltip="Average hours per day, first and last knock from door knocks"
                rows={[
                  {
                    label: "Hours",
                    value:
                      data.setterSummary.avgFieldHours != null
                        ? `${data.setterSummary.avgFieldHours}h`
                        : "--",
                  },
                  {
                    label: "First Knock",
                    value: data.setterSummary.avgFieldStart || "--",
                  },
                  {
                    label: "Last Knock",
                    value: data.setterSummary.avgFieldEnd || "--",
                  },
                ]}
              />
            </div>
          </Section>

          {/* ── Closer Summary ── */}
          <Section title="Closer Summary">
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                label="Assigned"
                value={formatNumber(data.closerSummary.totalAssigned)}
                icon={<Users className="h-5 w-5" />}
                tooltip="Total leads assigned to closers"
              />
              <MetricCard
                label="Sat"
                value={formatNumber(data.closerSummary.totalSat)}
                tooltip="Appointments this office's closers sat"
              />
              <MetricCard
                label="QB Closes"
                value={formatNumber(data.closerSummary.totalQBCloses)}
                color="green"
                tooltip="Verified closes from QuickBase"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <CompactMetricCard
                title="Close %"
                tooltip="QB Closes / Sits"
                rows={[
                  {
                    label: "Sit/Close %",
                    value: `${data.closerSummary.closePct}%`,
                    color:
                      data.closerSummary.closePct >=
                      THRESHOLDS.closeRatePerSit.good
                        ? "green"
                        : data.closerSummary.closePct >=
                            THRESHOLDS.closeRatePerSit.ok
                          ? "yellow"
                          : "red",
                  },
                ]}
              />
              <CompactMetricCard
                title="Cancels"
                tooltip="Cancelled deals from QuickBase"
                rows={[
                  {
                    label: "Cancelled",
                    value: formatNumber(data.closerSummary.totalCancelled),
                    color:
                      data.closerSummary.cancelPct > 30 ? "red" : "default",
                  },
                  {
                    label: "Cancel %",
                    value: `${data.closerSummary.cancelPct}%`,
                    color:
                      data.closerSummary.cancelPct <= THRESHOLDS.cancelRate.good
                        ? "green"
                        : data.closerSummary.cancelPct <=
                            THRESHOLDS.cancelRate.ok
                          ? "yellow"
                          : "red",
                  },
                ]}
              />
            </div>
          </Section>

          {/* Secondary KPIs row: Installs + Speed-to-Close */}
          {((data.installs != null && data.installs > 0) ||
            (data.speedToClose && data.speedToClose.count > 0)) && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {data.installs != null && data.installs > 0 && (
                <MetricCard
                  label="Installs"
                  value={formatNumber(data.installs)}
                  color="green"
                  icon={<Zap className="h-5 w-5" />}
                  subtitle={
                    data.installsKw > 0
                      ? `${formatKw(data.installsKw)} kW`
                      : undefined
                  }
                  tooltip="Completed installs from QuickBase"
                />
              )}
              {data.speedToClose && data.speedToClose.count > 0 && (
                <MetricCard
                  label="Speed to Close"
                  value={`${data.speedToClose.avgDays}d`}
                  color={
                    data.speedToClose.avgDays <= 7
                      ? "green"
                      : data.speedToClose.avgDays <= 14
                        ? "yellow"
                        : "red"
                  }
                  icon={<Clock className="h-5 w-5" />}
                  subtitle={`${data.speedToClose.count} matched deals`}
                  tooltip="Average days from lead creation to QB sale date"
                />
              )}
            </div>
          )}

          <Section title="Sales Funnel" subtitle="Doors to Closes">
            <FunnelChart
              steps={[
                {
                  label: "Doors Knocked",
                  value: data.funnel.doors,
                  color: "hsl(220, 9%, 46%)",
                },
                {
                  label: "Appointments",
                  value: data.funnel.appointments,
                  color: "hsl(217, 91%, 60%)",
                },
                {
                  label: "Sits",
                  value: data.funnel.sits,
                  color: "hsl(262, 83%, 58%)",
                },
                {
                  label: "Closes",
                  value: data.funnel.qbCloses,
                  color: "hsl(152, 56%, 40%)",
                },
              ]}
            />
            {data.funnel.rcClaims > data.funnel.qbCloses && (
              <div className="mt-5 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3 text-[13px] text-warning">
                {"RC Claims ("}
                {data.funnel.rcClaims}
                {") exceed Closes ("}
                {data.funnel.qbCloses}
                {") -- gap of "}
                {data.funnel.rcClaims - data.funnel.qbCloses}
              </div>
            )}

            {/* Disposition Breakdown Cards */}
            {data.funnel.breakdown && data.funnel.breakdown.total > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {DISPOSITION_CARDS.map(({ key, label, color, tip }) => {
                  const count = data.funnel.breakdown[key] || 0;
                  if (count === 0) return null;
                  return (
                    <div
                      key={key}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 ${color}`}
                    >
                      <span className="text-lg font-bold font-mono tabular-nums">
                        {count}
                      </span>
                      <span className="text-2xs font-semibold uppercase tracking-wider">
                        {label}
                      </span>
                      {tip && <Tooltip text={tip} />}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Setter Accountability" noPadding>
            {data.setters.filter((s: any) => (s.DK || 0) > 0).length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-20">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10 text-muted-foreground/20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  No activity yet this period
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Check back later or change the date range
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-2xs uppercase tracking-widest text-muted-foreground">
                      <th className="py-3 px-6 text-left font-medium w-8">#</th>
                      <th className="py-3 px-3 text-left font-medium">
                        Setter
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Appts <Tooltip text="Appointments set via RepCard" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Sits <Tooltip text="Appointments that sat" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Closes{" "}
                          <Tooltip text="Verified closes from QuickBase" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Set/Sit% <Tooltip text="Sits / Appts" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Sit/Close% <Tooltip text="QB Closes / Sits" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          PB% <Tooltip text="Power bill %" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Stars{" "}
                          <Tooltip text="3★ = power bill + within 2 days, 2★ = power bill only, 1★ = no power bill" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Hrs <Tooltip text="Avg hours per day on the doors" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Start <Tooltip text="Avg first door knock time" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          End <Tooltip text="Avg last door knock time" />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {data.setters
                      .filter((s: any) => (s.DK || 0) > 0)
                      .sort((a: any, b: any) => (b.APPT || 0) - (a.APPT || 0))
                      .map((s: any, i: number) => (
                        <tr
                          key={s.userId}
                          className="border-b border-border/60 transition-colors hover:bg-secondary/30"
                        >
                          <td className="py-3.5 px-6 text-muted-foreground/40 font-mono text-xs">
                            {i + 1}
                          </td>
                          <td className="py-3.5 px-3">
                            <Link
                              href={`/rep/${s.userId}`}
                              className="font-medium text-foreground transition-colors hover:text-primary"
                            >
                              {s.name}
                            </Link>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-foreground">
                            {s.APPT || 0}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                            {s.SITS || 0}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-primary">
                            {s.qbCloses || 0}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {(s.APPT || 0) > 0 ? (
                              <StatusBadge
                                value={Math.round(s.sitRate)}
                                good={THRESHOLDS.sitRate.good}
                                ok={THRESHOLDS.sitRate.ok}
                              />
                            ) : (
                              <span className="text-muted-foreground/25 font-mono">
                                --
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {(s.SITS || 0) > 0 ? (
                              <StatusBadge
                                value={Math.round(s.sitCloseRate)}
                                good={THRESHOLDS.closeRatePerSit.good}
                                ok={THRESHOLDS.closeRatePerSit.ok}
                              />
                            ) : (
                              <span className="text-muted-foreground/25 font-mono">
                                --
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            {(s.pbPct || 0) > 0 ? (
                              <span className="text-foreground">
                                {s.pbPct}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground/25">
                                --
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {(s.avgStars || 0) > 0 ? (
                              <span className="inline-flex items-center gap-0.5 font-mono tabular-nums text-xs text-foreground">
                                {s.avgStars.toFixed(1)}{" "}
                                <span className="text-warning">&#9733;</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground/25 font-mono">
                                --
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                            {s.fieldHours != null ? (
                              `${s.fieldHours}h`
                            ) : (
                              <span className="text-muted-foreground/25">
                                --
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums text-muted-foreground text-xs">
                            {s.fieldStart || (
                              <span className="text-muted-foreground/25">
                                --
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums text-muted-foreground text-xs">
                            {s.fieldEnd || (
                              <span className="text-muted-foreground/25">
                                --
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Closers" noPadding>
            {data.closers.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-20">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10 text-muted-foreground/20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  No activity yet this period
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Check back later or change the date range
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-2xs uppercase tracking-widest text-muted-foreground">
                      <th className="py-3 px-6 text-left font-medium w-8">#</th>
                      <th className="py-3 px-3 text-left font-medium">
                        Closer
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Assigned{" "}
                          <Tooltip text="Leads assigned from RepCard" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Sat <Tooltip text="Appointments this closer sat on" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium hidden lg:table-cell">
                        <Tooltip text="Closed from sits"><span className="text-primary/70">CLS</span></Tooltip>
                      </th>
                      <th className="py-3 px-3 text-right font-medium hidden lg:table-cell">
                        <Tooltip text="No Close"><span className="text-warning/70">NC</span></Tooltip>
                      </th>
                      <th className="py-3 px-3 text-right font-medium hidden lg:table-cell">
                        <Tooltip text="Credit Fail"><span className="text-muted-foreground/70">CF</span></Tooltip>
                      </th>
                      <th className="py-3 px-3 text-right font-medium hidden lg:table-cell">
                        <Tooltip text="Follow Up"><span className="text-info/70">FU</span></Tooltip>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Closes <Tooltip text="Verified from QuickBase" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Close% <Tooltip text="QB Closes / Sits" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Cancel% <Tooltip text="Cancelled / Total QB deals" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          kW <Tooltip text="Total kilowatts sold" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          PPW <Tooltip text="Average price per watt" />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {data.closers
                      .sort(
                        (a: any, b: any) =>
                          (b.qbCloses || 0) - (a.qbCloses || 0),
                      )
                      .map((c: any, i: number) => {
                        const closePct =
                          (c.SAT || 0) > 0
                            ? Math.round(((c.qbCloses || 0) / c.SAT) * 100)
                            : 0;
                        return (
                          <tr
                            key={c.userId}
                            className="border-b border-border/60 transition-colors hover:bg-secondary/30"
                          >
                            <td className="py-3.5 px-6 text-muted-foreground/40 font-mono text-xs">
                              {i + 1}
                            </td>
                            <td className="py-3.5 px-3">
                              <Link
                                href={`/rep/${c.userId}`}
                                className="font-medium text-foreground transition-colors hover:text-primary"
                              >
                                {c.name}
                              </Link>
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                              {c.LEAD || 0}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                              {c.SAT || 0}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-primary/70 hidden lg:table-cell">
                              {c.CLOS || 0}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-warning/70 hidden lg:table-cell">
                              {c.outcomes?.NOCL || 0}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-muted-foreground/70 hidden lg:table-cell">
                              {c.outcomes?.CF || 0}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-info/70 hidden lg:table-cell">
                              {c.outcomes?.FUS || 0}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-primary">
                              {c.qbCloses || 0}
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              {closePct > 0 ? (
                                <StatusBadge
                                  value={closePct}
                                  good={THRESHOLDS.closeRatePerSit.good}
                                  ok={THRESHOLDS.closeRatePerSit.ok}
                                />
                              ) : (
                                <span className="text-muted-foreground/25 font-mono">
                                  --
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                              {(c.cancelPct || 0) > 0 ? (
                                <span
                                  className={
                                    c.cancelPct > 30
                                      ? "text-destructive"
                                      : c.cancelPct > 15
                                        ? "text-warning"
                                        : "text-muted-foreground"
                                  }
                                >
                                  {c.cancelPct}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground/25">
                                  --
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-foreground">
                              {(c.totalKw || 0) > 0 ? (
                                formatKw(c.totalKw)
                              ) : (
                                <span className="text-muted-foreground/25">
                                  --
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-foreground">
                              {(c.avgPpw || 0) > 0 ? (
                                formatCurrency(c.avgPpw)
                              ) : (
                                <span className="text-muted-foreground/25">
                                  --
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Setter-Closer Partnerships */}
          {data.partnerships && data.partnerships.length > 0 && (
            <Section
              title="Setter-Closer Partnerships"
              subtitle="Appointment volume and outcomes by pairing"
              noPadding
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-2xs uppercase tracking-widest text-muted-foreground">
                      <th className="py-3 px-6 text-left font-medium">
                        Setter
                      </th>
                      <th className="py-3 px-3 text-left font-medium">
                        Closer
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Appts{" "}
                          <Tooltip text="Total appointments for this setter-closer pair" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Sat <Tooltip text="Appointments that sat" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Closed{" "}
                          <Tooltip text="Appointments dispositioned as Closed (RepCard, not verified)" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Sit% <Tooltip text="Sat / Total Appointments" />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {data.partnerships.slice(0, 15).map((p: any, i: number) => {
                      const sitRate =
                        p.total_appts > 0 ? (p.sat / p.total_appts) * 100 : 0;
                      return (
                        <tr
                          key={i}
                          className="border-b border-border/60 transition-colors hover:bg-secondary/30"
                        >
                          <td className="py-3.5 px-6">
                            <Link
                              href={`/rep/${p.setter_id}`}
                              className="font-medium text-foreground transition-colors hover:text-primary"
                            >
                              {p.setter_name}
                            </Link>
                          </td>
                          <td className="py-3.5 px-3">
                            <Link
                              href={`/rep/${p.closer_id}`}
                              className="font-medium text-foreground transition-colors hover:text-primary"
                            >
                              {p.closer_name}
                            </Link>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-foreground">
                            {p.total_appts}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                            {p.sat}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-primary">
                            {p.closed}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {p.total_appts > 0 ? (
                              <StatusBadge
                                value={Math.round(sitRate)}
                                good={THRESHOLDS.sitRate.good}
                                ok={THRESHOLDS.sitRate.ok}
                              />
                            ) : (
                              <span className="text-muted-foreground/25 font-mono">
                                --
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
