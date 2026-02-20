"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { Section } from "@/components/Section";
import { MetricCard } from "@/components/MetricCard";
import { CompactMetricCard } from "@/components/CompactMetricCard";
import { DateFilter } from "@/components/DateFilter";
import { useDateRange } from "@/hooks/useDateRange";
import { Breadcrumb } from "@/components/Breadcrumb";
import {
  Briefcase,
  MapPin,
  Star,
  FileText,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  formatDate,
  formatCurrency,
  formatKw,
  formatNumber,
} from "@/lib/format";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-primary/10 text-primary",
  "Pending Install": "bg-info/10 text-info",
  "Pending NTP": "bg-info/10 text-info",
  Installed: "bg-primary/10 text-primary",
  Cancelled: "bg-destructive/10 text-destructive",
  "Pending Cancel": "bg-warning/10 text-warning",
  "On Hold": "bg-warning/10 text-warning",
  NTP: "bg-info/10 text-info",
};

const PIE_COLORS = [
  "hsl(152, 56%, 40%)",
  "hsl(217, 91%, 60%)",
  "hsl(38, 92%, 50%)",
  "hsl(346, 77%, 50%)",
  "hsl(262, 83%, 58%)",
  "hsl(220, 9%, 46%)",
  "hsl(330, 76%, 58%)",
  "hsl(174, 72%, 50%)",
];

