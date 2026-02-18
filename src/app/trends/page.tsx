'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Legend, CartesianGrid } from 'recharts';
import { Section } from '@/components/Section';
import { TrendingUp, TrendingDown } from 'lucide-react';

const OFFICE_COLORS: Record<string, string> = {
  'Stevens': '#10b981',
  'Bontrager': '#3b82f6',
  'Molina': '#f59e0b',
  'Douglass': '#ef4444',
  'Elevate': '#8b5cf6',
  'Allen': '#ec4899',
  'Champagne': '#14b8a6',
  'Adams': '#f97316',
};

function getColor(name: string): string {
  for (const [key, color] of Object.entries(OFFICE_COLORS)) {
    if (name.includes(key)) return color;
  }
  return '#6b7280';
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
          // Select all offices by default
          const offices = new Set<string>();
          d.weeks?.forEach((w: any) => Object.keys(w.offices || {}).forEach(o => offices.add(o)));
          setSelectedOffices(offices);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [weeks]);

  // Build chart data
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

  // Company-wide totals
  const companyData = data?.weeks?.map((w: any) => ({
    week: w.week,
    deals: w.totalDeals,
    kw: w.totalKw,
  })) || [];

  // Trend detection
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trends & Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Week-over-week performance tracking</p>
        </div>
        <div className="flex items-center gap-2">
          {[4, 6, 8].map(w => (
            <button key={w} onClick={() => setWeeks(w)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${weeks === w ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {w} weeks
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /><span className="ml-3 text-gray-400">Loading trends (fetching {weeks} weeks)...</span></div>}
      {error && <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-300">Error: {error}</div>}

      {data && !loading && (
        <>
          {/* Company-wide */}
          <Section title="📈 Company-Wide Deals" subtitle="Total deals per week across all offices">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={companyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <RTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} />
                  <Line type="monotone" dataKey="deals" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Metric Selector + Office Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-500 text-sm mr-2">Metric:</span>
            {(['deals', 'doors', 'sits', 'closes'] as const).map(m => (
              <button key={m} onClick={() => setMetric(m)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize transition ${metric === m ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {m}
              </button>
            ))}
            <span className="text-gray-600 mx-2">|</span>
            <span className="text-gray-500 text-sm mr-2">Offices:</span>
            {officeList.map(o => (
              <button key={o} onClick={() => toggleOffice(o)}
                className={`px-2 py-1 rounded text-xs transition border ${selectedOffices.has(o) ? 'border-gray-600 text-white' : 'border-gray-800 text-gray-600'}`}
                style={selectedOffices.has(o) ? { backgroundColor: getColor(o) + '20', borderColor: getColor(o) + '40' } : {}}>
                {o.split(' - ')[0]}
              </button>
            ))}
          </div>

          {/* Office Comparison Chart */}
          <Section title={`📊 ${metric.charAt(0).toUpperCase() + metric.slice(1)} by Office`} subtitle="Click offices above to compare">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <RTooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} />
                  <Legend formatter={(v) => <span className="text-gray-300 text-xs">{(v as string).split(' - ')[0]}</span>} />
                  {officeList.filter(o => selectedOffices.has(o)).map(office => (
                    <Line key={office} type="monotone" dataKey={office} stroke={getColor(office)} strokeWidth={2} dot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Trend Summary */}
          <Section title="📋 Week-over-Week Changes" subtitle={`${metric} compared to previous week`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {weeklyTrends.map(t => (
                <div key={t.office} className="flex items-center justify-between bg-gray-800/30 border border-gray-800 rounded-lg p-3">
                  <div>
                    <div className="font-medium text-sm">{t.office.split(' - ')[0]}</div>
                    <div className="text-gray-500 text-xs">{t.previous} → {t.current}</div>
                  </div>
                  <div className={`flex items-center gap-1 font-bold text-sm ${t.trend > 0 ? 'text-emerald-400' : t.trend < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                    {t.trend > 0 ? <TrendingUp className="w-4 h-4" /> : t.trend < 0 ? <TrendingDown className="w-4 h-4" /> : null}
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
