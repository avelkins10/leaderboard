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
  if (v >= 30) return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (v >= 15) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
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
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-gray-500 hover:text-white text-sm flex items-center gap-1 mb-2 transition">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {officeName}
            {data && (
              <span className={`inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full ${(data.activeReps || 0) > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                {(data.activeReps || 0) > 0 ? '🟢' : '⚪'} {data.activeReps || 0} active today
              </span>
            )}
          </h1>
          {data && <p className="text-gray-500 text-sm mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {data.region}</p>}
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /><span className="ml-3 text-gray-400">Loading...</span></div>}
      {error && <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-300">Error: {error}</div>}

      {data && !loading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard label="QB Deals" value={data.summary.deals} color="green" icon={<Target className="w-5 h-5" />} />
            <MetricCard label="kW Sold" value={`${data.summary.kw.toFixed(1)}`} color="blue" />
            <MetricCard label="Avg PPW" value={`$${data.summary.avgPpw.toFixed(2)}`} />
            <MetricCard label="Setters" value={data.setters.length} icon={<Users className="w-5 h-5" />} />
            <MetricCard label="Closers" value={data.closers.length} icon={<Users className="w-5 h-5" />} />
          </div>

          {/* Funnel */}
          <Section title="📊 Sales Funnel" subtitle="Doors → Appointments → Sits → QB Closes">
            <FunnelChart steps={[
              { label: 'Doors Knocked', value: data.funnel.doors, color: '#6b7280' },
              { label: 'Appointments Set', value: data.funnel.appointments, color: '#8b5cf6' },
              { label: 'Appointments Sat', value: data.funnel.sits, color: '#3b82f6' },
              { label: 'QB Closes', value: data.funnel.qbCloses, color: '#10b981' },
            ]} />
            {data.funnel.rcClaims > data.funnel.qbCloses && (
              <div className="mt-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                ⚠ RC Claims ({data.funnel.rcClaims}) exceed QB Closes ({data.funnel.qbCloses}) — gap of {data.funnel.rcClaims - data.funnel.qbCloses}
              </div>
            )}
          </Section>

          {/* Setter Accountability Table */}
          <Section title="🚪 Setter Accountability" subtitle="Full funnel metrics per setter">
            {data.setters.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No setter data for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase tracking-wider">
                      <th className="text-left py-3 px-4">#</th>
                      <th className="text-left py-3 px-2">Setter</th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">Set <Tooltip text="Appointments Set (from RepCard)" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">No Show <Tooltip text="No Shows from Setter Appointment Data" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">Cancel <Tooltip text="Cancellations from Setter Appointment Data" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">Sits <Tooltip text="Appointments that were actually sat" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">QB Closes <Tooltip text="Verified closes from QuickBase" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">Sit% <Tooltip text="Sits ÷ Appointments Set. Green: >50%, Yellow: 30-50%, Red: <30%" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">Close% <Tooltip text="QB Closes ÷ Appointments Set. Green: >15%, Yellow: 8-15%, Red: <8%" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">Waste% <Tooltip text="(No Shows + Cancels) ÷ Appointments Set. Green: <15%, Yellow: 15-30%, Red: >30%" /></div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.setters
                      .sort((a: any, b: any) => (b.APPT || 0) - (a.APPT || 0))
                      .map((s: any, i: number) => (
                        <tr key={s.userId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                          <td className="py-3 px-2">
                            <Link href={`/rep/${s.userId}`} className="font-medium hover:text-blue-400 transition">{s.name}</Link>
                          </td>
                          <td className="text-right py-3 px-2 text-purple-400 font-bold">{s.APPT || 0}</td>
                          <td className="text-right py-3 px-2 text-red-400">{s.nosh || 0}</td>
                          <td className="text-right py-3 px-2 text-orange-400">{s.canc || 0}</td>
                          <td className="text-right py-3 px-2 text-blue-400">{s.SITS || 0}</td>
                          <td className="text-right py-3 px-2 text-emerald-400 font-bold">{s.qbCloses || 0}</td>
                          <td className="text-right py-3 px-2">
                            {(s.APPT || 0) > 0 ? <StatusBadge value={Math.round(s.sitRate)} good={50} ok={30} /> : '-'}
                          </td>
                          <td className="text-right py-3 px-2">
                            {(s.APPT || 0) > 0 ? <StatusBadge value={Math.round(s.closeRate)} good={15} ok={8} /> : '-'}
                          </td>
                          <td className="text-right py-3 px-2">
                            {(s.APPT || 0) > 0 ? (
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

          {/* Closer Table */}
          <Section title="🎯 Closers" subtitle="QB-verified closes vs RepCard claims">
            {data.closers.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No closer data for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase tracking-wider">
                      <th className="text-left py-3 px-4">#</th>
                      <th className="text-left py-3 px-2">Closer</th>
                      <th className="text-right py-3 px-2">Leads</th>
                      <th className="text-right py-3 px-2">Sat</th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">QB Closes <Tooltip text="Verified closes from QuickBase" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">RC Claims <Tooltip text="RepCard self-reported closes" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">Sit/Close% <Tooltip text="QB Closes ÷ Sits" /></div></th>
                      <th className="text-right py-3 px-2">CF</th>
                      <th className="text-right py-3 px-2">Shade</th>
                      <th className="text-right py-3 px-2">No Close</th>
                      <th className="text-right py-3 px-2">Follow Up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.closers
                      .sort((a: any, b: any) => (b.qbCloses || 0) - (a.qbCloses || 0))
                      .map((c: any, i: number) => {
                        const sitClose = (c.SAT || 0) > 0 ? ((c.qbCloses || 0) / c.SAT * 100) : 0;
                        const gap = (c.CLOS || 0) - (c.qbCloses || 0);
                        return (
                          <tr key={c.userId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                            <td className="py-3 px-2">
                              <Link href={`/rep/${c.userId}`} className="font-medium hover:text-blue-400 transition">{c.name}</Link>
                            </td>
                            <td className="text-right py-3 px-2">{c.LEAD || 0}</td>
                            <td className="text-right py-3 px-2 text-blue-400">{c.SAT || 0}</td>
                            <td className="text-right py-3 px-2 text-emerald-400 font-bold">{c.qbCloses || 0}</td>
                            <td className="text-right py-3 px-2">
                              <span className={gap > 0 ? 'text-yellow-400 font-bold' : 'text-gray-400'}>
                                {c.CLOS || 0}
                                {gap > 0 && <span className="text-xs ml-1 text-red-400">+{gap}</span>}
                              </span>
                            </td>
                            <td className="text-right py-3 px-2">{sitClose > 0 ? <StatusBadge value={Math.round(sitClose)} good={35} ok={25} /> : '-'}</td>
                            <td className="text-right py-3 px-2 text-red-400">{c.CF || 0}</td>
                            <td className="text-right py-3 px-2 text-gray-400">{c.SHAD || 0}</td>
                            <td className="text-right py-3 px-2 text-yellow-400">{c.NOCL || 0}</td>
                            <td className="text-right py-3 px-2 text-gray-400">{c.FUS || 0}</td>
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
