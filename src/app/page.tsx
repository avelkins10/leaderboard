'use client';

import { useEffect, useState } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks, addDays } from 'date-fns';

interface ScorecardData {
  period: { from: string; to: string };
  summary: { totalSales: number; totalKw: number; avgSystemSize: number; avgPpw: number };
  offices: Record<string, any>;
  setterLeaderboard: any[];
  closerLeaderboard: any[];
  salesByOffice: Record<string, any>;
  salesByCloser: Record<string, any>;
}

export default function Dashboard() {
  const [data, setData] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 0 });
  const weekEnd = weekOffset === 0 ? new Date() : endOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 0 });

  useEffect(() => {
    setLoading(true);
    const from = format(weekStart, 'yyyy-MM-dd');
    const to = format(addDays(weekEnd, 1), 'yyyy-MM-dd');
    fetch(`/api/scorecard?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [weekOffset]);

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              ⚡ KIN Sales Intel
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Week of {format(weekStart, 'MMM d')} — {format(weekEnd, 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
            >
              ← Prev Week
            </button>
            {weekOffset > 0 && (
              <button
                onClick={() => setWeekOffset(w => w - 1)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
              >
                Next Week →
              </button>
            )}
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition"
              >
                This Week
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-400">Loading scorecard...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-300">
            Error: {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <SummaryCard label="Total Deals" value={data.summary.totalSales} />
              <SummaryCard label="Total kW" value={`${data.summary.totalKw.toFixed(1)}`} />
              <SummaryCard label="Avg System Size" value={`${data.summary.avgSystemSize.toFixed(1)} kW`} />
              <SummaryCard label="Avg Net PPW" value={`$${data.summary.avgPpw.toFixed(2)}`} />
            </div>

            {/* Office Scorecard */}
            <Section title="📊 Office Scorecard">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800">
                      <th className="text-left py-3 px-4">Office</th>
                      <th className="text-right py-3 px-2">Deals</th>
                      <th className="text-right py-3 px-2">kW</th>
                      <th className="text-right py-3 px-2">Setters</th>
                      <th className="text-right py-3 px-2">Doors</th>
                      <th className="text-right py-3 px-2">Appts Set</th>
                      <th className="text-right py-3 px-2">Closers</th>
                      <th className="text-right py-3 px-2">Sits</th>
                      <th className="text-right py-3 px-2">Closes</th>
                      <th className="text-right py-3 px-2">Sit/Close %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.offices)
                      .sort(([, a]: any, [, b]: any) => (b.sales?.deals || 0) - (a.sales?.deals || 0))
                      .map(([office, d]: [string, any]) => {
                        const totalDoors = d.setters?.reduce((s: number, r: any) => s + (r.DK || 0), 0) || 0;
                        const totalAppts = d.setters?.reduce((s: number, r: any) => s + (r.APPT || 0), 0) || 0;
                        const totalSits = d.closers?.reduce((s: number, r: any) => s + (r.SAT || 0), 0) || 0;
                        const totalCloses = d.closers?.reduce((s: number, r: any) => s + (r.CLOS || 0), 0) || 0;
                        const sitCloseRate = totalSits > 0 ? ((totalCloses / totalSits) * 100).toFixed(0) : '-';
                        return (
                          <tr key={office} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                            <td className="py-3 px-4 font-medium">{office}</td>
                            <td className="text-right py-3 px-2 font-bold text-green-400">{d.sales?.deals || 0}</td>
                            <td className="text-right py-3 px-2">{(d.sales?.kw || 0).toFixed(1)}</td>
                            <td className="text-right py-3 px-2 text-gray-400">{d.setters?.length || 0}</td>
                            <td className="text-right py-3 px-2">{totalDoors}</td>
                            <td className="text-right py-3 px-2">{totalAppts}</td>
                            <td className="text-right py-3 px-2 text-gray-400">{d.closers?.length || 0}</td>
                            <td className="text-right py-3 px-2">{totalSits}</td>
                            <td className="text-right py-3 px-2 font-bold text-blue-400">{totalCloses}</td>
                            <td className="text-right py-3 px-2">
                              <span className={`${Number(sitCloseRate) >= 40 ? 'text-green-400' : Number(sitCloseRate) >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {sitCloseRate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Top Closers */}
            <div className="grid grid-cols-2 gap-6">
              <Section title="🎯 Top Closers">
                <div className="space-y-2">
                  {data.closerLeaderboard
                    .filter(c => (c.SAT || 0) > 0 || (c.CLOS || 0) > 0)
                    .sort((a, b) => (b.CLOS || 0) - (a.CLOS || 0))
                    .slice(0, 10)
                    .map((c, i) => (
                      <div key={c.userId} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-800/50">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 w-6 text-right">{i + 1}.</span>
                          <div>
                            <span className="font-medium">{c.name}</span>
                            <span className="text-gray-500 text-xs ml-2">{c.qbOffice}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-400">{c.LEAD || 0} leads</span>
                          <span>{c.SAT || 0} sits</span>
                          <span className="font-bold text-blue-400">{c.CLOS || 0} closes</span>
                          <span className={`${c.CLSE >= 40 ? 'text-green-400' : c.CLSE >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {c.CLSE || 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </Section>

              <Section title="🚪 Top Setters">
                <div className="space-y-2">
                  {data.setterLeaderboard
                    .filter(s => (s.DK || 0) > 0 || (s.APPT || 0) > 0)
                    .sort((a, b) => (b.APPT || 0) - (a.APPT || 0) || (b.DK || 0) - (a.DK || 0))
                    .slice(0, 10)
                    .map((s, i) => (
                      <div key={s.userId} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-800/50">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 w-6 text-right">{i + 1}.</span>
                          <div>
                            <span className="font-medium">{s.name}</span>
                            <span className="text-gray-500 text-xs ml-2">{s.qbOffice}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-400">{s.DK || 0} doors</span>
                          <span>{s.APPT || 0} appts</span>
                          <span className="font-bold text-green-400">{s.SITS || 0} sits</span>
                          <span className="text-blue-400">{s.CLOS || 0} closes</span>
                        </div>
                      </div>
                    ))}
                </div>
              </Section>
            </div>

            {/* Sales by Closer */}
            <Section title="💰 QB Sales by Closer">
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(data.salesByCloser)
                  .sort(([, a]: any, [, b]: any) => b.deals - a.deals)
                  .map(([name, d]: [string, any]) => (
                    <div key={name} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="font-medium">{name}</div>
                      <div className="text-xs text-gray-400">{d.office}</div>
                      <div className="mt-1 text-sm">
                        <span className="text-green-400 font-bold">{d.deals} deals</span>
                        <span className="text-gray-500 ml-2">{d.kw.toFixed(1)} kW</span>
                      </div>
                    </div>
                  ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-gray-400 text-xs uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
