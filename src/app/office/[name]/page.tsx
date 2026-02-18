'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Section } from '@/components/Section';
import { MetricCard } from '@/components/MetricCard';
import { WeekPicker, useWeekDates } from '@/components/WeekPicker';
import { FunnelChart } from '@/components/FunnelChart';
import { StatusBadge, rateColor } from '@/components/StatusBadge';
import { Tooltip } from '@/components/Tooltip';
import { ArrowLeft, MapPin, Users, Target } from 'lucide-react';

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
          <h1 className="text-2xl font-bold">{officeName}</h1>
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
            <MetricCard label="Deals" value={data.summary.deals} color="green" icon={<Target className="w-5 h-5" />} />
            <MetricCard label="kW Sold" value={`${data.summary.kw.toFixed(1)}`} color="blue" />
            <MetricCard label="Avg PPW" value={`$${data.summary.avgPpw.toFixed(2)}`} />
            <MetricCard label="Setters" value={data.setters.length} icon={<Users className="w-5 h-5" />} />
            <MetricCard label="Closers" value={data.closers.length} icon={<Users className="w-5 h-5" />} />
          </div>

          {/* Funnel */}
          <Section title="📊 Sales Funnel" subtitle="Doors → Appointments → Sits → Closes">
            <FunnelChart steps={[
              { label: 'Doors Knocked', value: data.funnel.doors, color: '#6b7280' },
              { label: 'Appointments Set', value: data.funnel.appointments, color: '#8b5cf6' },
              { label: 'Appointments Sat', value: data.funnel.sits, color: '#3b82f6' },
              { label: 'Closed', value: data.funnel.closes, color: '#10b981' },
            ]} />
          </Section>

          {/* Setter Table */}
          <Section title="🚪 Setters" subtitle="Ranked by doors knocked">
            {data.setters.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No setter data for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase tracking-wider">
                      <th className="text-left py-3 px-4">#</th>
                      <th className="text-left py-3 px-2">Name</th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">DK <Tooltip text="Doors Knocked: Total unique doors your team knocked this period" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">APPT <Tooltip text="Appointments Set" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">SITS <Tooltip text="Appointments that were actually sat" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">CLOS <Tooltip text="Closed (Pending KCA)" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">SIT% <Tooltip text="Set to Sit percentage" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">D/$ <Tooltip text="Doors knocked per deal. Lower = more efficient" /></div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.setters
                      .sort((a: any, b: any) => (b.DK || 0) - (a.DK || 0))
                      .map((s: any, i: number) => {
                        const sitPct = (s.APPT || 0) > 0 ? ((s.SITS || 0) / s.APPT * 100) : 0;
                        const dpd = (s.CLOS || 0) > 0 ? ((s.DK || 0) / s.CLOS) : 0;
                        return (
                          <tr key={s.userId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                            <td className="py-3 px-2">
                              <Link href={`/rep/${s.userId}`} className="font-medium hover:text-blue-400 transition">{s.name}</Link>
                            </td>
                            <td className="text-right py-3 px-2 font-bold">{s.DK || 0}</td>
                            <td className="text-right py-3 px-2 text-purple-400">{s.APPT || 0}</td>
                            <td className="text-right py-3 px-2 text-blue-400">{s.SITS || 0}</td>
                            <td className="text-right py-3 px-2 text-emerald-400 font-bold">{s.CLOS || 0}</td>
                            <td className="text-right py-3 px-2">{sitPct > 0 ? <StatusBadge value={Math.round(sitPct)} good={50} ok={30} /> : '-'}</td>
                            <td className="text-right py-3 px-2 text-gray-400">{dpd > 0 ? dpd.toFixed(0) : '-'}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Closer Table */}
          <Section title="🎯 Closers" subtitle="Ranked by closes">
            {data.closers.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No closer data for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase tracking-wider">
                      <th className="text-left py-3 px-4">#</th>
                      <th className="text-left py-3 px-2">Name</th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">LEAD <Tooltip text="Assigned Leads" /></div></th>
                      <th className="text-right py-3 px-2">SAT</th>
                      <th className="text-right py-3 px-2">CLOS</th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">CLSE% <Tooltip text="Sit/Close %. Target: 35%+" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">CF <Tooltip text="Credit Fails" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">NOCL <Tooltip text="No Close — sat but didn't close" /></div></th>
                      <th className="text-right py-3 px-2"><div className="flex items-center justify-end gap-1">FUS <Tooltip text="Follow Ups scheduled" /></div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.closers
                      .sort((a: any, b: any) => (b.CLOS || 0) - (a.CLOS || 0))
                      .map((c: any, i: number) => {
                        const clsePct = (c.SAT || 0) > 0 ? ((c.CLOS || 0) / c.SAT * 100) : 0;
                        return (
                          <tr key={c.userId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                            <td className="py-3 px-2">
                              <Link href={`/rep/${c.userId}`} className="font-medium hover:text-blue-400 transition">{c.name}</Link>
                            </td>
                            <td className="text-right py-3 px-2">{c.LEAD || 0}</td>
                            <td className="text-right py-3 px-2 text-blue-400">{c.SAT || 0}</td>
                            <td className="text-right py-3 px-2 text-emerald-400 font-bold">{c.CLOS || 0}</td>
                            <td className="text-right py-3 px-2">{clsePct > 0 ? <StatusBadge value={Math.round(clsePct)} good={35} ok={25} /> : '-'}</td>
                            <td className="text-right py-3 px-2 text-red-400">{c.CF || 0}</td>
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
