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

/* Chart palette tokens - keeps hardcoded HSL out of JSX */
const T = {
  primary: 'hsl(152, 76%, 42%)',
  bar: 'hsl(0, 0%, 24%)',
  axis: 'hsl(0, 0%, 35%)',
  fg: 'hsl(0, 0%, 93%)',
  card: 'hsl(0, 0%, 6.5%)',
  border: 'hsl(0, 0%, 12%)',
  grid: 'hsl(0, 0%, 10%)',
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

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded-xl bg-foreground/5 ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-[104px]" />)}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80 lg:col-span-3" />
      </div>
      <Skeleton className="h-[420px]" />
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
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Company-wide performance overview</p>
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && <LoadingSkeleton />}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">{error}</div>
      )}

      {data && !loading && (
        <div className="animate-fade-up space-y-10">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Deals" value={data.summary.totalSales} color="green"
              icon={<Target className="h-5 w-5" />} tooltip="Total closed deals from QuickBase" />
            <MetricCard label="Kilowatts" value={`${data.summary.totalKw.toFixed(1)}`} color="blue"
              icon={<Zap className="h-5 w-5" />} tooltip="Total kW sold across all offices" />
            <MetricCard label="Avg System" value={`${data.summary.avgSystemSize.toFixed(1)} kW`}
              tooltip="Average system size per deal" />
            <MetricCard label="Net PPW" value={`$${data.summary.avgPpw.toFixed(2)}`}
              tooltip="Average net price per watt" />
          </div>

          {/* Chart + Top Closers */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Section title="Deals by Office">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                      <XAxis type="number" tick={{ fill: T.axis, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: T.fg, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} width={90} axisLine={false} tickLine={false} />
                      <RTooltip
                        cursor={{ fill: T.grid }}
                        contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.fg, fontSize: 12, fontFamily: 'var(--font-geist-mono)' }}
                      />
                      <Bar dataKey="deals" radius={[0, 4, 4, 0]} maxBarSize={20}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={i === 0 ? T.primary : T.bar} fillOpacity={i === 0 ? 1 : 0.6} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>

            <div className="lg:col-span-3">
              <Section title="Top Closers" subtitle="Ranked by QB-verified closes" noPadding>
                <div className="divide-y divide-border/60">
                  {data.closerLeaderboard
                    .filter(c => (c.SAT || 0) > 0 || (c.qbCloses || 0) > 0)
                    .sort((a, b) => (b.qbCloses || 0) - (a.qbCloses || 0))
                    .slice(0, 8)
                    .map((c, i) => {
                      const sitClose = (c.SAT || 0) > 0 ? ((c.qbCloses || 0) / c.SAT) * 100 : 0;
                      return (
                        <Link key={c.userId} href={`/rep/${c.userId}`}
                          className="group flex items-center justify-between px-6 py-3 transition-colors hover:bg-secondary/50">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold font-mono ${
                              i === 0 ? 'bg-primary/15 text-primary' : i < 3 ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground/50'
                            }`}>{i + 1}</span>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">{c.name}</div>
                              <div className="text-[11px] text-muted-foreground">{c.qbOffice?.split(' - ')[0]}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[12px] shrink-0">
                            <span className="text-muted-foreground font-mono tabular-nums">{c.SAT || 0} sits</span>
                            <span className="font-semibold font-mono tabular-nums text-primary">{c.qbCloses || 0}</span>
                            {(c.CLOS || 0) > (c.qbCloses || 0) && (
                              <span className="text-[11px] font-mono text-warning/70">({c.CLOS})</span>
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
                  <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="py-3 px-6 text-left font-medium">Office</th>
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
                      <tr key={office} className={`border-b border-border/50 transition-colors hover:bg-secondary/30 ${qbCloses === 0 ? 'opacity-30' : ''}`}>
                        <td className="py-3 px-6">
                          <Link href={`/office/${encodeURIComponent(office)}`} className="group/link inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-primary">
                            {office}
                            <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 transition-all group-hover/link:opacity-100 group-hover/link:translate-x-0 text-primary" />
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex min-w-[22px] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold font-mono ${
                            activeReps > 0 ? 'bg-primary/10 text-primary' : 'text-muted-foreground/30'
                          }`}>{activeReps}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold font-mono tabular-nums text-primary">{qbCloses}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">{(d.sales?.kw || 0).toFixed(1)}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">{totalDoors}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">{totalAppts}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">{totalSits}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-mono tabular-nums ${rcClaims > qbCloses ? 'font-semibold text-warning' : 'text-muted-foreground'}`}>
                            {rcClaims}
                            {rcClaims > qbCloses && <span className="ml-1 text-[10px] text-destructive">+{rcClaims - qbCloses}</span>}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {totalSits > 0 ? <StatusBadge value={Math.round(sitClose)} good={35} ok={25} /> : <span className="text-muted-foreground/20 font-mono">--</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="py-3 px-6 text-muted-foreground">Total</td>
                    <td className="py-3 px-3 text-center font-mono text-muted-foreground">
                      {officeEntries.reduce((s, [, d]) => s + (d.activeReps || 0), 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-primary">{data.summary.totalSales}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">{data.summary.totalKw.toFixed(1)}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">{officeEntries.reduce((s, [, d]) => s + (d.setters?.reduce((a: number, r: any) => a + (r.DK || 0), 0) || 0), 0)}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">{officeEntries.reduce((s, [, d]) => s + (d.setters?.reduce((a: number, r: any) => a + (r.APPT || 0), 0) || 0), 0)}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">{officeEntries.reduce((s, [, d]) => s + (d.closers?.reduce((a: number, r: any) => a + (r.SAT || 0), 0) || 0), 0)}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">{officeEntries.reduce((s, [, d]) => s + (d.closers?.reduce((a: number, r: any) => a + (r.CLOS || 0), 0) || 0), 0)}</td>
                    <td className="py-3 px-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section title="Top Setters" subtitle="By appointments set" noPadding>
              <div className="divide-y divide-border/60">
                {data.setterLeaderboard
                  .filter(s => (s.DK || 0) > 0 || (s.APPT || 0) > 0)
                  .sort((a, b) => (b.APPT || 0) - (a.APPT || 0) || (b.DK || 0) - (a.DK || 0))
                  .slice(0, 8)
                  .map((s, i) => (
                    <Link key={s.userId} href={`/rep/${s.userId}`}
                      className="group flex items-center justify-between px-6 py-3 transition-colors hover:bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold font-mono ${
                          i === 0 ? 'bg-primary/15 text-primary' : i < 3 ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground/50'
                        }`}>{i + 1}</span>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">{s.name}</div>
                          <div className="text-[11px] text-muted-foreground">{s.qbOffice?.split(' - ')[0]}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[12px] font-mono tabular-nums shrink-0">
                        <span className="text-muted-foreground">{s.DK || 0} doors</span>
                        <span className="font-semibold text-info">{s.APPT || 0} appts</span>
                        <span className="text-primary">{s.SITS || 0} sits</span>
                      </div>
                    </Link>
                  ))}
              </div>
            </Section>

            <Section title="QB Sales by Closer" subtitle="QuickBase verified deals">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(data.salesByCloser)
                  .sort(([, a]: any, [, b]: any) => b.deals - a.deals)
                  .slice(0, 8)
                  .map(([name, d]: [string, any]) => (
                    <div key={name} className="rounded-lg border border-border/60 bg-secondary/20 p-4 transition-colors hover:bg-secondary/40 hover:border-border">
                      <div className="truncate text-[13px] font-medium text-foreground">{name}</div>
                      <div className="truncate text-[11px] text-muted-foreground mt-0.5">{d.office}</div>
                      <div className="mt-3 flex items-center gap-3 font-mono text-[12px] tabular-nums">
                        <span className="font-semibold text-primary">{d.deals} deals</span>
                        <span className="text-muted-foreground">{d.kw.toFixed(1)} kW</span>
                      </div>
                    </div>
                  ))}
              </div>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
