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
import { DateFilter } from "@/components/DateFilter";
import { useDateRange } from "@/hooks/useDateRange";
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Star,
  FileText,
  Clock,
  Calendar,
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
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
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
              {/* Primary KPIs */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
                <MetricCard
                  label="Doors"
                  value={data.setterCoaching.doors}
                  tooltip="Total unique doors knocked"
                />
                <MetricCard
                  label="Pitches"
                  value={data.setterCoaching.qualifiedPitches}
                  color="blue"
                  subtitle={data.setterCoaching.doors > 0 ? `${data.setterCoaching.doorToQP}% of doors` : undefined}
                  tooltip="Qualified pitches — homeowner engaged"
                />
                <MetricCard
                  label="Appts Set"
                  value={data.setterCoaching.appointments}
                  color="blue"
                  subtitle={data.setterCoaching.doors > 0 ? `${data.setterCoaching.doorToAppt}% of doors` : undefined}
                  tooltip="Appointments set"
                />
                <MetricCard
                  label="Sits"
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
                <MetricCard
                  label="Sit %"
                  value={`${data.setterCoaching.sitRate}%`}
                  color={data.setterCoaching.sitRate >= 50 ? "green" : data.setterCoaching.sitRate >= 30 ? "yellow" : "red"}
                  tooltip="Appointments that sat / total set"
                />
                <MetricCard
                  label="Close %"
                  value={`${data.setterCoaching.closeRate}%`}
                  color={data.setterCoaching.closeRate >= 15 ? "green" : data.setterCoaching.closeRate >= 8 ? "yellow" : "red"}
                  tooltip="QB Closes / appointments set"
                />
                <MetricCard
                  label="Waste %"
                  value={`${data.setterCoaching.wasteRate}%`}
                  color={data.setterCoaching.wasteRate <= 15 ? "green" : data.setterCoaching.wasteRate <= 30 ? "yellow" : "red"}
                  tooltip="(No Shows + Cancels) / appointments set"
                />
              </div>

              {/* Accountability Breakdown */}
              <Section title="Appointment Outcomes" subtitle="Where appointments end up">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-primary/60">Sits</div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-primary">{data.setterCoaching.sits}</div>
                  </div>
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-destructive/60">No Shows</div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-destructive">{data.setterCoaching.noShows}</div>
                  </div>
                  <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-center">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-warning/60">Cancels</div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-warning">{data.setterCoaching.cancels}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground/60">Reschedules</div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-muted-foreground">{data.setterCoaching.reschedules}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/30 p-4 text-center">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground/60">Not Reached</div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-muted-foreground">{data.setterCoaching.notReached}</div>
                  </div>
                  <div className="rounded-xl border border-info/20 bg-info/5 p-4 text-center">
                    <div className="text-2xs font-semibold uppercase tracking-widest text-info/60">Pending</div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-info">{data.setterCoaching.pending}</div>
                  </div>
                  {data.setterCoaching.avgScheduleOutHours != null && (
                    <div className={`rounded-xl border p-4 text-center ${
                      data.setterCoaching.avgScheduleOutHours <= 48 
                        ? "border-primary/20 bg-primary/5" 
                        : data.setterCoaching.avgScheduleOutHours <= 72 
                          ? "border-warning/20 bg-warning/5" 
                          : "border-destructive/20 bg-destructive/5"
                    }`}>
                      <div className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground/60">Avg Sched Out</div>
                      <div className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
                        data.setterCoaching.avgScheduleOutHours <= 48 ? "text-primary" : data.setterCoaching.avgScheduleOutHours <= 72 ? "text-warning" : "text-destructive"
                      }`}>
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
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <MetricCard
                label="Leads"
                value={data.stats.LEAD || 0}
                tooltip="Assigned leads"
              />
              <MetricCard
                label="Sits"
                value={data.stats.SAT || 0}
                color="blue"
                tooltip="Appointments sat"
              />
              <MetricCard
                label="Closes"
                value={data.stats.CLOS || 0}
                color="green"
                tooltip="RepCard self-reported closes (not verified)"
              />
              <MetricCard
                label="Close %"
                value={`${data.stats.CLSE || 0}%`}
                color={
                  (data.stats.CLSE || 0) >= 35
                    ? "green"
                    : (data.stats.CLSE || 0) >= 25
                      ? "yellow"
                      : "red"
                }
                tooltip="Sit/Close %. Target: 35%+"
              />
              <MetricCard
                label="Credit Fails"
                value={data.stats.CF || 0}
                color="red"
                tooltip="Credit fails"
              />
              <MetricCard
                label="Follow Ups"
                value={data.stats.FUS || 0}
                tooltip="Follow ups scheduled"
              />
            </div>
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
                          data={Object.entries(data.dispositions)
                            .filter(([k]) => !["LEAD"].includes(k))
                            .map(([k, v]) => ({ name: k, value: v as number }))}
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
                    <Clock className="h-3.5 w-3.5" /> Within 48hrs
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
                        label: "3★ PB + 48hr",
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
                            Within 48hrs
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
                            Over 48hrs
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
                          % higher sit rate when set within 48hrs
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

          {/* Appointment History from Supabase */}
          {data.appointmentHistory && data.appointmentHistory.length > 0 && (
            <Section
              title="Appointment History"
              subtitle={`Last ${data.appointmentHistory.length} appointments from Supabase`}
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
                          {data.user.role === "setter"
                            ? a.closer_name || "-"
                            : a.setter_name || "-"}
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
