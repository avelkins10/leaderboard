"use client";

import useSWR from "swr";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Cell,
} from "recharts";
import { Section } from "@/components/Section";
import { DateFilter } from "@/components/DateFilter";
import { useDateRange } from "@/hooks/useDateRange";
import { Tooltip } from "@/components/Tooltip";
import { StatusBadge } from "@/components/StatusBadge";

const C = {
  axis: "hsl(220, 9%, 46%)",
  fg: "hsl(224, 71%, 4%)",
  card: "hsl(0, 0%, 100%)",
  border: "hsl(220, 13%, 87%)",
};

function wasteColor(v: number) {
  if (v >= 30) return "bg-destructive/10 text-destructive";
  if (v >= 15) return "bg-warning/10 text-warning";
  return "bg-primary/10 text-primary";
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-skeleton rounded-xl bg-secondary ${className}`} />
  );
}

export default function QualityPage() {
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
    `/api/scorecard?from=${from}&to=${to}`,
  );
  const { data: pipelineData } = useSWR<{
    total: number;
    statuses: { status: string; count: number }[];
  }>(`/api/pipeline?from=${from}&to=${to}`);

  const setterAccountability = (() => {
    if (!data) return [];
    const setterLB = data.setterLeaderboard || [];
    const setterAppt = data.setterAppointments || [];
    const salesBySetter = data.salesBySetter || {};
    const apptMap: Record<number, any> = {};
    for (const sa of setterAppt) apptMap[sa.userId] = sa;

    return setterLB
      .filter((s: any) => (s.APPT || 0) > 0 || (s.DK || 0) > 0)
      .map((s: any) => {
        const ad = apptMap[s.userId] || {};
        const appt = s.APPT || 0;
        const sits = s.SITS || 0;
        const nosh = ad.NOSH || 0;
        const canc = ad.CANC || 0;
        const qbCloses = salesBySetter[s.name]?.deals || 0;
        const sitRate = appt > 0 ? Math.min((sits / appt) * 100, 100) : 0;
        const closeRate = appt > 0 ? Math.min((qbCloses / appt) * 100, 100) : 0;
        const wasteRate =
          appt > 0 ? Math.min(((nosh + canc) / appt) * 100, 100) : 0;
        return {
          ...s,
          appt,
          sits,
          nosh,
          canc,
          qbCloses,
          sitRate,
          closeRate,
          wasteRate,
        };
      })
      .sort((a: any, b: any) => b.wasteRate - a.wasteRate);
  })();

  const officeQuality = data
    ? Object.entries(data.offices)
        .map(([name, d]: [string, any]) => {
          const totalAppts =
            d.setters?.reduce((s: number, r: any) => s + (r.APPT || 0), 0) || 0;
          const totalSits =
            d.closers?.reduce((s: number, r: any) => s + (r.SAT || 0), 0) || 0;
          const sitRate =
            totalAppts > 0 ? Math.min((totalSits / totalAppts) * 100, 100) : 0;
          return {
            name: name.split(" - ")[0],
            fullName: name,
            totalAppts,
            totalSits,
            sitRate,
          };
        })
        .sort((a, b) => b.sitRate - a.sitRate)
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Setter accountability & appointment quality
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

      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-96" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {data && !isLoading && (
        <div className="animate-enter space-y-8">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-5">
              <h3 className="text-2xs font-semibold uppercase tracking-widest text-primary">
                Quality Appointment
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Power bill collected AND set within 2 days. These sit{" "}
                <span className="font-medium text-foreground">
                  2-3x more often
                </span>
                .
              </p>
            </div>
            <div className="rounded-xl border border-info/15 bg-info/[0.04] p-5">
              <h3 className="text-2xs font-semibold uppercase tracking-widest text-info">
                Why Waste Rate Matters
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {"No-shows and cancels waste closer time. "}
                <span className="font-medium text-destructive">
                  {"> 30% waste"}
                </span>
                {" needs coaching."}
              </p>
            </div>
            <div className="rounded-xl border border-warning/15 bg-warning/[0.04] p-5">
              <h3 className="text-2xs font-semibold uppercase tracking-widest text-warning">
                Target Benchmarks
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-primary">{"Sit: 50%+"}</span>
                {" \u00B7 "}
                <span className="font-medium text-primary">
                  {"Close: 15%+"}
                </span>
                {" \u00B7 "}
                <span className="font-medium text-primary">
                  {"Waste: <15%"}
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-5">
              <h3 className="text-2xs font-semibold uppercase tracking-widest text-foreground">
                Star Rating System
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-primary">3★</span> = Power
                bill + set within 2 days.{" "}
                <span className="font-medium text-warning">2★</span> = Power
                bill only.{" "}
                <span className="font-medium text-destructive">1★</span> = No
                power bill. Higher stars = higher sit rates.
              </p>
            </div>
          </div>

          <Section
            title="Office Sit Rate"
            subtitle="Appointment to Sit conversion by office"
          >
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={officeQuality}
                  layout="vertical"
                  margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                >
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{
                      fill: C.axis,
                      fontSize: 10,
                      fontFamily: "var(--font-jetbrains)",
                    }}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{
                      fill: C.fg,
                      fontSize: 11,
                      fontFamily: "var(--font-inter)",
                    }}
                    width={95}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RTooltip
                    cursor={{ fill: "hsl(220, 14%, 94%)" }}
                    contentStyle={{
                      background: C.card,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      color: C.fg,
                      fontSize: 12,
                      fontFamily: "var(--font-jetbrains)",
                    }}
                    formatter={(v: any) => [
                      `${Number(v).toFixed(1)}%`,
                      "Sit Rate",
                    ]}
                  />
                  <Bar dataKey="sitRate" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {officeQuality.map((o, i) => (
                      <Cell
                        key={i}
                        fill={
                          o.sitRate >= 50
                            ? "hsl(152, 56%, 40%)"
                            : o.sitRate >= 30
                              ? "hsl(38, 92%, 50%)"
                              : "hsl(346, 77%, 50%)"
                        }
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center gap-5 text-2xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />{" "}
                {"50%+ Great"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-warning" />{" "}
                {"30-49% Watch"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-destructive" />{" "}
                {"<30% Concern"}
              </span>
            </div>
          </Section>

          <Section
            title="Setter Accountability"
            subtitle="Sorted by waste rate (worst first)"
            noPadding
          >
            {setterAccountability.length === 0 ? (
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
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
                      <th className="py-3 px-3 text-left font-medium">
                        Office
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Set <Tooltip text="Appointments set via RepCard" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          No Show{" "}
                          <Tooltip text="Closer didn't meet homeowner" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Cancel <Tooltip text="Appointment cancelled" />
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
                          Sit% <Tooltip text="Sits / Appointments Set" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Close% <Tooltip text="Closes / Appointments Set" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Waste% <Tooltip text="(No Shows + Cancels) / Appts" />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {setterAccountability.map((s: any, i: number) => (
                      <tr
                        key={s.userId}
                        className="border-b border-border/60 transition-colors hover:bg-secondary/30"
                      >
                        <td className="py-3.5 px-6 text-muted-foreground/40 font-mono text-xs">
                          {i + 1}
                        </td>
                        <td className="py-3.5 px-3 font-medium text-foreground">
                          {s.name}
                        </td>
                        <td className="py-3.5 px-3 text-xs text-muted-foreground">
                          {s.qbOffice?.split(" - ")[0] || s.team}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-foreground">
                          {s.appt}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-destructive">
                          {s.nosh}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-warning">
                          {s.canc}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {s.sits}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-primary">
                          {s.qbCloses}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          {s.appt > 0 ? (
                            <StatusBadge
                              value={Math.round(s.sitRate)}
                              good={50}
                              ok={30}
                            />
                          ) : (
                            <span className="text-muted-foreground/25 font-mono">
                              --
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          {s.appt > 0 ? (
                            <StatusBadge
                              value={Math.round(s.closeRate)}
                              good={15}
                              ok={8}
                            />
                          ) : (
                            <span className="text-muted-foreground/25 font-mono">
                              --
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          {s.appt > 0 ? (
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-2xs font-semibold font-mono leading-none ${wasteColor(Math.round(s.wasteRate))}`}
                            >
                              {Math.round(s.wasteRate)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground/25 font-mono">
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

          {/* Lead Pipeline */}
          {pipelineData && pipelineData.statuses.length > 0 && (
            <Section
              title="Lead Pipeline"
              subtitle={`${pipelineData.total.toLocaleString()} status changes in period`}
            >
              <div className="space-y-2">
                {pipelineData.statuses.slice(0, 12).map((s) => {
                  const pct =
                    pipelineData.total > 0
                      ? (s.count / pipelineData.total) * 100
                      : 0;
                  return (
                    <div key={s.status} className="flex items-center gap-3">
                      <div className="w-40 truncate text-[13px] text-foreground shrink-0">
                        {s.status}
                      </div>
                      <div className="flex-1 h-6 bg-secondary/50 rounded-md overflow-hidden">
                        <div
                          className={`h-full rounded-md transition-all ${
                            s.status === "Appointment Scheduled"
                              ? "bg-primary/70"
                              : s.status.includes("Not Interested")
                                ? "bg-destructive/50"
                                : s.status.includes("Not Home")
                                  ? "bg-secondary"
                                  : s.status.includes("Come Back")
                                    ? "bg-info/50"
                                    : s.status.includes("DQ")
                                      ? "bg-warning/50"
                                      : "bg-muted-foreground/20"
                          }`}
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <div className="w-20 text-right font-mono tabular-nums text-xs text-muted-foreground shrink-0">
                        {s.count.toLocaleString()}
                        <span className="text-2xs text-muted-foreground/50 ml-1">
                          ({pct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
