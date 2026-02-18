'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Cell } from 'recharts';
import { MetricCard } from '@/components/MetricCard';
import { Section } from '@/components/Section';
import { WeekPicker, useWeekDates } from '@/components/WeekPicker';
import { Tooltip } from '@/components/Tooltip';
import { StatusBadge, rateColor } from '@/components/StatusBadge';
import { Target, DollarSign, Zap, Users } from 'lucide-react';

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

function wasteColor(value: number): string {
  if (value >= 30) return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (value >= 15) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Company-wide performance overview</p>
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <span className="ml-3 text-gray-400">Loading scorecard...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-300">Error: {error}</div>
      )}

      {data && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Deals" value={data.summary.totalSales} color="green"
              icon={<Target className="w-5 h-5" />} tooltip="Total closed deals from QuickBase for this period" />
            <MetricCard label="Total kW" value={`${data.summary.totalKw.toFixed(1)}`} color="blue"
              icon={<Zap className="w-5 h-5" />} tooltip="Total kilowatts sold across all offices" />
            <MetricCard label="Avg System" value={`${data.summary.avgSystemSize.toFixed(1)} kW`}
              icon={<DollarSign className="w-5 h-5" />} tooltip="Average system size per deal" />
            <MetricCard label="Avg Net PPW" value={`$${data.summary.avgPpw.toFixed(2)}`}
              icon={<DollarSign className="w-5 h-5" />} tooltip="Average net price per watt across all deals" />
          </div>

          {/* Deals by Office Chart */}
          <Section title="📊 Deals by Office">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#d1d5db', fontSize: 12 }} width={120} />
                  <RTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} />
                  <Bar dataKey="deals" radius={[0, 6, 6, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#10b981' : i < 3 ? '#3b82f6' : '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Office Scorecard Table */}
          <Section title="🏢 Office Scorecard" subtitle="Click an office for detailed breakdown">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-4">Office</th>
                    <th className="text-center py-3 px-2">Active</th>
                    <th className="text-right py-3 px-2">
                      <div className="flex items-center justify-end gap-1">QB Deals <Tooltip text="Verified closed deals from QuickBase" /></div>
                    </th>
                    <th className="text-right py-3 px-2">kW</th>
                    <th className="text-right py-3 px-2">Doors</th>
                    <th className="text-right py-3 px-2">Appts</th>
                    <th className="text-right py-3 px-2">Sits</th>
                    <th className="text-right py-3 px-2">
                      <div className="flex items-center justify-end gap-1">QB Closes <Tooltip text="Verified closes from QuickBase" /></div>
                    </th>
                    <th className="text-right py-3 px-2">
                      <div className="flex items-center justify-end gap-1">RC Claims <Tooltip text="RepCard self-reported closes (Pending KCA)" /></div>
                    </th>
                    <th className="text-right py-3 px-2">
                      <div className="flex items-center justify-end gap-1">Sit/Close <Tooltip text="QB Closes ÷ Sits. Target: 35%+" /></div>
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
                      <tr key={office} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${qbCloses === 0 ? 'opacity-60' : ''}`}>
                        <td className="py-3 px-4">
                          <Link href={`/office/${encodeURIComponent(office)}`} className="font-medium hover:text-blue-400 transition">
                            {office}
                            {qbCloses === 0 && <span className="ml-2 text-xs text-red-400">⚠ 0 deals</span>}
                          </Link>
                        </td>
                        <td className="text-center py-3 px-2">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${activeReps > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                            {activeReps > 0 ? '🟢' : '⚪'} {activeReps}
                          </span>
                        </td>
                        <td className="text-right py-3 px-2 font-bold text-emerald-400">{qbCloses}</td>
                        <td className="text-right py-3 px-2 text-gray-300">{(d.sales?.kw || 0).toFixed(1)}</td>
                        <td className="text-right py-3 px-2">{totalDoors}</td>
                        <td className="text-right py-3 px-2">{totalAppts}</td>
                        <td className="text-right py-3 px-2">{totalSits}</td>
                        <td className="text-right py-3 px-2 font-bold text-emerald-400">{qbCloses}</td>
                        <td className="text-right py-3 px-2">
                          <span className={rcClaims > qbCloses ? 'text-yellow-400 font-bold' : 'text-gray-400'}>
                            {rcClaims}
                            {rcClaims > qbCloses && <span className="text-xs ml-1 text-red-400">+{rcClaims - qbCloses}</span>}
                          </span>
                        </td>
                        <td className="text-right py-3 px-2">
                          {totalSits > 0 ? <StatusBadge value={Math.round(sitClose)} good={35} ok={25} /> : <span className="text-gray-600">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-700 font-bold">
                    <td className="py-3 px-4 text-gray-300">TOTAL</td>
                    <td className="text-center py-3 px-2 text-gray-400">
                      {officeEntries.reduce((s, [, d]) => s + (d.activeReps || 0), 0)}
                    </td>
                    <td className="text-right py-3 px-2 text-emerald-400">{data.summary.totalSales}</td>
                    <td className="text-right py-3 px-2">{data.summary.totalKw.toFixed(1)}</td>
                    <td className="text-right py-3 px-2">{officeEntries.reduce((s, [, d]) => s + (d.setters?.reduce((a: number, r: any) => a + (r.DK || 0), 0) || 0), 0)}</td>
                    <td className="text-right py-3 px-2">{officeEntries.reduce((s, [, d]) => s + (d.setters?.reduce((a: number, r: any) => a + (r.APPT || 0), 0) || 0), 0)}</td>
                    <td className="text-right py-3 px-2">{officeEntries.reduce((s, [, d]) => s + (d.closers?.reduce((a: number, r: any) => a + (r.SAT || 0), 0) || 0), 0)}</td>
                    <td className="text-right py-3 px-2 text-emerald-400">{data.summary.totalSales}</td>
                    <td className="text-right py-3 px-2 text-gray-400">{officeEntries.reduce((s, [, d]) => s + (d.closers?.reduce((a: number, r: any) => a + (r.CLOS || 0), 0) || 0), 0)}</td>
                    <td className="text-right py-3 px-2">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>

          {/* Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="🎯 Top Closers" subtitle="Ranked by QB verified closes">
              <div className="space-y-1">
                {data.closerLeaderboard
                  .filter(c => (c.SAT || 0) > 0 || (c.qbCloses || 0) > 0)
                  .sort((a, b) => (b.qbCloses || 0) - (a.qbCloses || 0))
                  .slice(0, 10)
                  .map((c, i) => {
                    const sitClose = (c.SAT || 0) > 0 ? ((c.qbCloses || 0) / c.SAT) * 100 : 0;
                    return (
                      <Link key={c.userId} href={`/rep/${c.userId}`}
                        className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-800/50 group">
                        <div className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800 text-gray-500'}`}>{i + 1}</span>
                          <div>
                            <span className="font-medium group-hover:text-blue-400 transition">{c.name}</span>
                            <span className="text-gray-600 text-xs ml-2">{c.qbOffice?.split(' - ')[0]}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-gray-500">{c.SAT || 0} sits</span>
                          <span className="font-bold text-emerald-400">{c.qbCloses || 0} QB</span>
                          {(c.CLOS || 0) > (c.qbCloses || 0) && (
                            <span className="text-yellow-400 text-xs">({c.CLOS} claimed)</span>
                          )}
                          {sitClose > 0 && <StatusBadge value={Math.round(sitClose)} good={35} ok={25} />}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </Section>

            <Section title="🚪 Top Setters" subtitle="Ranked by appointments set">
              <div className="space-y-1">
                {data.setterLeaderboard
                  .filter(s => (s.DK || 0) > 0 || (s.APPT || 0) > 0)
                  .sort((a, b) => (b.APPT || 0) - (a.APPT || 0) || (b.DK || 0) - (a.DK || 0))
                  .slice(0, 10)
                  .map((s, i) => (
                    <Link key={s.userId} href={`/rep/${s.userId}`}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-800/50 group">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>{i + 1}</span>
                        <div>
                          <span className="font-medium group-hover:text-blue-400 transition">{s.name}</span>
                          <span className="text-gray-600 text-xs ml-2">{s.qbOffice?.split(' - ')[0]}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500">{s.DK || 0} doors</span>
                        <span className="font-bold text-emerald-400">{s.APPT || 0} appts</span>
                        <span className="text-blue-400">{s.SITS || 0} sits</span>
                      </div>
                    </Link>
                  ))}
              </div>
            </Section>
          </div>

          {/* QB Sales by Closer */}
          <Section title="💰 QB Sales by Closer" subtitle="Deals from QuickBase records">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(data.salesByCloser)
                .sort(([, a]: any, [, b]: any) => b.deals - a.deals)
                .map(([name, d]: [string, any]) => (
                  <div key={name} className="bg-gray-800/50 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition">
                    <div className="font-medium text-sm">{name}</div>
                    <div className="text-xs text-gray-500">{d.office}</div>
                    <div className="mt-2 flex items-center gap-3 text-sm">
                      <span className="text-emerald-400 font-bold">{d.deals} deals</span>
                      <span className="text-gray-500">{d.kw.toFixed(1)} kW</span>
                    </div>
                  </div>
                ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
