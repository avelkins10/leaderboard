# Mobile Experience Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform leaderboard tables into mobile-friendly tappable rows with expand-for-details on screens < 640px while keeping desktop layout untouched.

**Architecture:** Dual-layout approach — wrap existing `<table>` in `hidden sm:block` and add a `sm:hidden` mobile layout alongside it. Mobile layout renders each rep/office as a compact row with rank, name, 3 key metrics, and tap-to-expand for remaining metrics + drill-down.

**Tech Stack:** Tailwind CSS responsive classes, existing React components (StatusBadge, RepDrillDown, OutcomeRow)

---

### Task 1: Mobile Setter Leaderboard

**Files:**
- Modify: `src/app/page.tsx:800-1045` (setter leaderboard section)

**Step 1: Wrap existing setter table in `hidden sm:block`**

Find line ~819:
```tsx
<div className="overflow-x-auto scrollable-table">
```
Change to:
```tsx
<div className="overflow-x-auto scrollable-table hidden sm:block">
```

**Step 2: Add mobile setter layout before the closing `)}` of the Section**

Insert after the `</div>` that closes the scrollable-table wrapper (line ~1041), before `)}` (line ~1042):

```tsx
{/* Mobile setter rows */}
<div className="sm:hidden divide-y divide-border/60">
  {setterList.map((s, i) => {
    const id = `setter-${s.userId}`;
    const isExpanded = expanded.has(id);
    const sits = s.SITS || 0;
    const appts = s.APPT || 0;
    const { sitRate, closeRate, wasteRate } = s;
    return (
      <div
        key={s.userId}
        className={`${isExpanded ? "bg-secondary/20" : ""}`}
      >
        <button
          className="w-full px-4 py-3 text-left active:bg-secondary/30 transition-colors"
          onClick={() => toggleExpand(id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono ${
                  i === 0
                    ? "bg-primary/15 text-primary"
                    : i < 3
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground/40"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-sm text-foreground truncate">
                  {s.name}
                  {s.isRecruit && (
                    <span className="ml-1 text-[10px] bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded">
                      R
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.qbOffice?.split(" - ")[0]}
                </div>
              </div>
            </div>
            <ChevronRight
              className={`h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground/40 ${isExpanded ? "rotate-90" : ""}`}
            />
          </div>
          <div className="flex items-center gap-4 mt-2 ml-[38px]">
            <span className="text-xs">
              <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">APT </span>
              <span className="font-mono font-semibold text-info">{appts}</span>
            </span>
            <span className="text-xs">
              <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">SIT% </span>
              {appts > 0 ? (
                <StatusBadge value={sitRate} good={THRESHOLDS.sitRate.good} ok={THRESHOLDS.sitRate.ok} />
              ) : (
                <span className="text-muted-foreground/25 font-mono">--</span>
              )}
            </span>
            <span className="text-xs">
              <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">CLS </span>
              <span className="font-mono font-semibold text-primary">{s.qbCloses || 0}</span>
            </span>
          </div>
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 pt-1 ml-[38px] space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sits</span>
                <span className="font-mono tabular-nums">{sits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Close%</span>
                {sits > 0 ? (
                  <StatusBadge value={closeRate} good={THRESHOLDS.closeRatePerSit.good} ok={THRESHOLDS.closeRatePerSit.ok} />
                ) : (
                  <span className="text-muted-foreground/25 font-mono">--</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Stars</span>
                <span className="font-mono tabular-nums">{s.avgStars > 0 ? s.avgStars.toFixed(1) : "--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Waste%</span>
                {appts > 0 ? (
                  <span className={`font-mono tabular-nums text-xs font-semibold ${wasteRate > 50 ? "text-destructive" : wasteRate > 30 ? "text-warning" : "text-muted-foreground"}`}>
                    {wasteRate}%
                  </span>
                ) : (
                  <span className="text-muted-foreground/25 font-mono">--</span>
                )}
              </div>
            </div>
            <Link
              href={`/rep/${s.userId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline"
            >
              Full profile &rarr;
            </Link>
            <RepDrillDown
              repId={s.userId}
              type="setter"
              from={from}
              to={to}
              outcomes={s.outcomes}
            />
          </div>
        )}
      </div>
    );
  })}
</div>
```

**Step 3: Verify on desktop and mobile**

Run: `npm run dev`
- Desktop (>640px): table should render unchanged
- Mobile (<640px): compact rows with tap-to-expand

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add mobile-friendly setter leaderboard rows"
```

