'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Section } from '@/components/Section';
import { MetricCard } from '@/components/MetricCard';
import { WeekPicker, useWeekDates } from '@/components/WeekPicker';
import { FunnelChart } from '@/components/FunnelChart';
import { StatusBadge } from '@/components/StatusBadge';
import { Tooltip } from '@/components/Tooltip';
import { ArrowLeft, Target, Users } from 'lucide-react';

function wasteColor(v: number) {
  if (v >= 30) return 'bg-destructive/10 text-destructive';
  if (v >= 15) return 'bg-warning/10 text-warning';
  return 'bg-primary/10 text-primary';
}

export default function OfficePage() {
  const params = useParams();
  const officeName = decodeURIComponent(params.name as string);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const { from, to } = useWeekDates(weekOffset);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/office/${encodeURIComponent(officeName)}?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [officeName, from, to]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-default hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <h1 className="flex items-center gap-3 text-lg font-semibold tracking-tight text-foreground">
            {officeName}
            {data && (
              <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                (data.activeReps || 0) > 0 ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${(data.activeReps || 0) > 0 ? 'bg-primary' : 'bg-muted-foreground'}`} />
                {data.activeReps || 0} active
              </span>
            )}
          </h1>
          {data && <p className="mt-0.5 text-[13px] text-muted-foreground">{data.region}</p>}
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[88px] animate-pulse-subtle rounded-lg border border-border bg-card" />
            ))}
          </div>
          <div className="h-[240px] animate-pulse-subtle rounded-lg border border-border bg-card" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">{error}</div>
      )}

      {data && !loading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <MetricCard label="QB Deals" value={data.summary.deals} color="green" icon={<Target className="h-4 w-4" />} />
            <MetricCard label="kW Sold" value={`${data.summary.kw.toFixed(1)}`} color="blue" />
            <MetricCard label="Avg PPW" value={`$${data.summary.avgPpw.toFixed(2)}`} />
            <MetricCard label="Setters" value={data.setters.length} icon={<Users className="h-4 w-4" />} />
            <MetricCard label="Closers" value={data.closers.length} icon={<Users className="h-4 w-4" />} />
          </div>

          {/* Funnel */}
          <Section title="Sales Funnel" subtitle="Doors to QB Closes">
            <FunnelChart steps={[
              { label: 'Doors Knocked', value: data.funnel.doors, color: 'hsl(0, 0%, 50%)' },
              { label: 'Appointments', value: data.funnel.appointments, color: 'hsl(213, 94%, 58%)' },
              { label: 'Sits', value: data.funnel.sits, color: 'hsl(270, 76%, 58%)' },
              { label: 'QB Closes', value: data.funnel.qbCloses, color: 'hsl(160, 84%, 39%)' },
            ]} />
            {data.funnel.rcClaims > data.funnel.qbCloses && (
              <div className="mt-3 rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-[13px] text-warning">
                RC Claims ({data.funnel.rcClaims}) exceed QB Closes ({data.funnel.qbCloses}) -- gap of {data.funnel.rcClaims - data.funnel.qbCloses}
              </div>
            )}
          </Section>

          {/* Setter Table */}
          <Section title="Setter Accountability" noPadding>
            {data.setters.length === 0 ? (
              <p className="px-5 py-12 text-center text-[13px] text-muted-foreground">No setter data for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-3 px-5 text-left font-medium w-8">#</th>
                      <th className="py-3 px-3 text-left font-medium">Setter</th>
                      <th className="py-3 px-3 text-right font-medium"><span className="inline-flex items-center gap-1">Set <Tooltip text="Appointments set via RepCard" /></span></th>
                      <th className="py-3 px-3 text-right font-medium">No Show</th>
                      <th className="py-3 px-3 text-right font-medium">Cancel</th>
                      <th className="py-3 px-3 text-right font-medium">Sits</th>
                      <th className="py-3 px-3 text-right font-medium">QB Closes</th>
                      <th className="py-3 px-3 text-right font-medium"><span className="inline-flex items-center gap-1">Sit% <Tooltip text="Green: >50%, Yellow: 30-50%, Red: <30%" /></span></th>
                      <th className="py-3 px-3 text-right font-medium"><span className="inline-flex items-center gap-1">Close% <Tooltip text="Green: >15%, Yellow: 8-15%, Red: <8%" /></span></th>
                      <th className="py-3 px-3 text-right font-medium"><span className="inline-flex items-center gap-1">Waste% <Tooltip text="(No Shows + Cancels) / Appts. Green: <15%, Yellow: 15-30%, Red: >30%" /></span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.setters
                      .sort((a: any, b: any) => (b.APPT || 0) - (a.APPT || 0))
                      .map((s: any, i: number) => (
                        <tr key={s.userId} className="border-b border-border/50 transition-default hover:bg-secondary/30">
                          <td className="py-2.5 px-5 text-muted-foreground/60 font-mono">{i + 1}</td>
                          <td className="py-2.5 px-3">
                            <Link href={`/rep/${s.userId}`} className="font-medium text-foreground transition-default hover:text-primary">{s.name}</Link>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-info">{s.APPT || 0}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-destructive">{s.nosh || 0}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-warning">{s.canc || 0}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-info">{s.SITS || 0}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-primary">{s.qbCloses || 0}</td>
                          <td className="py-2.5 px-3 text-right">
                            {(s.APPT || 0) > 0 ? <StatusBadge value={Math.round(s.sitRate)} good={50} ok={30} /> : <span className="text-muted-foreground/30">--</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {(s.APPT || 0) > 0 ? <StatusBadge value={Math.round(s.closeRate)} good={15} ok={8} /> : <span className="text-muted-foreground/30">--</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {(s.APPT || 0) > 0 ? (
                              <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold font-mono ${wasteColor(Math.round(s.wasteRate))}`}>
                                {Math.round(s.wasteRate)}%
                              </span>
                            ) : <span className="text-muted-foreground/30">--</span>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Closer Table */}
          <Section title="Closers" subtitle="QB-verified closes vs RepCard claims" noPadding>
            {data.closers.length === 0 ? (
              <p className="px-5 py-12 text-center text-[13px] text-muted-foreground">No closer data for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-3 px-5 text-left font-medium w-8">#</th>
                      <th className="py-3 px-3 text-left font-medium">Closer</th>
                      <th className="py-3 px-3 text-right font-medium">Leads</th>
                      <th className="py-3 px-3 text-right font-medium">Sat</th>
                      <th className="py-3 px-3 text-right font-medium"><span className="inline-flex items-center gap-1">QB Closes <Tooltip text="Verified from QuickBase" /></span></th>
                      <th className="py-3 px-3 text-right font-medium"><span className="inline-flex items-center gap-1">RC Claims <Tooltip text="RepCard self-reported" /></span></th>
                      <th className="py-3 px-3 text-right font-medium">Sit/Close%</th>
                      <th className="py-3 px-3 text-right font-medium">CF</th>
                      <th className="py-3 px-3 text-right font-medium">No Close</th>
                      <th className="py-3 px-3 text-right font-medium">Follow Up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.closers
                      .sort((a: any, b: any) => (b.qbCloses || 0) - (a.qbCloses || 0))
                      .map((c: any, i: number) => {
                        const sitClose = (c.SAT || 0) > 0 ? ((c.qbCloses || 0) / c.SAT * 100) : 0;
                        const gap = (c.CLOS || 0) - (c.qbCloses || 0);
                        return (
                          <tr key={c.userId} className="border-b border-border/50 transition-default hover:bg-secondary/30">
                            <td className="py-2.5 px-5 text-muted-foreground/60 font-mono">{i + 1}</td>
                            <td className="py-2.5 px-3">
                              <Link href={`/rep/${c.userId}`} className="font-medium text-foreground transition-default hover:text-primary">{c.name}</Link>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{c.LEAD || 0}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-info">{c.SAT || 0}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-primary">{c.qbCloses || 0}</td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`font-mono ${gap > 0 ? 'font-semibold text-warning' : 'text-muted-foreground'}`}>
                                {c.CLOS || 0}
                                {gap > 0 && <span className="ml-1 text-[11px] text-destructive">+{gap}</span>}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {sitClose > 0 ? <StatusBadge value={Math.round(sitClose)} good={35} ok={25} /> : <span className="text-muted-foreground/30">--</span>}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-destructive">{c.CF || 0}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-warning">{c.NOCL || 0}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{c.FUS || 0}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
