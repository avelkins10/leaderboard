"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { DateFilter } from "@/components/DateFilter";
import { useDateRange } from "@/hooks/useDateRange";
import { formatNumber, formatKw } from "@/lib/format";
import { Search, ArrowRight, Inbox, Building2 } from "lucide-react";

interface Rep {
  userId: number;
  name: string;
  qbOffice?: string;
  type: "setter" | "closer";
  appts?: number;
  doors?: number;
  sits?: number;
  qbCloses?: number;
  totalKw?: number;
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-skeleton rounded-xl bg-secondary ${className}`} />
  );
}

export default function RepDirectory() {
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

  const repsByOffice = useMemo(() => {
    if (!data) return {};
    const reps: Rep[] = [];

    // Add setters
    for (const s of data.allSetters || []) {
      reps.push({
        userId: s.userId,
        name: s.name,
        qbOffice: s.qbOffice,
        type: "setter",
        appts: s.APPT || 0,
        doors: s.DK || 0,
        sits: s.SITS || 0,
        qbCloses: s.qbCloses || 0,
      });
    }

    // Add closers (avoid duplication by userId)
    const setterIds = new Set(reps.map((r) => r.userId));
    for (const c of data.allClosers || []) {
      if (!setterIds.has(c.userId)) {
        reps.push({
          userId: c.userId,
          name: c.name,
          qbOffice: c.qbOffice,
          type: "closer",
          sits: c.SAT || 0,
          qbCloses: c.qbCloses || 0,
          totalKw: c.totalKw || 0,
        });
      }
    }

    // Group by office
    const grouped: Record<string, Rep[]> = {};
    for (const r of reps) {
      const office = r.qbOffice?.split(" - ")[0] || "Unknown";
      if (!grouped[office]) grouped[office] = [];
      grouped[office].push(r);
    }

    // Sort reps within each office by name
    for (const office of Object.keys(grouped)) {
      grouped[office].sort((a, b) => a.name.localeCompare(b.name));
    }

    return grouped;
  }, [data]);

  const filteredOffices = useMemo(() => {
    const q = search.toLowerCase().trim();
    const entries = Object.entries(repsByOffice);
    if (!q) return entries.sort(([a], [b]) => a.localeCompare(b));

    return entries
      .map(([office, reps]) => {
        const matchesOffice = office.toLowerCase().includes(q);
        const filteredReps = matchesOffice
          ? reps
          : reps.filter((r) => r.name.toLowerCase().includes(q));
        return [office, filteredReps] as [string, Rep[]];
      })
      .filter(([, reps]) => reps.length > 0)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [repsByOffice, search]);

  const totalReps = filteredOffices.reduce(
    (sum, [, reps]) => sum + reps.length,
    0,
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Reps
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Sales rep directory grouped by office
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
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search reps or offices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(totalReps)} reps across {filteredOffices.length}{" "}
              offices
            </p>
          </div>

          {filteredOffices.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20">
              <Inbox className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No reps found
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Try adjusting your search or date range
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredOffices.map(([office, reps]) => (
                <div
                  key={office}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  {/* Office header */}
                  <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">
                        {office}
                      </span>
                      <span className="rounded-md bg-secondary px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                        {reps.length}
                      </span>
                      {(() => {
                        const fullOfficeName = Object.keys(data.offices).find(
                          (k) => k.startsWith(office),
                        );
                        const officeData = fullOfficeName
                          ? data.offices[fullOfficeName]
                          : null;
                        if (!officeData) return null;
                        const totalAppts =
                          officeData.setters?.reduce(
                            (s: number, r: any) => s + (r.APPT || 0),
                            0,
                          ) || 0;
                        const totalDeals =
                          (officeData.sales?.deals || 0) +
                          (officeData.sales?.cancelled || 0);
                        return (
                          <div className="hidden sm:flex items-center gap-3 ml-2 text-2xs text-muted-foreground">
                            {totalAppts > 0 && (
                              <span className="font-mono tabular-nums">
                                <span className="font-semibold text-foreground">
                                  {totalAppts}
                                </span>{" "}
                                appts
                              </span>
                            )}
                            {totalDeals > 0 && (
                              <span className="font-mono tabular-nums">
                                <span className="font-semibold text-primary">
                                  {totalDeals}
                                </span>{" "}
                                deals
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <Link
                      href={`/office/${encodeURIComponent(
                        // Find the full office name from data
                        Object.keys(data.offices).find((k) =>
                          k.startsWith(office),
                        ) || office,
                      )}`}
                      className="inline-flex items-center gap-1 text-2xs text-primary hover:underline"
                    >
                      View office <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* Reps list */}
                  <div className="divide-y divide-border/60">
                    {reps.map((r) => (
                      <Link
                        key={r.userId}
                        href={`/rep/${r.userId}`}
                        className="group flex items-center justify-between px-5 py-3 min-h-[44px] transition-colors hover:bg-secondary/30"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card-dark text-xs font-bold text-card-dark-foreground">
                            {r.name.charAt(0)}
                          </span>
                          <div>
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                              {r.name}
                            </span>
                            <span className="ml-2 rounded-md bg-secondary px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                              {r.type === "setter" ? "Setter" : "Closer"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                            {r.type === "setter" ? (
                              <>
                                <span className="font-mono tabular-nums">
                                  <span className="text-foreground font-semibold">
                                    {formatNumber(r.appts || 0)}
                                  </span>{" "}
                                  appts
                                </span>
                                <span className="font-mono tabular-nums">
                                  <span className="text-primary font-semibold">
                                    {formatNumber(r.qbCloses || 0)}
                                  </span>{" "}
                                  closes
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="font-mono tabular-nums">
                                  <span className="text-primary font-semibold">
                                    {formatNumber(r.qbCloses || 0)}
                                  </span>{" "}
                                  closes
                                </span>
                                <span className="font-mono tabular-nums">
                                  <span className="text-foreground font-semibold">
                                    {formatKw(r.totalKw || 0)}
                                  </span>{" "}
                                  kW
                                </span>
                              </>
                            )}
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