---

### Task 2: Mobile Closer Leaderboard

**Files:**
- Modify: `src/app/page.tsx:1047-1271` (closer leaderboard section)

**Step 1: Wrap existing closer table in `hidden sm:block`**

Find line ~1066:
```tsx
<div className="overflow-x-auto scrollable-table">
```
Change to:
```tsx
<div className="overflow-x-auto scrollable-table hidden sm:block">
```

**Step 2: Add mobile closer layout after the table wrapper div**

Insert mobile layout with key metrics: Closes, kW, Close%. Expanded shows: Avg PPW, Sits, Cancel%, Cancels.

```tsx
{/* Mobile closer rows */}
<div className="sm:hidden divide-y divide-border/60">
  {closerList.map((c, i) => {
    const id = `closer-${c.userId}`;
    const isExpanded = expanded.has(id);
    const sits = c.SAT || 0;
    const { sitCloseRate } = c;
    return (
      <div
        key={c.userId}
        className={`${isExpanded ? "bg-secondary/20" : ""}`}
      >
        <button
          className="w-full px-4 py-3 text-left active:bg-secondary/30 transition-colors"
          onClick={() => toggleExpand(id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono ${
                  i === 0
                    ? "bg-primary/15 text-primary"
                    : i < 3
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground/40"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-sm text-foreground truncate">
                  {c.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.qbOffice?.split(" - ")[0]}
                </div>
              </div>
            </div>
            <ChevronRight
              className={`h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground/40 ${isExpanded ? "rotate-90" : ""}`}
            />
          </div>
          <div className="flex items-center gap-4 mt-2 ml-[38px]">
            <span className="text-xs">
              <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">CLS </span>
              <span className="font-mono font-semibold text-primary">{c.qbCloses || 0}</span>
            </span>
            <span className="text-xs">
              <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">kW </span>
              <span className="font-mono text-muted-foreground">{formatKw(c.totalKw || 0)}</span>
            </span>
            <span className="text-xs">
              <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">CLS% </span>
              {sits > 0 ? (
                <StatusBadge value={sitCloseRate} good={THRESHOLDS.closeRatePerSit.good} ok={THRESHOLDS.closeRatePerSit.ok} />
              ) : (
                <span className="text-muted-foreground/25 font-mono">--</span>
              )}
            </span>
          </div>
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 pt-1 ml-[38px] space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg PPW</span>
                <span className="font-mono tabular-nums">{c.avgPpw > 0 ? formatCurrency(c.avgPpw) : "--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sits</span>
                <span className="font-mono tabular-nums">{sits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cancel%</span>
                {(c.qbCloses || 0) + (c.qbCancelled || 0) > 0 ? (
                  <span className={`font-mono tabular-nums text-xs font-semibold ${c.cancelPct > 30 ? "text-destructive" : c.cancelPct > 15 ? "text-warning" : "text-muted-foreground"}`}>
                    {c.cancelPct}%
                  </span>
                ) : (
                  <span className="text-muted-foreground/25 font-mono">--</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cancels</span>
                <span className="font-mono tabular-nums">{c.qbCancelled || 0}</span>
              </div>
            </div>
            <Link
              href={`/rep/${c.userId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline"
            >
              Full profile &rarr;
            </Link>
            <RepDrillDown
              repId={c.userId}
              type="closer"
              from={from}
              to={to}
              outcomes={c.outcomes}
            />
          </div>
        )}
      </div>
    );
  })}
</div>
```

**Step 3: Verify**

Same as Task 1 — desktop unchanged, mobile shows compact rows.

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add mobile-friendly closer leaderboard rows"
```

---

### Task 3: Mobile Office Leaderboard

**Files:**
- Modify: `src/app/page.tsx:1273-1668` (office leaderboard section)

**Step 1: Wrap existing office table in `hidden sm:block`**

Find line ~1281:
```tsx
<div className="overflow-x-auto scrollable-table">
```
Change to:
```tsx
<div className="overflow-x-auto scrollable-table hidden sm:block">
```

**Step 2: Add mobile office layout after the table wrapper div**

Key metrics: Closes, kW, Sit%. Expanded shows: Appts, Sits, Close%, Wk Avg, Cancel%, Setters, Closers, top closers/setters, link to office page.

