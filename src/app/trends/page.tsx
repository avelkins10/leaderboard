'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, CartesianGrid } from 'recharts';
import { Section } from '@/components/Section';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const OFFICE_COLORS: Record<string, string> = {
  'Stevens': 'hsl(160, 84%, 39%)',
  'Bontrager': 'hsl(213, 94%, 58%)',
  'Molina': 'hsl(43, 96%, 56%)',
  'Douglass': 'hsl(0, 72%, 51%)',
  'Elevate': 'hsl(270, 76%, 58%)',
  'Allen': 'hsl(330, 76%, 58%)',
  'Champagne': 'hsl(174, 72%, 50%)',
  'Adams': 'hsl(24, 90%, 50%)',
};

const CHART_STYLE = {
  axis: 'hsl(0, 0%, 50%)',
  fg: 'hsl(0, 0%, 93%)',
  grid: 'hsl(0, 0%, 13%)',
  tooltipBg: 'hsl(0, 0%, 7%)',
  tooltipBorder: 'hsl(0, 0%, 13%)',
};

function getColor(name: string): string {
  for (const [key, color] of Object.entries(OFFICE_COLORS)) {
    if (name.includes(key)) return color;
  }
  return 'hsl(0, 0%, 50%)';
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Trends</h1>
          <p className="text-[13px] text-muted-foreground">Week-over-week performance tracking</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {[4, 6, 8].map(w => (
            <button key={w} onClick={() => setWeeks(w)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-default ${
                weeks === w ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {w}w
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="h-[220px] animate-pulse-subtle rounded-lg border border-border bg-card" />
          <div className="h-[340px] animate-pulse-subtle rounded-lg border border-border bg-card" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">{error}</div>
      )}

      {data && !loading && (
        <>
          {/* Company Total */}
          <Section title="Company Deals" subtitle="Total deals per week across all offices">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={companyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
                  <XAxis dataKey="week" tick={{ fill: CHART_STYLE.axis, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: CHART_STYLE.axis, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
                  <RTooltip
                    contentStyle={{ background: CHART_STYLE.tooltipBg, border: `1px solid ${CHART_STYLE.tooltipBorder}`, borderRadius: 8, color: CHART_STYLE.fg, fontSize: 12, fontFamily: 'var(--font-geist-mono)' }}
                  />
                  <Line type="monotone" dataKey="deals" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={{ r: 3, fill: 'hsl(160, 84%, 39%)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              {metrics.map(m => (
                <button key={m} onClick={() => setMetric(m)}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-medium capitalize transition-default ${
                    metric === m ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
            <span className="h-4 w-px bg-border" />
            <div className="flex flex-wrap items-center gap-1">
              {officeList.map(o => (
                <button key={o} onClick={() => toggleOffice(o)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-default ${
                    selectedOffices.has(o) ? 'border-border text-foreground' : 'border-transparent text-muted-foreground/40 hover:text-muted-foreground'
                  }`}
                  style={selectedOffices.has(o) ? { backgroundColor: getColor(o) + '15', borderColor: getColor(o) + '25' } : {}}>
                  {o.split(' - ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Office Comparison */}
          <Section title={`${metric.charAt(0).toUpperCase() + metric.slice(1)} by Office`} subtitle="Toggle offices above to compare">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
                  <XAxis dataKey="week" tick={{ fill: CHART_STYLE.axis, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: CHART_STYLE.axis, fontSize: 11, fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
                  <RTooltip
                    contentStyle={{ background: CHART_STYLE.tooltipBg, border: `1px solid ${CHART_STYLE.tooltipBorder}`, borderRadius: 8, color: CHART_STYLE.fg, fontSize: 12, fontFamily: 'var(--font-geist-mono)' }}
                  />
                  {officeList.filter(o => selectedOffices.has(o)).map(office => (
                    <Line key={office} type="monotone" dataKey={office} stroke={getColor(office)} strokeWidth={2} dot={{ r: 3 }} name={office.split(' - ')[0]} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* WoW Changes */}
          <Section title="Week-over-Week" subtitle={`${metric} compared to previous week`}>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {weeklyTrends.map(t => (
                <div key={t.office} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 transition-default hover:bg-secondary/50">
                  <div>
                    <div className="text-[13px] font-medium text-foreground">{t.office.split(' - ')[0]}</div>
                    <div className="text-[12px] font-mono text-muted-foreground">
                      {t.previous} <span className="text-muted-foreground/40">{'>'}</span> {t.current}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-[13px] font-semibold font-mono ${
                    t.trend > 0 ? 'text-primary' : t.trend < 0 ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {t.trend > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : t.trend < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                    {t.trend > 0 ? '+' : ''}{t.trend.toFixed(0)}%
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
