'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Cell } from 'recharts';
import { MetricCard } from '@/components/MetricCard';
import { Section } from '@/components/Section';
import { WeekPicker, useWeekDates } from '@/components/WeekPicker';
import { Tooltip } from '@/components/Tooltip';
import { StatusBadge } from '@/components/StatusBadge';
import { Target, Zap, ArrowRight } from 'lucide-react';

const CHART_COLORS = {
  bar: 'hsl(160, 84%, 39%)',
  barMuted: 'hsl(0, 0%, 24%)',
  axis: 'hsl(0, 0%, 50%)',
  fg: 'hsl(0, 0%, 93%)',
  tooltipBg: 'hsl(0, 0%, 7%)',
  tooltipBorder: 'hsl(0, 0%, 13%)',
};

interface ScorecardData {
  period: { from: string; to: string };
  summary: { totalSales: number; totalKw: number; avgSystemSize: number; avgPpw: number };
  offices: Record<string, any>;
  setterLeaderboard: any[];
  closerLeaderboard: any[];
  setterAppointments: any[];
  salesByOffice: Record<string, any>;
  salesByCloser: Record<string, any>;
  salesBySetter: Record<string, any>;
  activeRepsByOffice: Record<string, number>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[88px] animate-pulse-subtle rounded-lg border border-border bg-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2 h-[320px] animate-pulse-subtle rounded-lg border border-border bg-card" />
        <div className="lg:col-span-3 h-[320px] animate-pulse-subtle rounded-lg border border-border bg-card" />
      </div>
      <div className="h-[400px] animate-pulse-subtle rounded-lg border border-border bg-card" />
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const { from, to } = useWeekDates(weekOffset);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/scorecard?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  const officeEntries = data ? Object.entries(data.offices).sort(([, a]: any, [, b]: any) => (b.sales?.deals || 0) - (a.sales?.deals || 0)) : [];
  const chartData = officeEntries.map(([name, d]: [string, any]) => ({
    name: name.split(' - ')[0],
    deals: d.sales?.deals || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground">Company-wide performance overview</p>
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && <LoadingSkeleton />}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Deals" value={data.summary.totalSales} color="green"
              icon={<Target className="h-4 w-4" />} tooltip="Total closed deals from QuickBase" />
            <MetricCard label="Kilowatts" value={`${data.summary.totalKw.toFixed(1)}`} color="blue"
              icon={<Zap className="h-4 w-4" />} tooltip="Total kW sold across all offices" />
            <MetricCard label="Avg System" value={`${data.summary.avgSystemSize.toFixed(1)} kW`}
              tooltip="Average system size per deal" />
            <MetricCard label="Net PPW" value={`$${data.summary.avgPpw.toFixed(2)}`}
              tooltip="Average net price per watt" />
          </div>

          {/* Chart + Leaderboard Row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* Deals by Office */}
            <div className="lg:col-span-2">
              <Section title="Deals by Office">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 4 }}>
                      <XAxis type="number" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: CHART_COLORS.fg, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} width={95} axisLine={false} tickLine={false} />
                      <RTooltip
                        cursor={{ fill: 'hsl(0, 0%, 10%)' }}
                        contentStyle={{ background: CHART_COLORS.tooltipBg, border: `1px solid ${CHART_COLORS.tooltipBorder}`, borderRadius: 8, color: CHART_COLORS.fg, fontSize: 12, fontFamily: 'var(--font-geist-mono)' }}
                      />
                      <Bar dataKey="deals" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.deals > 0 ? CHART_COLORS.bar : CHART_COLORS.barMuted} fillOpacity={i === 0 ? 1 : 0.6 + (0.4 * (1 - i / chartData.length))} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>

            {/* Top Closers */}
            <div className="lg:col-span-3">
              <Section title="Top Closers" subtitle="Ranked by QB-verified closes" noPadding>
                <div className="divide-y divide-border">
                  {data.closerLeaderboard
                    .filter(c => (c.SAT || 0) > 0 || (c.qbCloses || 0) > 0)
                    .sort((a, b) => (b.qbCloses || 0) - (a.qbCloses || 0))
                    .slice(0, 8)
                    .map((c, i) => {
                      const sitClose = (c.SAT || 0) > 0 ? ((c.qbCloses || 0) / c.SAT) * 100 : 0;
                      return (
                        <Link key={c.userId} href={`/rep/${c.userId}`}
                          className="group flex items-center justify-between px-5 py-2.5 transition-default hover:bg-secondary/50">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                              i < 3 ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                            }`}>{i + 1}</span>
                            <div>
                              <span className="text-[13px] font-medium text-foreground transition-default group-hover:text-primary">{c.name}</span>
                              <span className="ml-2 text-[11px] text-muted-foreground/60 hidden sm:inline">{c.qbOffice?.split(' - ')[0]}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[12px]">
                            <span className="text-muted-foreground font-mono">{c.SAT || 0} sits</span>
                            <span className="font-semibold font-mono text-primary">{c.qbCloses || 0}</span>
                            {(c.CLOS || 0) > (c.qbCloses || 0) && (
                              <span className="text-[11px] text-warning font-mono">({c.CLOS} claimed)</span>
                            )}
                            {sitClose > 0 && <StatusBadge value={Math.round(sitClose)} good={35} ok={25} />}
                          </div>
                        </Link>
                      );
                    })}
                </div>
              </Section>
            </div>
          </div>

          {/* Office Scorecard */}
          <Section title="Office Scorecard" subtitle="Click any office for detailed breakdown" noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-5 text-left font-medium">Office</th>
                    <th className="py-3 px-3 text-center font-medium">Active</th>
                    <th className="py-3 px-3 text-right font-medium">
                      <span className="inline-flex items-center gap-1">QB Deals <Tooltip text="Verified closed deals from QuickBase" /></span>
                    </th>
                    <th className="py-3 px-3 text-right font-medium">kW</th>
                    <th className="py-3 px-3 text-right font-medium">Doors</th>
                    <th className="py-3 px-3 text-right font-medium">Appts</th>
                    <th className="py-3 px-3 text-right font-medium">Sits</th>
                    <th className="py-3 px-3 text-right font-medium">
                      <span className="inline-flex items-center gap-1">RC Claims <Tooltip text="RepCard self-reported closes" /></span>
                    </th>
                    <th className="py-3 px-3 text-right font-medium">
                      <span className="inline-flex items-center gap-1">Sit/Close <Tooltip text="QB Closes / Sits. Target: 35%+" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {officeEntries.map(([office, d]: [string, any]) => {
                    const totalDoors = d.setters?.reduce((s: number, r: any) => s + (r.DK || 0), 0) || 0;
                    const totalAppts = d.setters?.reduce((s: number, r: any) => s + (r.APPT || 0), 0) || 0;
                    const totalSits = d.closers?.reduce((s: number, r: any) => s + (r.SAT || 0), 0) || 0;
                    const rcClaims = d.closers?.reduce((s: number, r: any) => s + (r.CLOS || 0), 0) || 0;
                    const qbCloses = d.sales?.deals || 0;
                    const sitClose = totalSits > 0 ? (qbCloses / totalSits) * 100 : 0;
                    const activeReps = d.activeReps || 0;
                    return (
                      <tr key={office} className={`border-b border-border/50 transition-default hover:bg-secondary/30 ${qbCloses === 0 ? 'opacity-40' : ''}`}>
                        <td className="py-3 px-5">
                          <Link href={`/office/${encodeURIComponent(office)}`} className="group/link inline-flex items-center gap-1.5 font-medium text-foreground transition-default hover:text-primary">
                            {office}
                            <ArrowRight className="h-3 w-3 text-muted-foreground/30 opacity-0 transition-default group-hover/link:opacity-100 group-hover/link:text-primary" />
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                            activeReps > 0 ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground/60'
                          }`}>{activeReps}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold font-mono text-primary">{qbCloses}</td>
                        <td className="py-3 px-3 text-right font-mono text-foreground/70">{(d.sales?.kw || 0).toFixed(1)}</td>
                        <td className="py-3 px-3 text-right font-mono text-muted-foreground">{totalDoors}</td>
                        <td className="py-3 px-3 text-right font-mono text-muted-foreground">{totalAppts}</td>
                        <td className="py-3 px-3 text-right font-mono text-muted-foreground">{totalSits}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-mono ${rcClaims > qbCloses ? 'font-semibold text-warning' : 'text-muted-foreground'}`}>
                            {rcClaims}
                            {rcClaims > qbCloses && <span className="ml-1 text-[11px] text-destructive">+{rcClaims - qbCloses}</span>}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {totalSits > 0 ? <StatusBadge value={Math.round(sitClose)} good={35} ok={25} /> : <span className="text-muted-foreground/30">--</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-3 px-5 text-muted-foreground">Total</td>
                    <td className="py-3 px-3 text-center font-mono text-muted-foreground">
                      {officeEntries.reduce((s, [, d]) => s + (d.activeReps || 0), 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-primary">{data.summary.totalSales}</td>
                    <td className="py-3 px-3 text-right font-mono text-foreground/70">{data.summary.totalKw.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right font-mono text-muted-foreground">{officeEntries.reduce((s, [, d]) => s + (d.setters?.reduce((a: number, r: any) => a + (r.DK || 0), 0) || 0), 0)}</td>
                    <td className="py-3 px-3 text-right font-mono text-muted-foreground">{officeEntries.reduce((s, [, d]) => s + (d.setters?.reduce((a: number, r: any) => a + (r.APPT || 0), 0) || 0), 0)}</td>
                    <td className="py-3 px-3 text-right font-mono text-muted-foreground">{officeEntries.reduce((s, [, d]) => s + (d.closers?.reduce((a: number, r: any) => a + (r.SAT || 0), 0) || 0), 0)}</td>
                    <td className="py-3 px-3 text-right font-mono text-muted-foreground">{officeEntries.reduce((s, [, d]) => s + (d.closers?.reduce((a: number, r: any) => a + (r.CLOS || 0), 0) || 0), 0)}</td>
                    <td className="py-3 px-3 text-right text-muted-foreground/30">--</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>

          {/* Bottom: Setters + Sales Grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Section title="Top Setters" subtitle="By appointments set" noPadding>
              <div className="divide-y divide-border">
                {data.setterLeaderboard
                  .filter(s => (s.DK || 0) > 0 || (s.APPT || 0) > 0)
                  .sort((a, b) => (b.APPT || 0) - (a.APPT || 0) || (b.DK || 0) - (a.DK || 0))
                  .slice(0, 8)
                  .map((s, i) => (
                    <Link key={s.userId} href={`/rep/${s.userId}`}
                      className="group flex items-center justify-between px-5 py-2.5 transition-default hover:bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                          i < 3 ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                        }`}>{i + 1}</span>
                        <div>
                          <span className="text-[13px] font-medium text-foreground transition-default group-hover:text-primary">{s.name}</span>
                          <span className="ml-2 text-[11px] text-muted-foreground/60 hidden sm:inline">{s.qbOffice?.split(' - ')[0]}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[12px] font-mono">
                        <span className="text-muted-foreground">{s.DK || 0} doors</span>
                        <span className="font-semibold text-primary">{s.APPT || 0} appts</span>
                        <span className="text-info">{s.SITS || 0} sits</span>
                      </div>
                    </Link>
                  ))}
              </div>
            </Section>

            <Section title="QB Sales by Closer" subtitle="QuickBase verified deals">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(data.salesByCloser)
                  .sort(([, a]: any, [, b]: any) => b.deals - a.deals)
                  .slice(0, 8)
                  .map(([name, d]: [string, any]) => (
                    <div key={name} className="rounded-lg border border-border bg-secondary/30 p-3 transition-default hover:bg-secondary/60">
                      <div className="truncate text-[13px] font-medium text-foreground">{name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{d.office}</div>
                      <div className="mt-2 flex items-center gap-2 font-mono text-[12px]">
                        <span className="font-semibold text-primary">{d.deals} deals</span>
                        <span className="text-muted-foreground">{d.kw.toFixed(1)} kW</span>
                      </div>
                    </div>
                  ))}
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
