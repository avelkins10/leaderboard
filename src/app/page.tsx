'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Cell } from 'recharts';
import { MetricCard } from '@/components/MetricCard';
import { Section } from '@/components/Section';
import { WeekPicker, useWeekDates } from '@/components/WeekPicker';
import { Tooltip } from '@/components/Tooltip';
import { StatusBadge } from '@/components/StatusBadge';
import { Target, DollarSign, Zap, ChevronRight } from 'lucide-react';

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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Company-wide performance overview</p>
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          <span className="ml-3 text-muted-foreground text-sm">Loading scorecard...</span>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">Error: {error}</div>
      )}

      {data && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Total Deals" value={data.summary.totalSales} color="green"
              icon={<Target className="w-4 h-4" />} tooltip="Total closed deals from QuickBase for this period" />
            <MetricCard label="Total kW" value={`${data.summary.totalKw.toFixed(1)}`} color="blue"
              icon={<Zap className="w-4 h-4" />} tooltip="Total kilowatts sold across all offices" />
            <MetricCard label="Avg System" value={`${data.summary.avgSystemSize.toFixed(1)} kW`}
              icon={<DollarSign className="w-4 h-4" />} tooltip="Average system size per deal" />
            <MetricCard label="Avg Net PPW" value={`$${data.summary.avgPpw.toFixed(2)}`}
              icon={<DollarSign className="w-4 h-4" />} tooltip="Average net price per watt across all deals" />
          </div>

          {/* Two-column: Chart + Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Deals by Office Chart */}
            <div className="lg:col-span-2">
              <Section title="Deals by Office">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(0, 0%, 95%)', fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                      <RTooltip contentStyle={{ background: 'hsl(224, 10%, 8%)', border: '1px solid hsl(224, 10%, 14%)', borderRadius: 6, color: 'hsl(0, 0%, 95%)', fontSize: 12 }} />
                      <Bar dataKey="deals" radius={[0, 4, 4, 0]}>
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? 'hsl(142, 71%, 45%)' : i < 3 ? 'hsl(217, 91%, 60%)' : 'hsl(220, 9%, 46%)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>

            {/* Top Closers */}
            <div className="lg:col-span-3">
              <Section title="Top Closers" subtitle="Ranked by QB verified closes">
                <div className="space-y-0.5">
                  {data.closerLeaderboard
                    .filter(c => (c.SAT || 0) > 0 || (c.qbCloses || 0) > 0)
                    .sort((a, b) => (b.qbCloses || 0) - (a.qbCloses || 0))
                    .slice(0, 8)
                    .map((c, i) => {
                      const sitClose = (c.SAT || 0) > 0 ? ((c.qbCloses || 0) / c.SAT) * 100 : 0;
                      return (
                        <Link key={c.userId} href={`/rep/${c.userId}`}
                          className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50 group transition-colors">
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              i < 3 ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
                            }`}>{i + 1}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{c.name}</span>
                              <span className="text-muted-foreground/60 text-xs hidden sm:inline">{c.qbOffice?.split(' - ')[0]}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs">
                            <span className="text-muted-foreground">{c.SAT || 0} sits</span>
                            <span className="font-bold text-primary font-mono">{c.qbCloses || 0}</span>
                            {(c.CLOS || 0) > (c.qbCloses || 0) && (
                              <span className="text-warning text-xs">({c.CLOS} claimed)</span>
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

          {/* Office Scorecard Table */}
          <Section title="Office Scorecard" subtitle="Click an office for detailed breakdown">
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b border-border text-[11px] uppercase tracking-wider">
                    <th className="text-left py-3 px-5 font-medium">Office</th>
                    <th className="text-center py-3 px-2 font-medium">Active</th>
                    <th className="text-right py-3 px-2 font-medium">
                      <div className="flex items-center justify-end gap-1">QB Deals <Tooltip text="Verified closed deals from QuickBase" /></div>
                    </th>
                    <th className="text-right py-3 px-2 font-medium">kW</th>
                    <th className="text-right py-3 px-2 font-medium">Doors</th>
                    <th className="text-right py-3 px-2 font-medium">Appts</th>
                    <th className="text-right py-3 px-2 font-medium">Sits</th>
                    <th className="text-right py-3 px-2 font-medium">
                      <div className="flex items-center justify-end gap-1">QB Closes <Tooltip text="Verified closes from QuickBase" /></div>
                    </th>
                    <th className="text-right py-3 px-2 font-medium">
                      <div className="flex items-center justify-end gap-1">RC Claims <Tooltip text="RepCard self-reported closes (Pending KCA)" /></div>
                    </th>
                    <th className="text-right py-3 px-3 font-medium">
                      <div className="flex items-center justify-end gap-1">Sit/Close <Tooltip text="QB Closes / Sits. Target: 35%+" /></div>
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
                      <tr key={office} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${qbCloses === 0 ? 'opacity-50' : ''}`}>
                        <td className="py-3 px-5">
                          <Link href={`/office/${encodeURIComponent(office)}`} className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors group">
                            <span>{office}</span>
                            <ChevronRight className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </td>
                        <td className="text-center py-3 px-2">
                          <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${
                            activeReps > 0 ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                          }`}>
                            {activeReps}
                          </span>
                        </td>
                        <td className="text-right py-3 px-2 font-bold text-primary font-mono">{qbCloses}</td>
                        <td className="text-right py-3 px-2 text-foreground/80 font-mono">{(d.sales?.kw || 0).toFixed(1)}</td>
                        <td className="text-right py-3 px-2 text-muted-foreground font-mono">{totalDoors}</td>
                        <td className="text-right py-3 px-2 text-muted-foreground font-mono">{totalAppts}</td>
                        <td className="text-right py-3 px-2 text-muted-foreground font-mono">{totalSits}</td>
                        <td className="text-right py-3 px-2 font-bold text-primary font-mono">{qbCloses}</td>
                        <td className="text-right py-3 px-2">
                          <span className={`font-mono ${rcClaims > qbCloses ? 'text-warning font-bold' : 'text-muted-foreground'}`}>
                            {rcClaims}
                            {rcClaims > qbCloses && <span className="text-xs ml-1 text-destructive">+{rcClaims - qbCloses}</span>}
                          </span>
                        </td>
                        <td className="text-right py-3 px-3">
                          {totalSits > 0 ? <StatusBadge value={Math.round(sitClose)} good={35} ok={25} /> : <span className="text-muted-foreground/40">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-bold">
                    <td className="py-3 px-5 text-foreground/80">TOTAL</td>
                    <td className="text-center py-3 px-2 text-muted-foreground font-mono">
                      {officeEntries.reduce((s, [, d]) => s + (d.activeReps || 0), 0)}
                    </td>
                    <td className="text-right py-3 px-2 text-primary font-mono">{data.summary.totalSales}</td>
                    <td className="text-right py-3 px-2 text-foreground/80 font-mono">{data.summary.totalKw.toFixed(1)}</td>
                    <td className="text-right py-3 px-2 text-muted-foreground font-mono">{officeEntries.reduce((s, [, d]) => s + (d.setters?.reduce((a: number, r: any) => a + (r.DK || 0), 0) || 0), 0)}</td>
                    <td className="text-right py-3 px-2 text-muted-foreground font-mono">{officeEntries.reduce((s, [, d]) => s + (d.setters?.reduce((a: number, r: any) => a + (r.APPT || 0), 0) || 0), 0)}</td>
                    <td className="text-right py-3 px-2 text-muted-foreground font-mono">{officeEntries.reduce((s, [, d]) => s + (d.closers?.reduce((a: number, r: any) => a + (r.SAT || 0), 0) || 0), 0)}</td>
                    <td className="text-right py-3 px-2 text-primary font-mono">{data.summary.totalSales}</td>
                    <td className="text-right py-3 px-2 text-muted-foreground font-mono">{officeEntries.reduce((s, [, d]) => s + (d.closers?.reduce((a: number, r: any) => a + (r.CLOS || 0), 0) || 0), 0)}</td>
                    <td className="text-right py-3 px-3 text-muted-foreground/40">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>

          {/* Bottom row: Setters + Sales by Closer */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Top Setters" subtitle="Ranked by appointments set">
              <div className="space-y-0.5">
                {data.setterLeaderboard
                  .filter(s => (s.DK || 0) > 0 || (s.APPT || 0) > 0)
                  .sort((a, b) => (b.APPT || 0) - (a.APPT || 0) || (b.DK || 0) - (a.DK || 0))
                  .slice(0, 8)
                  .map((s, i) => (
                    <Link key={s.userId} href={`/rep/${s.userId}`}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-secondary/50 group transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i < 3 ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
                        }`}>{i + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{s.name}</span>
                          <span className="text-muted-foreground/60 text-xs hidden sm:inline">{s.qbOffice?.split(' - ')[0]}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs">
                        <span className="text-muted-foreground">{s.DK || 0} doors</span>
                        <span className="font-bold text-primary font-mono">{s.APPT || 0} appts</span>
                        <span className="text-info font-mono">{s.SITS || 0} sits</span>
                      </div>
                    </Link>
                  ))}
              </div>
            </Section>

            <Section title="QB Sales by Closer" subtitle="Deals from QuickBase records">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(data.salesByCloser)
                  .sort(([, a]: any, [, b]: any) => b.deals - a.deals)
                  .slice(0, 8)
                  .map(([name, d]: [string, any]) => (
                    <div key={name} className="bg-secondary/50 border border-border rounded-md p-3 hover:border-muted-foreground/20 transition-colors">
                      <div className="font-medium text-sm text-foreground truncate">{name}</div>
                      <div className="text-xs text-muted-foreground truncate">{d.office}</div>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-primary font-bold font-mono">{d.deals} deals</span>
                        <span className="text-muted-foreground font-mono">{d.kw.toFixed(1)} kW</span>
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
