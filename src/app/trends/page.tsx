'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, CartesianGrid } from 'recharts';
import { Section } from '@/components/Section';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const OFFICE_COLORS: Record<string, string> = {
  'Stevens': 'hsl(152, 76%, 42%)',
  'Bontrager': 'hsl(221, 83%, 53%)',
  'Molina': 'hsl(40, 96%, 53%)',
  'Douglass': 'hsl(0, 84%, 60%)',
  'Elevate': 'hsl(262, 83%, 58%)',
  'Allen': 'hsl(330, 76%, 58%)',
  'Champagne': 'hsl(174, 72%, 50%)',
  'Adams': 'hsl(24, 90%, 50%)',
};

const T = {
  axis: 'hsl(0, 0%, 35%)',
  fg: 'hsl(0, 0%, 93%)',
  grid: 'hsl(0, 0%, 10%)',
  card: 'hsl(0, 0%, 6.5%)',
  border: 'hsl(0, 0%, 12%)',
};

function getColor(name: string): string {
  for (const [key, color] of Object.entries(OFFICE_COLORS)) {
    if (name.includes(key)) return color;
  }
  return 'hsl(0, 0%, 45%)';
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded-xl bg-foreground/5 ${className}`} />;
}

export default function TrendsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<'deals' | 'doors' | 'sits' | 'closes'>('deals');
  const [selectedOffices, setSelectedOffices] = useState<Set<string>>(new Set());
  const [weeks, setWeeks] = useState(4);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/trends?weeks=${weeks}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else {
          setData(d);
          const offices = new Set<string>();
          d.weeks?.forEach((w: any) => Object.keys(w.offices || {}).forEach(o => offices.add(o)));
          setSelectedOffices(offices);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [weeks]);

  const allOffices = new Set<string>();
  data?.weeks?.forEach((w: any) => Object.keys(w.offices || {}).forEach((o: string) => allOffices.add(o)));
  const officeList = Array.from(allOffices).sort();

  const chartData = data?.weeks?.map((w: any) => {
    const point: any = { week: w.week };
    for (const office of officeList) {
      if (selectedOffices.has(office)) {
        point[office] = w.offices?.[office]?.[metric] || 0;
      }
    }
    return point;
  }) || [];

  const companyData = data?.weeks?.map((w: any) => ({
    week: w.week,
    deals: w.totalDeals,
    kw: w.totalKw,
  })) || [];

  const weeklyTrends = officeList.map(office => {
    if (!data?.weeks || data.weeks.length < 2) return { office, trend: 0, current: 0, previous: 0 };
    const current = data.weeks[data.weeks.length - 1]?.offices?.[office]?.[metric] || 0;
    const previous = data.weeks[data.weeks.length - 2]?.offices?.[office]?.[metric] || 0;
    const trend = previous > 0 ? ((current - previous) / previous * 100) : 0;
    return { office, trend, current, previous };
  }).filter(t => t.current > 0 || t.previous > 0).sort((a, b) => b.trend - a.trend);

  const toggleOffice = (office: string) => {
    setSelectedOffices(prev => {
      const next = new Set(prev);
      if (next.has(office)) next.delete(office); else next.add(office);
      return next;
    });
  };

  const metrics = ['deals', 'doors', 'sits', 'closes'] as const;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Trends</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Week-over-week performance tracking</p>
        </div>
        <div className="inline-flex items-center rounded-lg border border-border bg-card">
          {[4, 6, 8].map(w => (
            <button key={w} onClick={() => setWeeks(w)}
              className={`h-8 px-3.5 text-[12px] font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                weeks === w ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {w}w
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-8">
          <Skeleton className="h-52" />
          <Skeleton className="h-80" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">{error}</div>
      )}

      {data && !loading && (
        <div className="animate-fade-up space-y-10">
          {/* Company Total */}
          <Section title="Company Deals" subtitle="Total deals per week across all offices">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={companyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.grid} />
                  <XAxis dataKey="week" tick={{ fill: T.axis, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.axis, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.fg, fontSize: 12, fontFamily: 'var(--font-geist-mono)' }} />
                  <Line type="monotone" dataKey="deals" stroke="hsl(152, 76%, 42%)" strokeWidth={2} dot={{ r: 3, fill: 'hsl(152, 76%, 42%)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-lg border border-border bg-card">
              {metrics.map(m => (
                <button key={m} onClick={() => setMetric(m)}
                  className={`h-8 px-3 text-[12px] font-medium capitalize transition-colors first:rounded-l-lg last:rounded-r-lg ${
                    metric === m ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
            <span className="h-4 w-px bg-border" />
            <div className="flex flex-wrap items-center gap-1.5">
              {officeList.map(o => (
                <button key={o} onClick={() => toggleOffice(o)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                    selectedOffices.has(o) ? 'text-foreground' : 'text-muted-foreground/25 hover:text-muted-foreground/50'
                  }`}
                  style={selectedOffices.has(o) ? { backgroundColor: getColor(o) + '15', color: getColor(o) } : {}}>
                  {o.split(' - ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Office Comparison */}
          <Section title={`${metric.charAt(0).toUpperCase() + metric.slice(1)} by Office`} subtitle="Toggle offices above to compare">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.grid} />
                  <XAxis dataKey="week" tick={{ fill: T.axis, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.axis, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, color: T.fg, fontSize: 12, fontFamily: 'var(--font-geist-mono)' }} />
                  {officeList.filter(o => selectedOffices.has(o)).map(office => (
                    <Line key={office} type="monotone" dataKey={office} stroke={getColor(office)} strokeWidth={2} dot={{ r: 3 }} name={office.split(' - ')[0]} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* WoW Changes */}
          <Section title="Week-over-Week" subtitle={`${metric} compared to previous week`}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {weeklyTrends.map(t => (
                <div key={t.office} className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/15 p-4 transition-colors hover:bg-secondary/30 hover:border-border">
                  <div>
                    <div className="text-[13px] font-medium text-foreground">{t.office.split(' - ')[0]}</div>
                    <div className="mt-0.5 text-[12px] font-mono tabular-nums text-muted-foreground">
                      {t.previous} <span className="text-muted-foreground/30 mx-0.5">{'>'}</span> {t.current}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 text-[13px] font-semibold font-mono tabular-nums ${
                    t.trend > 0 ? 'text-primary' : t.trend < 0 ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {t.trend > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : t.trend < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                    {t.trend > 0 ? '+' : ''}{t.trend.toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
