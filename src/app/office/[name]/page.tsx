"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Section } from "@/components/Section";
import { MetricCard } from "@/components/MetricCard";
import { DateFilter } from "@/components/DateFilter";
import { useDateRange } from "@/hooks/useDateRange";
import { FunnelChart } from "@/components/FunnelChart";
import { StatusBadge } from "@/components/StatusBadge";
import { Tooltip } from "@/components/Tooltip";
import { ArrowLeft, Target, Users } from "lucide-react";
import { formatNumber, formatKw, formatCurrency } from "@/lib/format";

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
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <MetricCard
              label="Deals"
              value={formatNumber(data.summary.deals)}
              color="green"
              icon={<Target className="h-5 w-5" />}
              tooltip="Verified closed deals from QuickBase"
            />
            <MetricCard
              label="kW Sold"
              value={formatKw(data.summary.kw)}
              color="blue"
              tooltip="Total kilowatts sold"
            />
            <MetricCard
              label="Avg PPW"
              value={formatCurrency(data.summary.avgPpw)}
              tooltip="Average net price per watt"
            />
            <MetricCard
              label="Active Setters"
              value={data.activeSetters || 0}
              icon={<Users className="h-5 w-5" />}
              tooltip="Unique reps with door knocks in this period"
            />
            <MetricCard
              label="Active Closers"
              value={data.activeClosers || 0}
              icon={<Users className="h-5 w-5" />}
              tooltip="Unique closers with appointments in this period"
            />
          </div>

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
            {data.setters.length === 0 ? (
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
                          Set <Tooltip text="Appointments set via RepCard" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          No Show{" "}
                          <Tooltip text="Closer didn't meet homeowner — appointment wasted" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Cancel{" "}
                          <Tooltip text="Appointment cancelled before the sit" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Pending{" "}
                          <Tooltip text="APPT - (Sits + No Show + Cancel)" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Sits{" "}
                          <Tooltip text="Appointments that sat (from RepCard Setter LB)" />
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
                          Sit%{" "}
                          <Tooltip text="Green: >50%, Yellow: 30-50%, Red: <30%" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Close%{" "}
                          <Tooltip text="Green: >15%, Yellow: 8-15%, Red: <8%" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Waste% <Tooltip text="(No Shows + Cancels) / Appts" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Quality{" "}
                          <Tooltip text="3★ = power bill + within 2 days, 2★ = power bill only, 1★ = no power bill" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          PB{" "}
                          <Tooltip text="Appointments with power bill attached" />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {data.setters
                      .sort((a: any, b: any) => (b.APPT || 0) - (a.APPT || 0))
                      .map((s: any, i: number) => {
                        const pending = Math.max(
                          0,
                          (s.APPT || 0) -
                            ((s.SITS || 0) + (s.nosh || 0) + (s.canc || 0)),
                        );
                        return (
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
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-destructive">
                              {s.nosh || 0}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-warning">
                              {s.canc || 0}
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              {pending > 0 ? (
                                <span className="inline-flex items-center rounded-md bg-info/10 px-1.5 py-0.5 text-2xs font-semibold font-mono tabular-nums leading-none text-info">
                                  {pending}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/25 font-mono">
                                  0
                                </span>
                              )}
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
                              {(s.APPT || 0) > 0 ? (
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
                              {(s.APPT || 0) > 0 ? (
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
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                              {(s.powerBillCount || 0) > 0 ? (
                                <span className="text-foreground">
                                  {s.powerBillCount}
                                  <span className="text-2xs text-muted-foreground/50 ml-0.5">
                                    /{s.APPT || 0}
                                  </span>
                                </span>
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

          <Section
            title="Closers"
            subtitle="Verified closes vs RepCard claims"
            noPadding
          >
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
                          Leads <Tooltip text="Assigned leads from RepCard" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Sat <Tooltip text="Appointments this closer sat on" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Closes <Tooltip text="Verified from QuickBase" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          RC Claims <Tooltip text="RepCard self-reported" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Sit/Close%{" "}
                          <Tooltip text="Closes / Sits. Target: 35%+" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          CF{" "}
                          <Tooltip text="Credit Fail — homeowner didn't qualify" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          No Close{" "}
                          <Tooltip text="Sat but didn't close the deal" />
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          Follow Up{" "}
                          <Tooltip text="Follow-up scheduled for later" />
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
                        const sitClose =
                          (c.SAT || 0) > 0
                            ? ((c.qbCloses || 0) / c.SAT) * 100
                            : 0;
                        const gap = (c.CLOS || 0) - (c.qbCloses || 0);
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
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-foreground">
                              {c.qbCloses || 0}
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <span
                                className={`font-mono tabular-nums ${gap > 0 ? "font-semibold text-warning" : "text-muted-foreground"}`}
                              >
                                {c.CLOS || 0}
                                {gap > 0 && (
                                  <span className="ml-1 text-2xs text-destructive">
                                    +{gap}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              {sitClose > 0 ? (
                                <StatusBadge
                                  value={Math.round(sitClose)}
                                  good={35}
                                  ok={25}
                                />
                              ) : (
                                <span className="text-muted-foreground/25 font-mono">
                                  --
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-destructive">
                              {c.CF || 0}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-warning">
                              {c.NOCL || 0}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                              {c.FUS || 0}
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
                                good={50}
                                ok={30}
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
