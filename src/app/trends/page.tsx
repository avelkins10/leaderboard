'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Legend, CartesianGrid } from 'recharts';
import { Section } from '@/components/Section';
import { TrendingUp, TrendingDown } from 'lucide-react';

const OFFICE_COLORS: Record<string, string> = {
  'Stevens': 'hsl(142, 71%, 45%)',
  'Bontrager': 'hsl(217, 91%, 60%)',
  'Molina': 'hsl(38, 92%, 50%)',
  'Douglass': 'hsl(0, 84%, 60%)',
  'Elevate': 'hsl(262, 83%, 58%)',
  'Allen': 'hsl(330, 81%, 60%)',
  'Champagne': 'hsl(174, 72%, 56%)',
  'Adams': 'hsl(24, 95%, 53%)',
};

function getColor(name: string): string {
  for (const [key, color] of Object.entries(OFFICE_COLORS)) {
    if (name.includes(key)) return color;
  }
  return 'hsl(220, 9%, 46%)';
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Trends & Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Week-over-week performance tracking</p>
        </div>
        <div className="flex items-center gap-1.5">
          {[4, 6, 8].map(w => (
            <button key={w} onClick={() => setWeeks(w)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                weeks === w ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}>
              {w} weeks
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          <span className="ml-3 text-muted-foreground text-sm">Loading trends (fetching {weeks} weeks)...</span>
        </div>
      )}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">Error: {error}</div>
      )}

      {data && !loading && (
        <>
          {/* Company-wide */}
          <Section title="Company-Wide Deals" subtitle="Total deals per week across all offices">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={companyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 10%, 14%)" />
                  <XAxis dataKey="week" tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ background: 'hsl(224, 10%, 8%)', border: '1px solid hsl(224, 10%, 14%)', borderRadius: 6, color: 'hsl(0, 0%, 95%)', fontSize: 12 }} />
                  <Line type="monotone" dataKey="deals" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 4, fill: 'hsl(142, 71%, 45%)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Metric Selector + Office Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium mr-1">Metric:</span>
            {(['deals', 'doors', 'sits', 'closes'] as const).map(m => (
              <button key={m} onClick={() => setMetric(m)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  metric === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}>
                {m}
              </button>
            ))}
            <span className="w-px h-5 bg-border mx-1" />
            <span className="text-muted-foreground text-xs font-medium mr-1">Offices:</span>
            {officeList.map(o => (
              <button key={o} onClick={() => toggleOffice(o)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                  selectedOffices.has(o) ? 'border-border text-foreground' : 'border-transparent text-muted-foreground/50'
                }`}
                style={selectedOffices.has(o) ? { backgroundColor: getColor(o) + '15', borderColor: getColor(o) + '30' } : {}}>
                {o.split(' - ')[0]}
              </button>
            ))}
          </div>

          {/* Office Comparison Chart */}
          <Section title={`${metric.charAt(0).toUpperCase() + metric.slice(1)} by Office`} subtitle="Click offices above to compare">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(224, 10%, 14%)" />
                  <XAxis dataKey="week" tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <RTooltip contentStyle={{ background: 'hsl(224, 10%, 8%)', border: '1px solid hsl(224, 10%, 14%)', borderRadius: 6, color: 'hsl(0, 0%, 95%)', fontSize: 12 }} />
                  <Legend formatter={(v) => <span className="text-foreground/70 text-xs">{(v as string).split(' - ')[0]}</span>} />
                  {officeList.filter(o => selectedOffices.has(o)).map(office => (
                    <Line key={office} type="monotone" dataKey={office} stroke={getColor(office)} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Trend Summary */}
          <Section title="Week-over-Week Changes" subtitle={`${metric} compared to previous week`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {weeklyTrends.map(t => (
                <div key={t.office} className="flex items-center justify-between bg-secondary/50 border border-border rounded-md p-3">
                  <div>
                    <div className="font-medium text-sm text-foreground">{t.office.split(' - ')[0]}</div>
                    <div className="text-muted-foreground text-xs font-mono">{t.previous} {'-> '} {t.current}</div>
                  </div>
                  <div className={`flex items-center gap-1 font-bold text-sm font-mono ${
                    t.trend > 0 ? 'text-primary' : t.trend < 0 ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {t.trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : t.trend < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
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
