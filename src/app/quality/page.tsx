'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Cell } from 'recharts';
import { Section } from '@/components/Section';
import { WeekPicker, useWeekDates } from '@/components/WeekPicker';
import { Tooltip } from '@/components/Tooltip';
import { StatusBadge } from '@/components/StatusBadge';
import { Award, FileText, AlertTriangle } from 'lucide-react';

function wasteColor(v: number) {
  if (v >= 30) return 'bg-destructive/10 text-destructive border-destructive/20';
  if (v >= 15) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-primary/10 text-primary border-primary/20';
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" /> Quality Metrics
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Setter accountability & appointment quality</p>
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
          {/* Education Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm text-primary">Quality Appointment</h3>
              </div>
              <p className="text-foreground/70 text-xs leading-relaxed">A quality appointment has the <span className="text-foreground font-medium">power bill collected</span> AND is <span className="text-foreground font-medium">set within 48 hours</span>. These appointments sit 2-3x more often.</p>
            </div>
            <div className="bg-info/5 border border-info/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-info" />
                <h3 className="font-semibold text-sm text-info">Why Waste Rate Matters</h3>
              </div>
              <p className="text-foreground/70 text-xs leading-relaxed">No-shows and cancels waste closer time. A setter with <span className="text-destructive font-medium">{'>'} 30% waste rate</span> needs coaching. Every wasted appointment = a lost opportunity.</p>
            </div>
            <div className="bg-warning/5 border border-warning/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-warning" />
                <h3 className="font-semibold text-sm text-warning">Target Benchmarks</h3>
              </div>
              <p className="text-foreground/70 text-xs leading-relaxed"><span className="text-primary font-medium">Sit Rate: 50%+</span> | <span className="text-primary font-medium">Close Rate: 15%+</span> | <span className="text-primary font-medium">Waste: {'<'}15%</span>. These are the numbers that build careers.</p>
            </div>
          </div>

          {/* Office Sit Rate Comparison */}
          <Section title="Office Sit Rate Comparison" subtitle="Appointment to Sit conversion by office">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={officeQuality} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(0, 0%, 95%)', fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                  <RTooltip
                    contentStyle={{ background: 'hsl(224, 10%, 8%)', border: '1px solid hsl(224, 10%, 14%)', borderRadius: 6, color: 'hsl(0, 0%, 95%)', fontSize: 12 }}
                    formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Sit Rate']}
                  />
                  <Bar dataKey="sitRate" radius={[0, 4, 4, 0]}>
                    {officeQuality.map((o, i) => (
                      <Cell key={i} fill={o.sitRate >= 50 ? 'hsl(142, 71%, 45%)' : o.sitRate >= 30 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 84%, 60%)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-primary/10 border border-primary/20 rounded-md py-1.5"><span className="text-primary font-medium">50%+ = Great</span></div>
              <div className="bg-warning/10 border border-warning/20 rounded-md py-1.5"><span className="text-warning font-medium">30-49% = Watch</span></div>
              <div className="bg-destructive/10 border border-destructive/20 rounded-md py-1.5"><span className="text-destructive font-medium">{'<'}30% = Concern</span></div>
            </div>
          </Section>

          {/* Setter Accountability Table */}
          <Section title="Setter Accountability" subtitle="Full funnel metrics -- sorted by waste rate (worst first)">
            {setterAccountability.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">No setter data available for this period</p>
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border text-[11px] uppercase tracking-wider">
                      <th className="text-left py-3 px-5 font-medium">#</th>
                      <th className="text-left py-3 px-2 font-medium">Setter</th>
                      <th className="text-left py-3 px-2 font-medium">Office</th>
                      <th className="text-right py-3 px-2 font-medium">Set</th>
                      <th className="text-right py-3 px-2 font-medium">No Show</th>
                      <th className="text-right py-3 px-2 font-medium">Cancel</th>
                      <th className="text-right py-3 px-2 font-medium">Sits</th>
                      <th className="text-right py-3 px-2 font-medium">QB Closes</th>
                      <th className="text-right py-3 px-2 font-medium">
                        <div className="flex items-center justify-end gap-1">Sit% <Tooltip text="Sits / Appointments Set" /></div>
                      </th>
                      <th className="text-right py-3 px-2 font-medium">
                        <div className="flex items-center justify-end gap-1">Close% <Tooltip text="QB Closes / Appointments Set" /></div>
                      </th>
                      <th className="text-right py-3 px-3 font-medium">
                        <div className="flex items-center justify-end gap-1">Waste% <Tooltip text="(No Shows + Cancels) / Appointments Set" /></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {setterAccountability.map((s: any, i: number) => (
                      <tr key={s.userId} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-5 text-muted-foreground">{i + 1}</td>
                        <td className="py-3 px-2 font-medium text-foreground">{s.name}</td>
                        <td className="py-3 px-2 text-muted-foreground text-xs">{s.qbOffice?.split(' - ')[0] || s.team}</td>
                        <td className="text-right py-3 px-2 text-info font-bold font-mono">{s.appt}</td>
                        <td className="text-right py-3 px-2 text-destructive font-mono">{s.nosh}</td>
                        <td className="text-right py-3 px-2 text-warning font-mono">{s.canc}</td>
                        <td className="text-right py-3 px-2 text-info font-mono">{s.sits}</td>
                        <td className="text-right py-3 px-2 text-primary font-bold font-mono">{s.qbCloses}</td>
                        <td className="text-right py-3 px-2">
                          {s.appt > 0 ? <StatusBadge value={Math.round(s.sitRate)} good={50} ok={30} /> : <span className="text-muted-foreground/40">-</span>}
                        </td>
                        <td className="text-right py-3 px-2">
                          {s.appt > 0 ? <StatusBadge value={Math.round(s.closeRate)} good={15} ok={8} /> : <span className="text-muted-foreground/40">-</span>}
                        </td>
                        <td className="text-right py-3 px-3">
                          {s.appt > 0 ? (
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
        </>
      )}
    </div>
  );
}