const C = {
  fg: "hsl(224, 71%, 4%)",
  card: "hsl(0, 0%, 100%)",
  border: "hsl(220, 13%, 87%)",
};

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-skeleton rounded-xl bg-secondary ${className}`} />
  );
}

function TrendArrow({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous === 0 && current === 0) return null;
  if (current > previous) {
    return (
      <span className="inline-flex items-center gap-0.5 text-2xs text-primary">
        <TrendingUp className="h-3 w-3" />
      </span>
    );
  }
  if (current < previous) {
    return (
      <span className="inline-flex items-center gap-0.5 text-2xs text-destructive">
        <TrendingDown className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-2xs text-muted-foreground">
      <Minus className="h-3 w-3" />
    </span>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const width = 48;
  const height = 16;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - (v / max) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className="inline-block ml-1">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      />
    </svg>
  );
}

export default function RepPage() {
  const params = useParams();
  const repId = params.id as string;
  const {
    preset,
    from,
    to,
    displayFrom,
    displayTo,
    setPreset,
    setCustomRange,
  } = useDateRange();
  const { data, error, isLoading } = useSWR(
    `/api/rep/${repId}?from=${from}&to=${to}`,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-4">
            <Breadcrumb
              segments={[
                { label: "Dashboard", href: "/" },
                ...(data?.user?.office
                  ? [
                      {
                        label: data.user.office.split(" - ")[0],
                        href: `/office/${encodeURIComponent(data.user.office)}`,
                      },
                    ]
                  : []),
                { label: data?.user?.name || "Rep" },
              ]}
            />
          </div>
          {data?.user && (
            <>
              <h1 className="flex items-center gap-3.5 text-2xl font-bold tracking-tight text-foreground">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-card-dark text-base font-bold text-card-dark-foreground">
                  {data.user.name.charAt(0)}
                </span>
                {data.user.name}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />{" "}
                  {data.user.role === "setter" ? "Setter" : "Closer"}
                </span>
                <Link
                  href={`/office/${encodeURIComponent(data.user.office)}`}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <MapPin className="h-3.5 w-3.5" /> {data.user.office}
                </Link>
                <span className="text-muted-foreground/50">
                  {data.user.region}
                </span>
              </div>
            </>
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {data && !isLoading && data.user && (
        <div className="animate-enter space-y-8">
          {data.user.role === "setter" && data.setterCoaching && (
            <>
              {/* Row 1 — funnel (big cards) */}
              <div className="grid grid-cols-3 gap-3">
                <MetricCard
                  label="Appts Set"
                  value={data.setterCoaching.appointments}
                  tooltip="Appointments set"
                />
                <MetricCard
                  label="Sat"
                  value={data.setterCoaching.sits}
                  color="blue"
                  tooltip="Appointments that sat"
                />
                <MetricCard
                  label="QB Closes"
                  value={data.setterCoaching.qbCloses}
                  color="green"
                  tooltip="Verified closes from QuickBase"
                />
              </div>

              {/* Row 2 — compact combo cards */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <CompactMetricCard
                  title="Conversion"
                  tooltip="Appointment conversion rates"
                  rows={[
                    {
                      label: "Sit %",
                      value: `${data.setterCoaching.sitRate}%`,
                      color:
                        data.setterCoaching.sitRate >= 50
                          ? "green"
                          : data.setterCoaching.sitRate >= 30
                            ? "yellow"
                            : "red",
                    },
                    {
                      label: "Close %",
                      value: `${data.setterCoaching.closeRate}%`,
                      color:
                        data.setterCoaching.closeRate >= 15
                          ? "green"
                          : data.setterCoaching.closeRate >= 8
                            ? "yellow"
                            : "red",
                    },
                  ]}
                />
                <CompactMetricCard
                  title="Quality"
                  tooltip="Appointment quality indicators"
                  rows={[
                    ...(data.qualityStats
                      ? [
                          {
                            label: "PB %",
                            value: `${Math.round((data.qualityStats.withPowerBill / data.qualityStats.total) * 100)}%`,
                            color: (Math.round(
                              (data.qualityStats.withPowerBill /
                                data.qualityStats.total) *
                                100,
                            ) >= 80
                              ? "green"
                              : Math.round(
                                    (data.qualityStats.withPowerBill /
                                      data.qualityStats.total) *
                                      100,
                                  ) >= 50
                                ? "yellow"
                                : "red") as "green" | "yellow" | "red",
                          },
                        ]
                      : [{ label: "PB %", value: "—" }]),
                    ...(data.setterCoaching.avgScheduleOutHours != null
                      ? [
                          {
                            label: "Sched Out",
                            value:
                              data.setterCoaching.avgScheduleOutHours < 48
                                ? `${Math.round(data.setterCoaching.avgScheduleOutHours)}h`
                                : `${(data.setterCoaching.avgScheduleOutHours / 24).toFixed(1)}d`,
                            color: (data.setterCoaching.avgScheduleOutHours <=
                            48
                              ? "green"
                              : data.setterCoaching.avgScheduleOutHours <= 72
                                ? "yellow"
                                : "red") as "green" | "yellow" | "red",
                          },
                        ]
                      : [{ label: "Sched Out", value: "—" }]),
                  ]}
                />
                <CompactMetricCard
                  title="Field Time"
                  tooltip="Average knocking hours, start and end times"
                  rows={[
                    {
                      label: "Qty Hrs",
                      value: data.setterCoaching.qualityHours ?? "—",
                    },
                    {
                      label: "Start",
                      value: data.setterCoaching.firstDoorKnock ?? "—",
                    },
                    {
                      label: "End",
                      value: data.setterCoaching.lastDoorKnock ?? "—",
                    },
                  ]}
                />
              </div>

              {/* Weekly Trend */}
              {data.weeklyTrend && data.weeklyTrend.length >= 2 && (
                <Section title="Weekly Trend" subtitle="Last 4 weeks">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30 text-2xs uppercase tracking-widest text-muted-foreground">
                          <th className="py-2.5 px-4 text-left font-medium">
                            Week
                          </th>
                          <th className="py-2.5 px-3 text-right font-medium">
                            DK
                          </th>
                          <th className="py-2.5 px-3 text-right font-medium">
                            APPT
                          </th>
                          <th className="py-2.5 px-3 text-right font-medium">
                            SITS
                          </th>
                          <th className="py-2.5 px-3 text-right font-medium">
                            CLOS
                          </th>
                        </tr>
                      </thead>
                      <tbody className="text-[13px]">
                        {data.weeklyTrend.map((w: any, i: number) => {
                          const prev = i > 0 ? data.weeklyTrend[i - 1] : null;
                          return (
                            <tr
                              key={w.week}
                              className="border-b border-border/60 transition-colors hover:bg-secondary/30"
                            >
                              <td className="py-3 px-4 text-xs font-medium text-foreground">
                                {w.week}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums">
                                <span className="text-foreground">{w.DK}</span>
                                {prev && (
                                  <TrendArrow
                                    current={w.DK}
                                    previous={prev.DK}
                                  />
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums">
                                <span className="text-foreground">
                                  {w.APPT}
                                </span>
                                {prev && (
                                  <TrendArrow
                                    current={w.APPT}
                                    previous={prev.APPT}
                                  />
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums">
                                <span className="text-foreground">
                                  {w.SITS}
                                </span>
                                {prev && (
                                  <TrendArrow
                                    current={w.SITS}
                                    previous={prev.SITS}
                                  />
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums">
                                <span className="font-semibold text-primary">
                                  {w.CLOS}
                                </span>
                                {prev && (
                                  <TrendArrow
                                    current={w.CLOS}
                                    previous={prev.CLOS}
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-2xs text-muted-foreground">
                      APPT trend:
                    </span>
                    <MiniSparkline
                      values={data.weeklyTrend.map((w: any) => w.APPT)}
                    />
                    <span className="text-2xs text-muted-foreground ml-3">
                      CLOS trend:
                    </span>
                    <MiniSparkline
                      values={data.weeklyTrend.map((w: any) => w.CLOS)}
                    />
                  </div>
                </Section>
              )}

              {/* Accountability Breakdown */}
              <Section
                title="Appointment Outcomes"
                subtitle="Where appointments end up"
              >
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-primary/60">
                      Sits
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-primary">
                      {data.setterCoaching.sits}
                    </div>
                  </div>
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-destructive/60">
                      No Shows
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-destructive">
                      {data.setterCoaching.noShows}
                    </div>
                  </div>
                  <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-center">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-warning/60">
                      Cancels
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-warning">
                      {data.setterCoaching.cancels}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                      Reschedules
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-muted-foreground">
                      {data.setterCoaching.reschedules}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                      Not Reached
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-muted-foreground">
                      {data.setterCoaching.notReached}
                    </div>
                  </div>
                  <div className="rounded-xl border border-info/20 bg-info/5 p-4 text-center">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-info/60">
                      Pending
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-info">
                      {data.setterCoaching.pending}
                    </div>
                  </div>
                  {data.setterCoaching.avgScheduleOutHours != null && (
                    <div
                      className={`rounded-xl border p-4 text-center ${
                        data.setterCoaching.avgScheduleOutHours <= 48
                          ? "border-primary/20 bg-primary/5"
                          : data.setterCoaching.avgScheduleOutHours <= 72
                            ? "border-warning/20 bg-warning/5"
                            : "border-destructive/20 bg-destructive/5"
                      }`}
                    >
                      <div className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                        Avg Sched Out
                      </div>
                      <div
                        className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
                          data.setterCoaching.avgScheduleOutHours <= 48
                            ? "text-primary"
                            : data.setterCoaching.avgScheduleOutHours <= 72
                              ? "text-warning"
                              : "text-destructive"
                        }`}
                      >
                        {data.setterCoaching.avgScheduleOutHours < 48
                          ? `${Math.round(data.setterCoaching.avgScheduleOutHours)}h`
                          : `${(data.setterCoaching.avgScheduleOutHours / 24).toFixed(1)}d`}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            </>
          )}

          {data.user.role === "closer" && data.stats && (
            <>
              {/* Row 1 — funnel (big cards) */}
              <div className="grid grid-cols-3 gap-3">
                <MetricCard
                  label="Assigned"
                  value={data.stats.LEAD || 0}
                  tooltip="Leads assigned from setters"
                />
                <MetricCard
                  label="Sat"
                  value={data.stats.SAT || 0}
                  color="blue"
                  tooltip="Appointments sat"
                />
                <MetricCard
                  label="QB Closes"
                  value={data.closerQBStats?.totalDeals || 0}
                  color="green"
                  tooltip="Verified closes from QuickBase"
                />
              </div>

              {/* Row 2 — compact combo cards */}
              <div className="grid grid-cols-2 gap-3">
                {(() => {
                  const sat = data.stats.SAT || 0;
                  const qbCloses = data.closerQBStats?.totalDeals || 0;
                  const closeRate =
                    sat > 0 ? Math.round((qbCloses / sat) * 1000) / 10 : 0;
                  return (
                    <CompactMetricCard
                      title="Close %"
                      tooltip="QB Closes / Appointments Sat"
                      rows={[
                        {
                          label: "Rate",
                          value: `${closeRate}%`,
                          color:
                            closeRate >= 35
                              ? "green"
                              : closeRate >= 25
                                ? "yellow"
                                : "red",
                        },
                      ]}
                    />
                  );
                })()}
                {(() => {
                  const cancels = data.closerQBStats?.cancelled || 0;
                  const cancelPct = data.closerQBStats?.cancelPct || 0;
                  return (
                    <CompactMetricCard
                      title="Cancels"
                      tooltip="Cancelled deals from QuickBase"
                      rows={[
                        {
                          label: "Count",
                          value: cancels,
                          color: cancels > 0 ? "red" : "green",
                        },
                        {
                          label: "Rate",
                          value: `${cancelPct}%`,
                          color:
                            cancelPct <= 10
                              ? "green"
                              : cancelPct <= 20
                                ? "yellow"
                                : "red",
                        },
                      ]}
                    />
                  );
                })()}
              </div>
            </>
          )}

          {/* Closer Weekly Trend */}
          {data.user.role === "closer" &&
            data.weeklyTrend &&
            data.weeklyTrend.length >= 2 && (
              <Section title="Weekly Trend" subtitle="Last 4 weeks">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30 text-2xs uppercase tracking-widest text-muted-foreground">
                        <th className="py-2.5 px-4 text-left font-medium">
                          Week
                        </th>
                        <th className="py-2.5 px-3 text-right font-medium">
                          LEAD
                        </th>
                        <th className="py-2.5 px-3 text-right font-medium">
                          SAT
                        </th>
                        <th className="py-2.5 px-3 text-right font-medium">
                          CLOS
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-[13px]">
                      {data.weeklyTrend.map((w: any, i: number) => {
                        const prev = i > 0 ? data.weeklyTrend[i - 1] : null;
                        return (
                          <tr
                            key={w.week}
                            className="border-b border-border/60 transition-colors hover:bg-secondary/30"
                          >
                            <td className="py-3 px-4 text-xs font-medium text-foreground">
                              {w.week}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              <span className="text-foreground">{w.LEAD}</span>
                              {prev && (
                                <TrendArrow
                                  current={w.LEAD}
                                  previous={prev.LEAD}
                                />
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              <span className="text-foreground">{w.SAT}</span>
                              {prev && (
                                <TrendArrow
                                  current={w.SAT}
                                  previous={prev.SAT}
                                />
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              <span className="font-semibold text-primary">
                                {w.CLOS}
                              </span>
                              {prev && (
                                <TrendArrow
                                  current={w.CLOS}
                                  previous={prev.CLOS}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-2xs text-muted-foreground">
                    SAT trend:
                  </span>
                  <MiniSparkline
                    values={data.weeklyTrend.map((w: any) => w.SAT)}
                  />
                  <span className="text-2xs text-muted-foreground ml-3">
                    CLOS trend:
                  </span>
                  <MiniSparkline
                    values={data.weeklyTrend.map((w: any) => w.CLOS)}
                  />
                </div>
              </Section>
            )}

          {data.user.role === "closer" &&
            Object.keys(data.dispositions).length > 0 && (
              <Section
                title="Dispositions"
                subtitle="How appointments resolved"
              >
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(data.dispositions).map(
                            ([k, v]) => ({ name: k, value: v as number }),
                          )}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {Object.entries(data.dispositions).map(([,], i) => (
                            <Cell
                              key={i}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <RTooltip
                          contentStyle={{
                            background: C.card,
                            border: `1px solid ${C.border}`,
                            borderRadius: 8,
                            color: C.fg,
                            fontSize: 12,
                            fontFamily: "var(--font-jetbrains)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col justify-center gap-1.5">
                    {Object.entries(data.dispositions)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([key, val], i) => (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-2.5 transition-colors hover:bg-secondary/70"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  PIE_COLORS[i % PIE_COLORS.length],
                              }}
                            />
                            <span className="text-[13px] text-foreground/80">
                              {key}
                            </span>
                          </div>
                          <span className="text-sm font-semibold font-mono tabular-nums text-foreground">
                            {val as number}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </Section>
            )}

          {/* Closer QB Stats */}
          {data.user.role === "closer" && data.closerQBStats && (
            <Section title="QB Performance" subtitle="QuickBase verified stats">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricCard
                  label="Total Deals"
                  value={formatNumber(data.closerQBStats.totalDeals)}
                  color="green"
                  tooltip="Verified closed deals as closer"
                />
                <MetricCard
                  label="Total kW"
                  value={formatKw(data.closerQBStats.totalKw)}
                  color="blue"
                  tooltip="Total kilowatts sold"
                />
                <MetricCard
                  label="Avg System"
                  value={`${formatKw(data.closerQBStats.avgSystemSize)} kW`}
                  tooltip="Average system size per deal"
                />
                <MetricCard
                  label="Avg PPW"
                  value={formatCurrency(data.closerQBStats.avgPpw)}
                  tooltip="Average net price per watt"
                />
              </div>
            </Section>
          )}

          {/* Quality Stats */}
          {data.qualityStats && data.qualityStats.total > 0 && (
            <Section
              title="Appointment Quality"
              subtitle={`${data.qualityStats.total} appointment${data.qualityStats.total !== 1 ? "s" : ""} tracked`}
            >
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Star className="h-3.5 w-3.5" /> Avg Stars
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-2xl font-bold font-mono tabular-nums text-foreground">
                      {data.qualityStats.avgStars.toFixed(1)}
                    </span>
                    <span className="text-warning text-lg">&#9733;</span>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" /> Power Bills
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold font-mono tabular-nums text-foreground">
                      {data.qualityStats.withPowerBill}
                    </span>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      / {data.qualityStats.total} (
                      {Math.round(
                        (data.qualityStats.withPowerBill /
                          data.qualityStats.total) *
                          100,
                      )}
                      %)
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Within 2 days
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold font-mono tabular-nums text-foreground">
                      {data.qualityStats.within48hrs}
                    </span>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      / {data.qualityStats.total} (
                      {Math.round(
                        (data.qualityStats.within48hrs /
                          data.qualityStats.total) *
                          100,
                      )}
                      %)
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <div className="text-xs text-muted-foreground">
                    Star Breakdown
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {[
                      {
                        label: "3★ PB + ≤2d",
                        count: data.qualityStats.threeStarCount,
                        color: "text-primary",
                      },
                      {
                        label: "2★ PB only",
                        count: data.qualityStats.twoStarCount,
                        color: "text-warning",
                      },
                      {
                        label: "1★ No PB",
                        count: data.qualityStats.oneStarCount,
                        color: "text-destructive",
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-muted-foreground">{s.label}</span>
                        <span
                          className={`font-mono tabular-nums font-semibold ${s.color}`}
                        >
                          {s.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          )}

          {data.user.role === "setter" && data.qualityInsights && (
            <Section
              title="Quality Insights"
              subtitle="How appointment quality impacts sit rates"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Power Bill Impact */}
                {data.qualityInsights.sitRate_withPB !== null &&
                  data.qualityInsights.sitRate_withoutPB !== null && (
                    <div className="rounded-xl border border-border bg-secondary/30 p-5">
                      <h4 className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Power Bill Impact
                      </h4>
                      <div className="mt-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground">
                            With PB
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold font-mono tabular-nums text-primary">
                              {data.qualityInsights.sitRate_withPB}%
                            </span>
                            <span className="text-2xs text-muted-foreground">
                              ({data.qualityInsights.n_withPB} appts)
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground">
                            Without PB
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold font-mono tabular-nums text-destructive">
                              {data.qualityInsights.sitRate_withoutPB}%
                            </span>
                            <span className="text-2xs text-muted-foreground">
                              ({data.qualityInsights.n_withoutPB} appts)
                            </span>
                          </div>
                        </div>
                      </div>
                      {data.qualityInsights.sitRate_withPB >
                        data.qualityInsights.sitRate_withoutPB && (
                        <div className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary font-medium">
                          +
                          {(
                            data.qualityInsights.sitRate_withPB -
                            data.qualityInsights.sitRate_withoutPB
                          ).toFixed(0)}
                          % higher sit rate with power bill
                        </div>
                      )}
                    </div>
                  )}

                {/* Scheduling Speed Impact */}
                {data.qualityInsights.sitRate_within48 !== null &&
                  data.qualityInsights.sitRate_over48 !== null && (
                    <div className="rounded-xl border border-border bg-secondary/30 p-5">
                      <h4 className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Scheduling Speed
                      </h4>
                      <div className="mt-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground">
                            Within 2 days
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold font-mono tabular-nums text-primary">
                              {data.qualityInsights.sitRate_within48}%
                            </span>
                            <span className="text-2xs text-muted-foreground">
                              ({data.qualityInsights.n_within48} appts)
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground">
                            Over 2 days
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold font-mono tabular-nums text-destructive">
                              {data.qualityInsights.sitRate_over48}%
                            </span>
                            <span className="text-2xs text-muted-foreground">
                              ({data.qualityInsights.n_over48} appts)
                            </span>
                          </div>
                        </div>
                      </div>
                      {data.qualityInsights.sitRate_within48 >
                        data.qualityInsights.sitRate_over48 && (
                        <div className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary font-medium">
                          +
                          {(
                            data.qualityInsights.sitRate_within48 -
                            data.qualityInsights.sitRate_over48
                          ).toFixed(0)}
                          % higher sit rate when set within 2 days
                        </div>
                      )}
                    </div>
                  )}

                {/* Star Rating Impact */}
                {(data.qualityInsights.sitRate_3star !== null ||
                  data.qualityInsights.sitRate_2star !== null ||
                  data.qualityInsights.sitRate_1star !== null) && (
                  <div className="rounded-xl border border-border bg-secondary/30 p-5">
                    <h4 className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Star Rating Impact
                    </h4>
                    <div className="mt-4 space-y-2.5">
                      {data.qualityInsights.sitRate_3star !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-primary">3★</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold font-mono tabular-nums text-primary">
                              {data.qualityInsights.sitRate_3star}%
                            </span>
                            <span className="text-2xs text-muted-foreground">
                              ({data.qualityInsights.n_3star} appts)
                            </span>
                          </div>
                        </div>
                      )}
                      {data.qualityInsights.sitRate_2star !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-warning">2★</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold font-mono tabular-nums text-warning">
                              {data.qualityInsights.sitRate_2star}%
                            </span>
                            <span className="text-2xs text-muted-foreground">
                              ({data.qualityInsights.n_2star} appts)
                            </span>
                          </div>
                        </div>
                      )}
                      {data.qualityInsights.sitRate_1star !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-destructive">1★</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold font-mono tabular-nums text-destructive">
                              {data.qualityInsights.sitRate_1star}%
                            </span>
                            <span className="text-2xs text-muted-foreground">
                              ({data.qualityInsights.n_1star} appts)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {data.sales && data.sales.length > 0 && (
            <Section
              title="QuickBase Sales"
              subtitle={`${data.sales.length} deal${data.sales.length !== 1 ? "s" : ""}`}
              noPadding
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-2xs uppercase tracking-widest text-muted-foreground">
                      <th className="py-3 px-6 text-left font-medium">Date</th>
                      <th className="py-3 px-3 text-left font-medium">
                        Customer
                      </th>
                      <th className="py-3 px-3 text-left font-medium">
                        Office
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        System (kW)
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        Net PPW
                      </th>
                      <th className="py-3 px-3 text-left font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {data.sales.map((s: any, i: number) => (
                      <tr
                        key={i}
                        className="border-b border-border/60 transition-colors hover:bg-secondary/30"
                      >
                        <td className="py-3.5 px-6 font-mono tabular-nums text-xs text-foreground whitespace-nowrap">
                          {formatDate(s.saleDate)}
                        </td>
                        <td className="py-3.5 px-3 text-foreground max-w-[200px] truncate">
                          {s.customerName || "-"}
                        </td>
                        <td className="py-3.5 px-3 text-muted-foreground">
                          {s.salesOffice}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-foreground">
                          {formatKw(s.systemSizeKw)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-foreground">
                          {formatCurrency(s.netPpw)}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`rounded-md px-2 py-0.5 text-2xs font-medium ${STATUS_COLORS[s.status] || "bg-secondary text-muted-foreground"}`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {data.appointmentHistory && data.appointmentHistory.length > 0 && (
            <Section
              title="Appointment History"
              subtitle={`Last ${data.appointmentHistory.length} appointments`}
              noPadding
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-2xs uppercase tracking-widest text-muted-foreground">
                      <th className="py-3 px-6 text-left font-medium">Date</th>
                      <th className="py-3 px-3 text-left font-medium">
                        Contact
                      </th>
                      <th className="py-3 px-3 text-left font-medium">
                        Address
                      </th>
                      <th className="py-3 px-3 text-left font-medium">
                        Disposition
                      </th>
                      <th className="py-3 px-3 text-center font-medium">
                        Power Bill
                      </th>
                      <th className="py-3 px-3 text-center font-medium">
                        Stars
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        Lead Time
                      </th>
                      <th className="py-3 px-3 text-left font-medium">
                        {data.user.role === "setter" ? "Closer" : "Setter"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {data.appointmentHistory.map((a: any) => (
                      <tr
                        key={a.id}
                        className="border-b border-border/60 transition-colors hover:bg-secondary/30"
                      >
                        <td className="py-3.5 px-6 font-mono tabular-nums text-xs text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {a.appointment_time
                              ? new Date(a.appointment_time).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                  },
                                )
                              : "-"}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-foreground">
                          {a.contact_name || "-"}
                        </td>
                        <td className="py-3.5 px-3 text-muted-foreground max-w-[200px] truncate">
                          {a.contact_address || "-"}
                        </td>
                        <td className="py-3.5 px-3">
                          {a.disposition ? (
                            <span
                              className={`rounded-md px-2 py-0.5 text-2xs font-medium ${
                                a.disposition_category === "closed"
                                  ? "bg-primary/10 text-primary"
                                  : a.disposition_category === "no_show"
                                    ? "bg-destructive/10 text-destructive"
                                    : a.disposition_category === "canceled"
                                      ? "bg-warning/10 text-warning"
                                      : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {a.disposition}
                            </span>
                          ) : (
                            <span className="rounded-md bg-info/10 px-2 py-0.5 text-2xs font-medium text-info">
                              Scheduled
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {a.has_power_bill ? (
                            <span className="text-primary">&#10003;</span>
                          ) : (
                            <span className="text-muted-foreground/25">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums text-xs">
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
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs text-muted-foreground">
                          {a.hours_to_appointment &&
                          a.hours_to_appointment > 0 ? (
                            a.hours_to_appointment < 24 ? (
                              `${Math.round(a.hours_to_appointment)}h`
                            ) : (
                              `${Math.round(a.hours_to_appointment / 24)}d`
                            )
                          ) : (
                            <span className="text-muted-foreground/25">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-muted-foreground">
                          {data.user.role === "setter" ? (
                            a.closer_id ? (
                              <Link
                                href={`/rep/${a.closer_id}`}
                                className="transition-colors hover:text-primary"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {a.closer_name || "-"}
                              </Link>
                            ) : (
                              a.closer_name || "-"
                            )
                          ) : a.setter_id ? (
                            <Link
                              href={`/rep/${a.setter_id}`}
                              className="transition-colors hover:text-primary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {a.setter_name || "-"}
                            </Link>
                          ) : (
                            a.setter_name || "-"
                          )}
                        </td>
                      </tr>
                    ))}
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
