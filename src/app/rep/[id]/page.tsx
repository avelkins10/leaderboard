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
  'hsl(152, 56%, 40%)',
  'hsl(217, 91%, 60%)',
  'hsl(38, 92%, 50%)',
  'hsl(346, 77%, 50%)',
  'hsl(262, 83%, 58%)',
  'hsl(220, 9%, 46%)',
  'hsl(330, 76%, 58%)',
  'hsl(174, 72%, 50%)',
];

const C = {
  fg: 'hsl(224, 71%, 4%)',
  card: 'hsl(0, 0%, 100%)',
  border: 'hsl(220, 13%, 87%)',
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded-xl bg-secondary ${className}`} />;
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
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          {data?.user && (
            <>
              <h1 className="flex items-center gap-3.5 text-2xl font-bold tracking-tight text-foreground">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-card-dark text-base font-bold text-card-dark-foreground">
                  {data.user.name.charAt(0)}
                </span>
                {data.user.name}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> {data.user.role === 'setter' ? 'Setter' : 'Closer'}</span>
                <Link href={`/office/${encodeURIComponent(data.user.office)}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {data.user.office}
                </Link>
                <span className="text-muted-foreground/50">{data.user.region}</span>
              </div>
            </>
          )}
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-[120px]" />)}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">{error}</div>
      )}

      {data && !loading && data.user && (
        <div className="animate-enter space-y-8">
          {data.user.role === 'setter' && data.stats && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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

          {data.user.role === 'closer' && data.stats && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
                        contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.fg, fontSize: 12, fontFamily: 'var(--font-jetbrains)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center gap-1.5">
                  {Object.entries(data.dispositions)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([key, val], i) => (
                      <div key={key} className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-2.5 transition-colors hover:bg-secondary/70">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[13px] text-foreground/80">{key}</span>
                        </div>
                        <span className="text-sm font-semibold font-mono tabular-nums text-foreground">{val as number}</span>
                      </div>
                    ))}
                </div>
              </div>
            </Section>
          )}

          {data.sales && data.sales.length > 0 && (
            <Section title="QuickBase Sales" subtitle={`${data.sales.length} deal${data.sales.length !== 1 ? 's' : ''}`} noPadding>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-2xs uppercase tracking-widest text-muted-foreground">
                      <th className="py-3 px-6 text-left font-medium">Date</th>
                      <th className="py-3 px-3 text-left font-medium">Office</th>
                      <th className="py-3 px-3 text-right font-medium">System (kW)</th>
                      <th className="py-3 px-3 text-right font-medium">Net PPW</th>
                      <th className="py-3 px-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {data.sales.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-border/60 transition-colors hover:bg-secondary/30">
                        <td className="py-3.5 px-6 font-mono tabular-nums text-xs text-foreground">{s.saleDate}</td>
                        <td className="py-3.5 px-3 text-muted-foreground">{s.salesOffice}</td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-foreground">{s.systemSizeKw.toFixed(1)}</td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-foreground">${s.netPpw.toFixed(2)}</td>
                        <td className="py-3.5 px-3">
                          <span className="rounded-md bg-secondary px-2 py-0.5 text-2xs font-medium text-muted-foreground">{s.status}</span>
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
