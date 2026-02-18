'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { Section } from '@/components/Section';
import { MetricCard } from '@/components/MetricCard';
import { WeekPicker, useWeekDates } from '@/components/WeekPicker';
import { ArrowLeft, Briefcase, MapPin } from 'lucide-react';

const PIE_COLORS = [
  'hsl(152, 76%, 42%)',
  'hsl(221, 83%, 53%)',
  'hsl(40, 96%, 53%)',
  'hsl(0, 84%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(0, 0%, 45%)',
  'hsl(330, 76%, 58%)',
  'hsl(174, 72%, 50%)',
];

const T = {
  fg: 'hsl(0, 0%, 93%)',
  card: 'hsl(0, 0%, 6.5%)',
  border: 'hsl(0, 0%, 12%)',
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded-xl bg-foreground/5 ${className}`} />;
}

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
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          {data?.user && (
            <>
              <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-foreground">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-[15px] font-bold text-primary">
                  {data.user.name.charAt(0)}
                </span>
                {data.user.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> {data.user.role === 'setter' ? 'Setter' : 'Closer'}</span>
                <Link href={`/office/${encodeURIComponent(data.user.office)}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {data.user.office}
                </Link>
                <span className="text-muted-foreground/40">{data.user.region}</span>
              </div>
            </>
          )}
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-[104px]" />)}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">{error}</div>
      )}

      {data && !loading && data.user && (
        <div className="animate-fade-up space-y-10">
          {/* Setter Stats */}
          {data.user.role === 'setter' && data.stats && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <MetricCard label="Doors" value={data.stats.DK || 0} tooltip="Total unique doors knocked" />
              <MetricCard label="Appointments" value={data.stats.APPT || 0} color="blue" tooltip="Appointments set" />
              <MetricCard label="Sits" value={data.stats.SITS || 0} color="blue" tooltip="Appointments that sat" />
              <MetricCard label="Closes" value={data.stats.CLOS || 0} color="green" tooltip="Closed (Pending KCA)" />
              <MetricCard label="Sit %" value={`${data.stats['SIT%'] || 0}%`}
                color={(data.stats['SIT%'] || 0) >= 50 ? 'green' : (data.stats['SIT%'] || 0) >= 30 ? 'yellow' : 'red'}
                tooltip="Set to Sit percentage" />
              <MetricCard label="D/$" value={data.stats['D/$'] || '-'} tooltip="Doors to deal ratio" />
            </div>
          )}

          {/* Closer Stats */}
          {data.user.role === 'closer' && data.stats && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <MetricCard label="Leads" value={data.stats.LEAD || 0} tooltip="Assigned leads" />
              <MetricCard label="Sits" value={data.stats.SAT || 0} color="blue" tooltip="Appointments sat" />
              <MetricCard label="Closes" value={data.stats.CLOS || 0} color="green" tooltip="Closed (Pending KCA)" />
              <MetricCard label="Close %" value={`${data.stats.CLSE || 0}%`}
                color={(data.stats.CLSE || 0) >= 35 ? 'green' : (data.stats.CLSE || 0) >= 25 ? 'yellow' : 'red'}
                tooltip="Sit/Close %. Target: 35%+" />
              <MetricCard label="Credit Fails" value={data.stats.CF || 0} color="red" tooltip="Credit fails" />
              <MetricCard label="Follow Ups" value={data.stats.FUS || 0} tooltip="Follow ups scheduled" />
            </div>
          )}

          {/* Disposition Chart */}
          {data.user.role === 'closer' && Object.keys(data.dispositions).length > 0 && (
            <Section title="Dispositions" subtitle="How appointments resolved">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(data.dispositions)
                          .filter(([k]) => !['LEAD'].includes(k))
                          .map(([k, v]) => ({ name: k, value: v as number }))}
                        cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                        paddingAngle={3} dataKey="value" strokeWidth={0}
                      >
                        {Object.entries(data.dispositions).map(([,], i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip
                        contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.fg, fontSize: 12, fontFamily: 'var(--font-geist-mono)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center gap-1.5">
                  {Object.entries(data.dispositions)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([key, val], i) => (
                      <div key={key} className="flex items-center justify-between rounded-lg bg-secondary/30 px-4 py-2.5 transition-colors hover:bg-secondary/50">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[13px] text-foreground/80">{key}</span>
                        </div>
                        <span className="text-[13px] font-semibold font-mono tabular-nums text-foreground">{val as number}</span>
                      </div>
                    ))}
                </div>
              </div>
            </Section>
          )}

          {/* QB Sales Table */}
          {data.sales && data.sales.length > 0 && (
            <Section title="QuickBase Sales" subtitle={`${data.sales.length} deal${data.sales.length !== 1 ? 's' : ''}`} noPadding>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="py-3 px-6 text-left font-medium">Date</th>
                      <th className="py-3 px-3 text-left font-medium">Office</th>
                      <th className="py-3 px-3 text-right font-medium">System (kW)</th>
                      <th className="py-3 px-3 text-right font-medium">Net PPW</th>
                      <th className="py-3 px-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                        <td className="py-3 px-6 font-mono tabular-nums text-[12px] text-foreground">{s.saleDate}</td>
                        <td className="py-3 px-3 text-muted-foreground">{s.salesOffice}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-foreground">{s.systemSizeKw.toFixed(1)}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-foreground">${s.netPpw.toFixed(2)}</td>
                        <td className="py-3 px-3">
                          <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
