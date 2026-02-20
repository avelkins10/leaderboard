"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { DateFilter } from "@/components/DateFilter";
import { useDateRange } from "@/hooks/useDateRange";
import { formatNumber, formatKw } from "@/lib/format";
import {
  Building2,
  Target,
  Zap,
  Users,
  Search,
  ArrowRight,
  Calendar,
  Inbox,
} from "lucide-react";

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-skeleton rounded-xl bg-secondary ${className}`} />
  );
}

export default function OfficeDirectory() {
  const {
    preset,
    from,
    to,
    displayFrom,
    displayTo,
    setPreset,
    setCustomRange,
  } = useDateRange("this-week");
  const { data, error, isLoading } = useSWR(
    `/api/scorecard?from=${from}&to=${to}`,
  );
  const [search, setSearch] = useState("");

  const offices = useMemo(() => {
    if (!data?.offices) return [];
    return Object.entries(data.offices)
      .map(([name, d]: [string, any]) => {
        const totalAppts =
          d.setters?.reduce((s: number, r: any) => s + (r.APPT || 0), 0) || 0;
        const setterSits =
          d.setters?.reduce((s: number, r: any) => s + (r.SITS || 0), 0) || 0;
        const closerSats =
          d.closers?.reduce((s: number, r: any) => s + (r.SAT || 0), 0) || 0;
        const totalSits = Math.max(setterSits, closerSats);
        const deals = d.sales?.deals || 0;
        const kw = d.sales?.kw || 0;
        const activeReps = d.activeReps || 0;
        const cancelPct = d.sales?.cancelPct || 0;
        const closeRate = totalSits > 0 ? (deals / totalSits) * 100 : 0;
        return {
          name,
          deals,
          kw,
          totalAppts,
          totalSits,
          activeReps,
          cancelPct,
          closeRate,
          setterCount: d.setters?.length || 0,
          closerCount: d.closers?.length || 0,
        };
      })
      .sort((a, b) => b.deals - a.deals);
  }, [data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return offices;
    const q = search.toLowerCase();
    return offices.filter((o) => o.name.toLowerCase().includes(q));
  }, [offices, search]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Offices
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Office directory with key performance stats
          </p>
        </div>
        <DateFilter
          preset={preset}
          displayFrom={displayFrom}
          displayTo={displayTo}
          onPreset={setPreset}
          onCustomRange={setCustomRange}
        />
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-11" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {data && !isLoading && (
        <div className="animate-enter space-y-5">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search offices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20">
              <Inbox className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No offices found
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Try adjusting your search or date range
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((o) => (
                <Link
                  key={o.name}
                  href={`/office/${encodeURIComponent(o.name)}`}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-card-dark text-sm font-bold text-card-dark-foreground">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {o.name}
                        </h3>
                        <p className="text-2xs text-muted-foreground">
                          {o.setterCount} setters, {o.closerCount} closers
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                        <Target className="h-3 w-3" /> Deals
                      </div>
                      <p className="mt-1 text-lg font-bold font-mono tabular-nums text-primary">
                        {formatNumber(o.deals)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                        <Zap className="h-3 w-3" /> kW
                      </div>
                      <p className="mt-1 text-lg font-bold font-mono tabular-nums text-foreground">
                        {formatKw(o.kw)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                        <Users className="h-3 w-3" /> Active
                      </div>
                      <p className="mt-1 text-lg font-bold font-mono tabular-nums text-foreground">
                        {formatNumber(o.activeReps)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-3">
                    <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatNumber(o.totalAppts)} appts
                    </div>
                    <span className="text-border">|</span>
                    <span className="text-2xs text-muted-foreground">
                      {o.closeRate > 0
                        ? `${Math.round(o.closeRate)}% close rate`
                        : "No sits yet"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
