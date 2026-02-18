'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RTooltip } from 'recharts';
import { Section } from '@/components/Section';
import { MetricCard } from '@/components/MetricCard';
import { WeekPicker, useWeekDates } from '@/components/WeekPicker';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowLeft, User, MapPin, Briefcase } from 'lucide-react';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6'];

export default function RepPage() {
  const params = useParams();
  const repId = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const { from, to } = useWeekDates(weekOffset);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/rep/${repId}?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [repId, from, to]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-gray-500 hover:text-white text-sm flex items-center gap-1 mb-2 transition">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          {data?.user && (
            <>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-bold">
                  {data.user.name.charAt(0)}
                </span>
                {data.user.name}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {data.user.role === 'setter' ? 'Setter' : 'Closer'}</span>
                <Link href={`/office/${encodeURIComponent(data.user.office)}`} className="flex items-center gap-1 hover:text-white transition">
                  <MapPin className="w-3 h-3" /> {data.user.office}
                </Link>
                <span>{data.user.region}</span>
              </div>
            </>
          )}
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /><span className="ml-3 text-gray-400">Loading...</span></div>}
      {error && <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-300">Error: {error}</div>}

      {data && !loading && data.user && (
        <>
          {/* Stats Cards */}
          {data.user.role === 'setter' && data.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <MetricCard label="Doors Knocked" value={data.stats.DK || 0} tooltip="Total unique doors knocked this period" />
              <MetricCard label="Appointments" value={data.stats.APPT || 0} color="blue" tooltip="Appointments set" />
              <MetricCard label="Sits" value={data.stats.SITS || 0} color="blue" tooltip="Appointments that were sat" />
              <MetricCard label="Closes" value={data.stats.CLOS || 0} color="green" tooltip="Closed (Pending KCA)" />
              <MetricCard label="Sit %" value={`${data.stats['SIT%'] || 0}%`}
                color={(data.stats['SIT%'] || 0) >= 50 ? 'green' : (data.stats['SIT%'] || 0) >= 30 ? 'yellow' : 'red'}
                tooltip="Set to Sit percentage" />
              <MetricCard label="D/$" value={data.stats['D/$'] || '-'} tooltip="Doors to deal ratio" />
            </div>
          )}

          {data.user.role === 'closer' && data.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <MetricCard label="Leads" value={data.stats.LEAD || 0} tooltip="Assigned leads" />
              <MetricCard label="Sits" value={data.stats.SAT || 0} color="blue" tooltip="Appointments sat" />
              <MetricCard label="Closes" value={data.stats.CLOS || 0} color="green" tooltip="Closed (Pending KCA)" />
              <MetricCard label="Close %" value={`${data.stats.CLSE || 0}%`}
                color={(data.stats.CLSE || 0) >= 35 ? 'green' : (data.stats.CLSE || 0) >= 25 ? 'yellow' : 'red'}
                tooltip="Sit/Close %. Target: 35%+" />
              <MetricCard label="Credit Fails" value={data.stats.CF || 0} color="red" tooltip="Credit Fails" />
              <MetricCard label="Follow Ups" value={data.stats.FUS || 0} tooltip="Follow ups scheduled" />
            </div>
          )}

          {/* Disposition Breakdown for Closers */}
          {data.user.role === 'closer' && Object.keys(data.dispositions).length > 0 && (
            <Section title="📊 Disposition Breakdown" subtitle="How appointments resolved">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(data.dispositions)
                          .filter(([k]) => !['LEAD'].includes(k))
                          .map(([k, v]) => ({ name: k, value: v as number }))}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                        paddingAngle={2} dataKey="value"
                      >
                        {Object.entries(data.dispositions).map(([, ], i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend formatter={(value) => <span className="text-gray-300 text-xs">{value}</span>} />
                      <RTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {Object.entries(data.dispositions)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([key, val], i) => (
                      <div key={key} className="flex items-center justify-between py-2 px-3 bg-gray-800/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-sm text-gray-300">{key}</span>
                        </div>
                        <span className="font-bold text-sm">{val as number}</span>
                      </div>
                    ))}
                </div>
              </div>
            </Section>
          )}

          {/* QB Sales */}
          {data.sales && data.sales.length > 0 && (
            <Section title="💰 QuickBase Sales" subtitle={`${data.sales.length} deals found`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase tracking-wider">
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-2">Office</th>
                      <th className="text-right py-3 px-2">System (kW)</th>
                      <th className="text-right py-3 px-2">Net PPW</th>
                      <th className="text-left py-3 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-3 px-4">{s.saleDate}</td>
                        <td className="py-3 px-2 text-gray-400">{s.salesOffice}</td>
                        <td className="text-right py-3 px-2">{s.systemSizeKw.toFixed(1)}</td>
                        <td className="text-right py-3 px-2">${s.netPpw.toFixed(2)}</td>
                        <td className="py-3 px-2"><span className="text-xs px-2 py-0.5 bg-gray-800 rounded-md">{s.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
