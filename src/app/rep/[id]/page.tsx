'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RTooltip } from 'recharts';
import { Section } from '@/components/Section';
import { MetricCard } from '@/components/MetricCard';
import { WeekPicker, useWeekDates } from '@/components/WeekPicker';
import { ArrowLeft, MapPin, Briefcase } from 'lucide-react';

const PIE_COLORS = [
  'hsl(142, 71%, 45%)',
  'hsl(217, 91%, 60%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(220, 9%, 46%)',
  'hsl(330, 81%, 60%)',
  'hsl(174, 72%, 56%)',
];

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-2 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          {data?.user && (
            <>
              <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center text-base font-bold text-primary">
                  {data.user.name.charAt(0)}
                </span>
                {data.user.name}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {data.user.role === 'setter' ? 'Setter' : 'Closer'}</span>
                <Link href={`/office/${encodeURIComponent(data.user.office)}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <MapPin className="w-3 h-3" /> {data.user.office}
                </Link>
                <span className="text-muted-foreground/60">{data.user.region}</span>
              </div>
            </>
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

      {data && !loading && data.user && (
        <>
          {/* Stats Cards - Setter */}
          {data.user.role === 'setter' && data.stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

          {/* Stats Cards - Closer */}
          {data.user.role === 'closer' && data.stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
            <Section title="Disposition Breakdown" subtitle="How appointments resolved">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(data.dispositions)
                          .filter(([k]) => !['LEAD'].includes(k))
                          .map(([k, v]) => ({ name: k, value: v as number }))}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                        paddingAngle={2} dataKey="value"
                      >
                        {Object.entries(data.dispositions).map(([,], i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend formatter={(value) => <span className="text-foreground/70 text-xs">{value}</span>} />
                      <RTooltip contentStyle={{ background: 'hsl(224, 10%, 8%)', border: '1px solid hsl(224, 10%, 14%)', borderRadius: 6, color: 'hsl(0, 0%, 95%)', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(data.dispositions)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([key, val], i) => (
                      <div key={key} className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-md">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-sm text-foreground/80">{key}</span>
                        </div>
                        <span className="font-bold text-sm font-mono text-foreground">{val as number}</span>
                      </div>
                    ))}
                </div>
              </div>
            </Section>
          )}

          {/* QB Sales */}
          {data.sales && data.sales.length > 0 && (
            <Section title="QuickBase Sales" subtitle={`${data.sales.length} deals found`}>
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border text-[11px] uppercase tracking-wider">
                      <th className="text-left py-3 px-5 font-medium">Date</th>
                      <th className="text-left py-3 px-2 font-medium">Office</th>
                      <th className="text-right py-3 px-2 font-medium">System (kW)</th>
                      <th className="text-right py-3 px-2 font-medium">Net PPW</th>
                      <th className="text-left py-3 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-5 text-foreground font-mono text-xs">{s.saleDate}</td>
                        <td className="py-3 px-2 text-muted-foreground">{s.salesOffice}</td>
                        <td className="text-right py-3 px-2 font-mono text-foreground">{s.systemSizeKw.toFixed(1)}</td>
                        <td className="text-right py-3 px-2 font-mono text-foreground">${s.netPpw.toFixed(2)}</td>
                        <td className="py-3 px-3">
                          <span className="text-xs px-1.5 py-0.5 bg-secondary border border-border rounded text-muted-foreground">{s.status}</span>
                        </td>
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
