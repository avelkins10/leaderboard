'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Cell } from 'recharts';
import { Section } from '@/components/Section';
import { MetricCard } from '@/components/MetricCard';
import { WeekPicker, useWeekDates } from '@/components/WeekPicker';
import { Tooltip } from '@/components/Tooltip';
import { StatusBadge } from '@/components/StatusBadge';
import { Award, BookOpen, Lightbulb } from 'lucide-react';

function wasteColor(v: number) {
  if (v >= 30) return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (v >= 15) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
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

  // Build setter accountability by merging setter LB + setter appt data + QB closes
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

  // Office quality comparison
  const officeQuality = data ? Object.entries(data.offices).map(([name, d]: [string, any]) => {
    const totalAppts = d.setters?.reduce((s: number, r: any) => s + (r.APPT || 0), 0) || 0;
    const totalSits = d.closers?.reduce((s: number, r: any) => s + (r.SAT || 0), 0) || 0;
    const sitRate = totalAppts > 0 ? (totalSits / totalAppts * 100) : 0;
    return { name: name.split(' - ')[0], fullName: name, totalAppts, totalSits, sitRate };
  }).sort((a, b) => b.sitRate - a.sitRate) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="w-6 h-6 text-yellow-400" /> Quality Metrics</h1>
          <p className="text-gray-500 text-sm mt-1">Setter accountability & appointment quality</p>
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /><span className="ml-3 text-gray-400">Loading...</span></div>}
      {error && <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-300">Error: {error}</div>}

      {data && !loading && (
        <>
          {/* Education Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 border border-emerald-800/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3"><Lightbulb className="w-5 h-5 text-emerald-400" /><h3 className="font-bold text-emerald-400">What is a Quality Appointment?</h3></div>
              <p className="text-gray-300 text-sm leading-relaxed">A quality appointment has the <span className="text-white font-medium">power bill collected</span> AND is <span className="text-white font-medium">set within 48 hours</span>. These appointments sit 2-3x more often than non-quality ones.</p>
            </div>
            <div className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 border border-blue-800/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3"><BookOpen className="w-5 h-5 text-blue-400" /><h3 className="font-bold text-blue-400">Why Waste Rate Matters</h3></div>
              <p className="text-gray-300 text-sm leading-relaxed">No-shows and cancels waste closer time. A setter with <span className="text-red-400 font-medium">&gt;30% waste rate</span> needs coaching. Every wasted appointment = a lost opportunity + frustrated closer.</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-900/10 border border-yellow-800/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3"><Award className="w-5 h-5 text-yellow-400" /><h3 className="font-bold text-yellow-400">Target Benchmarks</h3></div>
              <p className="text-gray-300 text-sm leading-relaxed"><span className="text-emerald-400 font-medium">Sit Rate: 50%+</span> | <span className="text-emerald-400 font-medium">Close Rate: 15%+</span> | <span className="text-emerald-400 font-medium">Waste: &lt;15%</span>. These are the numbers that build careers.</p>
            </div>
          </div>

          {/* Office Sit Rate Comparison */}
          <Section title="🏢 Office Sit Rate Comparison" subtitle="Appointment → Sit conversion by office">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={officeQuality} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#d1d5db', fontSize: 12 }} width={120} />
                  <RTooltip
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }}
                    formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Sit Rate']}
                  />
                  <Bar dataKey="sitRate" radius={[0, 6, 6, 0]}>
                    {officeQuality.map((o, i) => (
                      <Cell key={i} fill={o.sitRate >= 50 ? '#10b981' : o.sitRate >= 30 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-2"><span className="text-emerald-400 font-bold">50%+ = Great</span></div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg py-2"><span className="text-yellow-400 font-bold">30-49% = Watch</span></div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg py-2"><span className="text-red-400 font-bold">&lt;30% = Concern</span></div>
            </div>
          </Section>

          {/* Setter Accountability Table */}
          <Section title="👤 Setter Accountability" subtitle="Full funnel metrics — sorted by waste rate (worst first)">
            {setterAccountability.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No setter data available for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase tracking-wider">
                      <th className="text-left py-3 px-4">#</th>
                      <th className="text-left py-3 px-2">Setter</th>
                      <th className="text-left py-3 px-2">Office</th>
                      <th className="text-right py-3 px-2">Set</th>
                      <th className="text-right py-3 px-2">No Show</th>
                      <th className="text-right py-3 px-2">Cancel</th>
                      <th className="text-right py-3 px-2">Sits</th>
                      <th className="text-right py-3 px-2">QB Closes</th>
                      <th className="text-right py-3 px-2">
                        <div className="flex items-center justify-end gap-1">Sit% <Tooltip text="Sits ÷ Appointments Set" /></div>
                      </th>
                      <th className="text-right py-3 px-2">
                        <div className="flex items-center justify-end gap-1">Close% <Tooltip text="QB Closes ÷ Appointments Set" /></div>
                      </th>
                      <th className="text-right py-3 px-2">
                        <div className="flex items-center justify-end gap-1">Waste% <Tooltip text="(No Shows + Cancels) ÷ Appointments Set" /></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {setterAccountability.map((s: any, i: number) => (
                      <tr key={s.userId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                        <td className="py-3 px-2 font-medium">{s.name}</td>
                        <td className="py-3 px-2 text-gray-500">{s.qbOffice?.split(' - ')[0] || s.team}</td>
                        <td className="text-right py-3 px-2 text-purple-400 font-bold">{s.appt}</td>
                        <td className="text-right py-3 px-2 text-red-400">{s.nosh}</td>
                        <td className="text-right py-3 px-2 text-orange-400">{s.canc}</td>
                        <td className="text-right py-3 px-2 text-blue-400">{s.sits}</td>
                        <td className="text-right py-3 px-2 text-emerald-400 font-bold">{s.qbCloses}</td>
                        <td className="text-right py-3 px-2">
                          {s.appt > 0 ? <StatusBadge value={Math.round(s.sitRate)} good={50} ok={30} /> : '-'}
                        </td>
                        <td className="text-right py-3 px-2">
                          {s.appt > 0 ? <StatusBadge value={Math.round(s.closeRate)} good={15} ok={8} /> : '-'}
                        </td>
                        <td className="text-right py-3 px-2">
                          {s.appt > 0 ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${wasteColor(Math.round(s.wasteRate))}`}>
                              {Math.round(s.wasteRate)}%
                            </span>
                          ) : '-'}
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
