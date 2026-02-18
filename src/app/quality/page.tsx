'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Cell } from 'recharts';
import { Section } from '@/components/Section';
import { WeekPicker, useWeekDates } from '@/components/WeekPicker';
import { Tooltip } from '@/components/Tooltip';
import { StatusBadge } from '@/components/StatusBadge';

const T = {
  axis: 'hsl(0, 0%, 35%)',
  fg: 'hsl(0, 0%, 93%)',
  card: 'hsl(0, 0%, 6.5%)',
  border: 'hsl(0, 0%, 12%)',
};

function wasteColor(v: number) {
  if (v >= 30) return 'bg-destructive/10 text-destructive';
  if (v >= 15) return 'bg-warning/10 text-warning';
  return 'bg-primary/10 text-primary';
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded-xl bg-foreground/5 ${className}`} />;
}

export default function QualityPage() {
  const [data, setData] = useState<any>(null);
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
        const sitRate = appt > 0 ? (sits / appt) * 100 : 0;
        const closeRate = appt > 0 ? (qbCloses / appt) * 100 : 0;
        const wasteRate = appt > 0 ? ((nosh + canc) / appt) * 100 : 0;
        return { ...s, appt, sits, nosh, canc, qbCloses, sitRate, closeRate, wasteRate };
      })
      .sort((a: any, b: any) => b.wasteRate - a.wasteRate);
  })();

  const officeQuality = data ? Object.entries(data.offices).map(([name, d]: [string, any]) => {
    const totalAppts = d.setters?.reduce((s: number, r: any) => s + (r.APPT || 0), 0) || 0;
    const totalSits = d.closers?.reduce((s: number, r: any) => s + (r.SAT || 0), 0) || 0;
    const sitRate = totalAppts > 0 ? (totalSits / totalAppts * 100) : 0;
    return { name: name.split(' - ')[0], fullName: name, totalAppts, totalSits, sitRate };
  }).sort((a, b) => b.sitRate - a.sitRate) : [];

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Quality</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Setter accountability & appointment quality</p>
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-[104px]" />)}
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-[420px]" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">{error}</div>
      )}

      {data && !loading && (
        <div className="animate-fade-up space-y-10">
          {/* Benchmark Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Quality Appointment</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                Power bill collected AND set within 48 hours. These sit <span className="font-medium text-foreground">2-3x more often</span>.
              </p>
            </div>
            <div className="rounded-xl border border-info/10 bg-info/[0.03] p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-info">Why Waste Rate Matters</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                No-shows and cancels waste closer time. <span className="font-medium text-destructive">{'>'} 30% waste</span> needs coaching.
              </p>
            </div>
            <div className="rounded-xl border border-warning/10 bg-warning/[0.03] p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-warning">Target Benchmarks</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-primary">Sit: 50%+</span> &middot; <span className="font-medium text-primary">Close: 15%+</span> &middot; <span className="font-medium text-primary">{'Waste: <15%'}</span>
              </p>
            </div>
          </div>

          {/* Office Sit Rate Chart */}
          <Section title="Office Sit Rate" subtitle="Appointment to Sit conversion by office">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={officeQuality} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: T.axis, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: T.fg, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} width={90} axisLine={false} tickLine={false} />
                  <RTooltip
                    cursor={{ fill: 'hsl(0, 0%, 10%)' }}
                    contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.fg, fontSize: 12, fontFamily: 'var(--font-geist-mono)' }}
                    formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Sit Rate']}
                  />
                  <Bar dataKey="sitRate" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {officeQuality.map((o, i) => (
                      <Cell key={i} fill={o.sitRate >= 50 ? 'hsl(152, 76%, 42%)' : o.sitRate >= 30 ? 'hsl(40, 96%, 53%)' : 'hsl(0, 84%, 60%)'} fillOpacity={0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center gap-5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> 50%+ Great</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> 30-49% Watch</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /> {'<30% Concern'}</span>
            </div>
          </Section>

          {/* Setter Accountability Table */}
          <Section title="Setter Accountability" subtitle="Sorted by waste rate (worst first)" noPadding>
            {setterAccountability.length === 0 ? (
              <p className="px-6 py-20 text-center text-[13px] text-muted-foreground">No setter data available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="py-3 px-6 text-left font-medium w-8">#</th>
                      <th className="py-3 px-3 text-left font-medium">Setter</th>
                      <th className="py-3 px-3 text-left font-medium">Office</th>
                      <th className="py-3 px-3 text-right font-medium">Set</th>
                      <th className="py-3 px-3 text-right font-medium">No Show</th>
                      <th className="py-3 px-3 text-right font-medium">Cancel</th>
                      <th className="py-3 px-3 text-right font-medium">Sits</th>
                      <th className="py-3 px-3 text-right font-medium">QB Closes</th>
                      <th className="py-3 px-3 text-right font-medium"><span className="inline-flex items-center gap-1">Sit% <Tooltip text="Sits / Appointments Set" /></span></th>
                      <th className="py-3 px-3 text-right font-medium"><span className="inline-flex items-center gap-1">Close% <Tooltip text="QB Closes / Appointments Set" /></span></th>
                      <th className="py-3 px-3 text-right font-medium"><span className="inline-flex items-center gap-1">Waste% <Tooltip text="(No Shows + Cancels) / Appts" /></span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {setterAccountability.map((s: any, i: number) => (
                      <tr key={s.userId} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                        <td className="py-3 px-6 text-muted-foreground/40 font-mono text-[12px]">{i + 1}</td>
                        <td className="py-3 px-3 font-medium text-foreground">{s.name}</td>
                        <td className="py-3 px-3 text-[12px] text-muted-foreground">{s.qbOffice?.split(' - ')[0] || s.team}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-info">{s.appt}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-destructive">{s.nosh}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-warning">{s.canc}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-info">{s.sits}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-primary">{s.qbCloses}</td>
                        <td className="py-3 px-3 text-right">
                          {s.appt > 0 ? <StatusBadge value={Math.round(s.sitRate)} good={50} ok={30} /> : <span className="text-muted-foreground/20 font-mono">--</span>}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {s.appt > 0 ? <StatusBadge value={Math.round(s.closeRate)} good={15} ok={8} /> : <span className="text-muted-foreground/20 font-mono">--</span>}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {s.appt > 0 ? (
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold font-mono leading-none ${wasteColor(Math.round(s.wasteRate))}`}>
                              {Math.round(s.wasteRate)}%
                            </span>
                          ) : <span className="text-muted-foreground/20 font-mono">--</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
