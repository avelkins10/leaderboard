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
import { ArrowLeft, MapPin, Users, Target } from 'lucide-react';

function wasteColor(v: number) {
  if (v >= 30) return 'bg-destructive/10 text-destructive border-destructive/20';
  if (v >= 15) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-primary/10 text-primary border-primary/20';
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-2 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-3">
            {officeName}
            {data && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${
                (data.activeReps || 0) > 0 ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${(data.activeReps || 0) > 0 ? 'bg-primary' : 'bg-muted-foreground'}`} />
                {data.activeReps || 0} active today
              </span>
            )}
          </h1>
          {data && (
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {data.region}
            </p>
          )}
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          <span className="ml-3 text-muted-foreground text-sm">Loading...</span>
        </div>
      )}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">Error: {error}</div>
      )}

      {data && !loading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="QB Deals" value={data.summary.deals} color="green" icon={<Target className="w-4 h-4" />} />
            <MetricCard label="kW Sold" value={`${data.summary.kw.toFixed(1)}`} color="blue" />
            <MetricCard label="Avg PPW" value={`$${data.summary.avgPpw.toFixed(2)}`} />
            <MetricCard label="Setters" value={data.setters.length} icon={<Users className="w-4 h-4" />} />
            <MetricCard label="Closers" value={data.closers.length} icon={<Users className="w-4 h-4" />} />
          </div>

          {/* Funnel */}
          <Section title="Sales Funnel" subtitle="Doors -> Appointments -> Sits -> QB Closes">
            <FunnelChart steps={[
              { label: 'Doors Knocked', value: data.funnel.doors, color: 'hsl(220, 9%, 46%)' },
              { label: 'Appointments Set', value: data.funnel.appointments, color: 'hsl(262, 83%, 58%)' },
              { label: 'Appointments Sat', value: data.funnel.sits, color: 'hsl(217, 91%, 60%)' },
              { label: 'QB Closes', value: data.funnel.qbCloses, color: 'hsl(142, 71%, 45%)' },
            ]} />
            {data.funnel.rcClaims > data.funnel.qbCloses && (
              <div className="mt-3 text-sm text-warning bg-warning/10 border border-warning/20 rounded-md px-3 py-2">
                RC Claims ({data.funnel.rcClaims}) exceed QB Closes ({data.funnel.qbCloses}) -- gap of {data.funnel.rcClaims - data.funnel.qbCloses}
              </div>
            )}
          </Section>

          {/* Setter Accountability Table */}
          <Section title="Setter Accountability" subtitle="Full funnel metrics per setter">
            {data.setters.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">No setter data for this period</p>
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border text-[11px] uppercase tracking-wider">
                      <th className="text-left py-3 px-5 font-medium">#</th>
                      <th className="text-left py-3 px-2 font-medium">Setter</th>
                      <th className="text-right py-3 px-2 font-medium"><div className="flex items-center justify-end gap-1">Set <Tooltip text="Appointments Set (from RepCard)" /></div></th>
                      <th className="text-right py-3 px-2 font-medium"><div className="flex items-center justify-end gap-1">No Show <Tooltip text="No Shows from Setter Appointment Data" /></div></th>
                      <th className="text-right py-3 px-2 font-medium"><div className="flex items-center justify-end gap-1">Cancel <Tooltip text="Cancellations from Setter Appointment Data" /></div></th>
                      <th className="text-right py-3 px-2 font-medium"><div className="flex items-center justify-end gap-1">Sits <Tooltip text="Appointments that were actually sat" /></div></th>
                      <th className="text-right py-3 px-2 font-medium"><div className="flex items-center justify-end gap-1">QB Closes <Tooltip text="Verified closes from QuickBase" /></div></th>
                      <th className="text-right py-3 px-2 font-medium"><div className="flex items-center justify-end gap-1">Sit% <Tooltip text="Sits / Appointments Set. Green: >50%, Yellow: 30-50%, Red: <30%" /></div></th>
                      <th className="text-right py-3 px-2 font-medium"><div className="flex items-center justify-end gap-1">Close% <Tooltip text="QB Closes / Appointments Set. Green: >15%, Yellow: 8-15%, Red: <8%" /></div></th>
                      <th className="text-right py-3 px-3 font-medium"><div className="flex items-center justify-end gap-1">Waste% <Tooltip text="(No Shows + Cancels) / Appointments Set. Green: <15%, Yellow: 15-30%, Red: >30%" /></div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.setters
                      .sort((a: any, b: any) => (b.APPT || 0) - (a.APPT || 0))
                      .map((s: any, i: number) => (
                        <tr key={s.userId} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-3 px-5 text-muted-foreground">{i + 1}</td>
                          <td className="py-3 px-2">
                            <Link href={`/rep/${s.userId}`} className="font-medium text-foreground hover:text-primary transition-colors">{s.name}</Link>
                          </td>
                          <td className="text-right py-3 px-2 text-info font-bold font-mono">{s.APPT || 0}</td>
                          <td className="text-right py-3 px-2 text-destructive font-mono">{s.nosh || 0}</td>
                          <td className="text-right py-3 px-2 text-warning font-mono">{s.canc || 0}</td>
                          <td className="text-right py-3 px-2 text-info font-mono">{s.SITS || 0}</td>
                          <td className="text-right py-3 px-2 text-primary font-bold font-mono">{s.qbCloses || 0}</td>
                          <td className="text-right py-3 px-2">
                            {(s.APPT || 0) > 0 ? <StatusBadge value={Math.round(s.sitRate)} good={50} ok={30} /> : <span className="text-muted-foreground/40">-</span>}
                          </td>
                          <td className="text-right py-3 px-2">
                            {(s.APPT || 0) > 0 ? <StatusBadge value={Math.round(s.closeRate)} good={15} ok={8} /> : <span className="text-muted-foreground/40">-</span>}
                          </td>
                          <td className="text-right py-3 px-3">
                            {(s.APPT || 0) > 0 ? (
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium border ${wasteColor(Math.round(s.wasteRate))}`}>
                                {Math.round(s.wasteRate)}%
                              </span>
                            ) : <span className="text-muted-foreground/40">-</span>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Closer Table */}
          <Section title="Closers" subtitle="QB-verified closes vs RepCard claims">
            {data.closers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">No closer data for this period</p>
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border text-[11px] uppercase tracking-wider">
                      <th className="text-left py-3 px-5 font-medium">#</th>
                      <th className="text-left py-3 px-2 font-medium">Closer</th>
                      <th className="text-right py-3 px-2 font-medium">Leads</th>
                      <th className="text-right py-3 px-2 font-medium">Sat</th>
                      <th className="text-right py-3 px-2 font-medium"><div className="flex items-center justify-end gap-1">QB Closes <Tooltip text="Verified closes from QuickBase" /></div></th>
                      <th className="text-right py-3 px-2 font-medium"><div className="flex items-center justify-end gap-1">RC Claims <Tooltip text="RepCard self-reported closes" /></div></th>
                      <th className="text-right py-3 px-2 font-medium"><div className="flex items-center justify-end gap-1">Sit/Close% <Tooltip text="QB Closes / Sits" /></div></th>
                      <th className="text-right py-3 px-2 font-medium">CF</th>
                      <th className="text-right py-3 px-2 font-medium">Shade</th>
                      <th className="text-right py-3 px-2 font-medium">No Close</th>
                      <th className="text-right py-3 px-3 font-medium">Follow Up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.closers
                      .sort((a: any, b: any) => (b.qbCloses || 0) - (a.qbCloses || 0))
                      .map((c: any, i: number) => {
                        const sitClose = (c.SAT || 0) > 0 ? ((c.qbCloses || 0) / c.SAT * 100) : 0;
                        const gap = (c.CLOS || 0) - (c.qbCloses || 0);
                        return (
                          <tr key={c.userId} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                            <td className="py-3 px-5 text-muted-foreground">{i + 1}</td>
                            <td className="py-3 px-2">
                              <Link href={`/rep/${c.userId}`} className="font-medium text-foreground hover:text-primary transition-colors">{c.name}</Link>
                            </td>
                            <td className="text-right py-3 px-2 text-muted-foreground font-mono">{c.LEAD || 0}</td>
                            <td className="text-right py-3 px-2 text-info font-mono">{c.SAT || 0}</td>
                            <td className="text-right py-3 px-2 text-primary font-bold font-mono">{c.qbCloses || 0}</td>
                            <td className="text-right py-3 px-2">
                              <span className={`font-mono ${gap > 0 ? 'text-warning font-bold' : 'text-muted-foreground'}`}>
                                {c.CLOS || 0}
                                {gap > 0 && <span className="text-xs ml-1 text-destructive">+{gap}</span>}
                              </span>
                            </td>
                            <td className="text-right py-3 px-2">{sitClose > 0 ? <StatusBadge value={Math.round(sitClose)} good={35} ok={25} /> : <span className="text-muted-foreground/40">-</span>}</td>
                            <td className="text-right py-3 px-2 text-destructive font-mono">{c.CF || 0}</td>
                            <td className="text-right py-3 px-2 text-muted-foreground font-mono">{c.SHAD || 0}</td>
                            <td className="text-right py-3 px-2 text-warning font-mono">{c.NOCL || 0}</td>
                            <td className="text-right py-3 px-3 text-muted-foreground font-mono">{c.FUS || 0}</td>
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