```tsx
{/* Mobile office rows */}
<div className="sm:hidden divide-y divide-border/60">
  {officeList.map((o, i) => {
    const id = `office-${o.name}`;
    const isExpanded = expanded.has(id);
    return (
      <div
        key={o.name}
        className={`${o.qbCloses === 0 ? "opacity-40" : ""} ${isExpanded ? "bg-secondary/20" : ""}`}
      >
        <button
          className="w-full px-4 py-3 text-left active:bg-secondary/30 transition-colors"
          onClick={() => toggleExpand(id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono ${
                  i === 0
                    ? "bg-primary/15 text-primary"
                    : i < 3
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground/40"
                }`}
              >
                {i + 1}
              </span>
              <span className="font-medium text-sm text-foreground truncate">{o.name}</span>
            </div>
            <ChevronRight
              className={`h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground/40 ${isExpanded ? "rotate-90" : ""}`}
            />
          </div>
          <div className="flex items-center gap-4 mt-2 ml-[38px]">
            <span className="text-xs">
              <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">CLS </span>
              <span className="font-mono font-semibold text-primary">{formatNumber(o.qbCloses)}</span>
            </span>
            <span className="text-xs">
              <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">kW </span>
              <span className="font-mono text-muted-foreground">{formatKw(o.kw)}</span>
            </span>
            <span className="text-xs">
              <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">SIT% </span>
              {o.totalAppts > 0 ? (
                <StatusBadge value={Math.round(o.sitRate)} good={THRESHOLDS.sitRate.good} ok={THRESHOLDS.sitRate.ok} />
              ) : (
                <span className="text-muted-foreground/25 font-mono">--</span>
              )}
            </span>
          </div>
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 pt-1 ml-[38px] space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Appts</span>
                <span className="font-mono tabular-nums">{formatNumber(o.totalAppts)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sits</span>
                <span className="font-mono tabular-nums">{formatNumber(o.totalSits)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Close%</span>
                {o.totalSits > 0 ? (
                  <StatusBadge value={Math.round(o.closeRate)} good={THRESHOLDS.closeRatePerSit.good} ok={THRESHOLDS.closeRatePerSit.ok} />
                ) : (
                  <span className="text-muted-foreground/25 font-mono">--</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wk Avg</span>
                <span className="font-mono tabular-nums">{o.weeklyAvg > 0 ? o.weeklyAvg : "--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cancel%</span>
                {o.cancelPct > 0 ? (
                  <span className={`font-mono tabular-nums text-xs font-semibold ${o.cancelPct > 30 ? "text-destructive" : o.cancelPct > 15 ? "text-warning" : "text-muted-foreground"}`}>
                    {o.cancelPct}%
                  </span>
                ) : (
                  <span className="text-muted-foreground/25 font-mono">--</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Team</span>
                <span className="font-mono tabular-nums">{o.activeSetters}S / {o.activeClosers}C</span>
              </div>
            </div>
            {/* Top closers & setters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Top Closers</p>
                <div className="space-y-1">
                  {o.closers.sort((a: any, b: any) => (b.qbCloses || 0) - (a.qbCloses || 0)).slice(0, 3).map((c: any) => (
                    <div key={c.userId} className="flex items-center justify-between text-xs">
                      <Link href={`/rep/${c.userId}`} onClick={(e) => e.stopPropagation()} className="text-foreground hover:text-primary truncate mr-1">{c.name}</Link>
                      <span className="font-mono tabular-nums text-primary font-semibold shrink-0">{c.qbCloses || 0}</span>
                    </div>
                  ))}
                  {o.closers.length === 0 && <span className="text-[10px] text-muted-foreground/40">None</span>}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Top Setters</p>
                <div className="space-y-1">
                  {o.setters.sort((a: any, b: any) => (b.APPT || 0) - (a.APPT || 0)).slice(0, 3).map((s: any) => (
                    <div key={s.userId} className="flex items-center justify-between text-xs">
                      <Link href={`/rep/${s.userId}`} onClick={(e) => e.stopPropagation()} className="text-foreground hover:text-primary truncate mr-1">{s.name}</Link>
                      <span className="font-mono tabular-nums text-info font-semibold shrink-0">{s.APPT || 0}</span>
                    </div>
                  ))}
                  {o.setters.length === 0 && <span className="text-[10px] text-muted-foreground/40">None</span>}
                </div>
              </div>
            </div>
            <Link
              href={`/office/${encodeURIComponent(o.name)}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline"
            >
              Full office page &rarr;
            </Link>
          </div>
        )}
      </div>
    );
  })}
</div>
```

**Step 3: Verify and commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add mobile-friendly office leaderboard rows"
```

---

### Task 4: Mobile Drill-Down Appointments

**Files:**
- Modify: `src/app/page.tsx:296-410` (RepDrillDown appointment table)

**Step 1: Wrap existing drill-down table in `hidden sm:block`**

Find line ~297:
```tsx
<div className="mt-2 overflow-x-auto rounded-lg border border-border/40">
  <table className="w-full text-xs">
```
Wrap this entire `<div>` (through closing `</div>` at ~411) in `hidden sm:block`.

**Step 2: Add mobile appointment cards**

After the hidden table div, add:

```tsx
{/* Mobile appointment cards */}
<div className="sm:hidden mt-2 space-y-2">
  {appts.slice(0, 10).map((a) => (
    <div key={a.id} className="rounded-lg border border-border/40 px-3 py-2.5 bg-secondary/10">
      <div className="flex items-center justify-between">
        <span className="font-mono tabular-nums text-xs text-muted-foreground">
          {a.appointment_time
            ? new Date(a.appointment_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "-"}
        </span>
        <span className="text-xs text-foreground truncate ml-2 flex-1 text-right">{a.contact_name || "-"}</span>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-2">
          {a.disposition ? (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${dispositionBadgeClass(a.disposition_category)}`}>
              {a.disposition}
            </span>
          ) : (
            <span className="rounded bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info">Scheduled</span>
          )}
          {type === "setter" && a.star_rating && (
            <span className={`font-mono text-xs ${a.star_rating === 3 ? "text-primary" : a.star_rating === 2 ? "text-warning" : "text-destructive"}`}>
              {a.star_rating}★
            </span>
          )}
          {type === "setter" && a.hours_scheduled_out != null && (
            <span className={`font-mono text-[10px] ${a.hours_scheduled_out <= 48 ? "text-primary" : a.hours_scheduled_out <= 72 ? "text-warning" : "text-destructive"}`}>
              {a.hours_scheduled_out < 48 ? `${Math.round(a.hours_scheduled_out)}h` : `${(a.hours_scheduled_out / 24).toFixed(1)}d`}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground truncate ml-2">
          {type === "closer" ? a.setter_name : a.closer_name}
        </span>
      </div>
    </div>
  ))}
  {appts.length > 10 && (
    <Link
      href={`/rep/${repId}`}
      onClick={(e) => e.stopPropagation()}
      className="block text-xs text-primary text-center py-2 hover:underline"
    >
      +{appts.length - 10} more — view full profile &rarr;
    </Link>
  )}
</div>
```

**Step 3: Fix "Full profile" link visibility**

In both setter (line ~1028) and closer (line ~1254) expanded sections, change:
```tsx
className="text-2xs text-primary hover:underline shrink-0 hidden sm:inline"
```
to:
```tsx
className="text-2xs text-primary hover:underline shrink-0"
```

**Step 4: Verify and commit**

```bash
git add src/app/page.tsx
git commit -m "feat: mobile-friendly drill-down cards and visible profile links"
```

---

### Task 5: Rank-by Pills Touch Targets

**Files:**
- Modify: `src/app/page.tsx:786-793` (rank-by pill buttons)

**Step 1: Increase mobile tap target size**

Find line ~786:
```tsx
className={`rounded-md px-2.5 py-1 text-2xs font-medium transition-all ${
```
Change to:
```tsx
className={`rounded-md px-3 py-2 text-xs sm:px-2.5 sm:py-1 sm:text-2xs font-medium transition-all ${
```

**Step 2: Verify and commit**

```bash
git add src/app/page.tsx
git commit -m "feat: larger rank-by pill tap targets on mobile"
```

---

### Task 6: Final Verification

**Step 1: Run `npm run build` to verify no TypeScript or build errors**

**Step 2: Manual test on mobile viewport**
- Open Chrome DevTools, toggle device toolbar
- Test iPhone 14 (390px) and iPhone SE (375px)
- Verify: setter, closer, office leaderboards all show compact rows
- Verify: tapping a row expands to show remaining metrics + drill-down
- Verify: drill-down appointments show as stacked cards
- Verify: rank-by pills are easily tappable
- Verify: "Full profile" link visible everywhere
- Verify: desktop layout is completely unchanged

**Step 3: Commit all and push**

```bash
git push origin main
```
