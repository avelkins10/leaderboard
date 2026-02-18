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
  'hsl(160, 84%, 39%)',
  'hsl(213, 94%, 58%)',
  'hsl(43, 96%, 56%)',
  'hsl(0, 72%, 51%)',
  'hsl(270, 76%, 58%)',
  'hsl(0, 0%, 50%)',
  'hsl(330, 76%, 58%)',
  'hsl(174, 72%, 50%)',
];

const CHART_STYLE = {
  fg: 'hsl(0, 0%, 93%)',
  tooltipBg: 'hsl(0, 0%, 7%)',
  tooltipBorder: 'hsl(0, 0%, 13%)',
};

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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-default hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          {data?.user && (
            <>
              <h1 className="flex items-center gap-3 text-lg font-semibold tracking-tight text-foreground">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-[15px] font-bold text-primary">
                  {data.user.name.charAt(0)}
                </span>
                {data.user.name}
              </h1>
              <div className="mt-2 flex items-center gap-3 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" /> {data.user.role === 'setter' ? 'Setter' : 'Closer'}</span>
                <Link href={`/office/${encodeURIComponent(data.user.office)}`} className="inline-flex items-center gap-1 transition-default hover:text-foreground">
                  <MapPin className="h-3 w-3" /> {data.user.office}
                </Link>
                <span className="text-muted-foreground/50">{data.user.region}</span>
              </div>
            </>
          )}
        </div>
        <WeekPicker weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[88px] animate-pulse-subtle rounded-lg border border-border bg-card" />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">{error}</div>
      )}

      {data && !loading && data.user && (
        <>
          {/* Setter Stats */}
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

          {/* Closer Stats */}
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

          {/* Disposition Chart */}
          {data.user.role === 'closer' && Object.keys(data.dispositions).length > 0 && (
            <Section title="Dispositions" subtitle="How appointments resolved">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(data.dispositions)
                          .filter(([k]) => !['LEAD'].includes(k))
                          .map(([k, v]) => ({ name: k, value: v as number }))}
                        cx="50%" cy="50%" innerRadius={45} outerRadius={80}
                        paddingAngle={2} dataKey="value" strokeWidth={0}
                      >
                        {Object.entries(data.dispositions).map(([,], i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip
                        contentStyle={{ background: CHART_STYLE.tooltipBg, border: `1px solid ${CHART_STYLE.tooltipBorder}`, borderRadius: 8, color: CHART_STYLE.fg, fontSize: 12, fontFamily: 'var(--font-geist-mono)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1">
                  {Object.entries(data.dispositions)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([key, val], i) => (
                      <div key={key} className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[13px] text-foreground/80">{key}</span>
                        </div>
                        <span className="text-[13px] font-semibold font-mono text-foreground">{val as number}</span>
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
                    <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-3 px-5 text-left font-medium">Date</th>
                      <th className="py-3 px-3 text-left font-medium">Office</th>
                      <th className="py-3 px-3 text-right font-medium">System (kW)</th>
                      <th className="py-3 px-3 text-right font-medium">Net PPW</th>
                      <th className="py-3 px-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 transition-default hover:bg-secondary/30">
                        <td className="py-2.5 px-5 font-mono text-[12px] text-foreground">{s.saleDate}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{s.salesOffice}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground">{s.systemSizeKw.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground">${s.netPpw.toFixed(2)}</td>
                        <td className="py-2.5 px-3">
                          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{s.status}</span>
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
