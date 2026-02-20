# Mobile Experience Overhaul — Design Doc

**Date:** 2026-02-19
**Status:** Approved

## Problem

The dashboard is data-dense (10-12 column tables) and designed desktop-first. On mobile:
- Leaderboard tables force horizontal scroll (`min-w-[700px]`+)
- Text is 11-13px, hard to read
- Rank-by pills are tiny (11px, ~24px tap target)
- Drill-down appointment tables also overflow
- "Full profile" link hidden on mobile

Primary mobile users: sales managers and reps checking leaderboard rankings.

## Approach: Responsive Table Collapse

On screens < 640px, leaderboard tables transform into compact tappable rows. Desktop stays unchanged.

## Design

### 1. Mobile Leaderboard Rows (< 640px)

Each rep becomes a row card showing rank, name, office, and 3 key metrics. Tap to expand for all metrics + drill-down.

**Collapsed state:**
```
┌─────────────────────────────────┐
│ 1  Austin Elkins           ▸   │
│    Stevens                      │
│    APPT 12   SIT% 75%   CLS 4 │
├─────────────────────────────────┤
│ 2  John Smith              ▸   │
│    Roberts                      │
│    APPT 10   SIT% 60%   CLS 2 │
└─────────────────────────────────┘
```

**Expanded state** — shows remaining metrics in a grid, then the existing drill-down (outcome badges, appointment list, "Full profile" link):
```
┌─────────────────────────────────┐
│ 1  Austin Elkins           ▾   │
│    Stevens                      │
│    APPT 12   SIT% 75%   CLS 4 │
│  ┌───────────────────────────┐  │
│  │ Sits 9  Close% 44  ★ 2.3 │  │
│  │ Waste% 17%                │  │
│  │ Full profile →            │  │
│  ├───────────────────────────┤  │
│  │ Outcome badges            │  │
│  │ Feb 18 · Customer · Closed│  │
│  │ Feb 17 · Customer · NoShow│  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Key metrics per table (collapsed):**
- Setters: APPT, SIT%, Closes
- Closers: Closes, kW, Close%
- Offices: Closes, kW, Sit%

**Remaining metrics (expanded grid):**
- Setters: Sits, Close%, Avg Stars, Waste%
- Closers: Avg PPW, Sits, Cancel%, Cancels
- Offices: Appts, Sits, Close%, Wk Avg, Cancel%, Setters, Closers

### 2. Rank-by Pills

- Increase tap targets: `min-h-[36px] px-3 text-xs` on mobile
- Keep flex-wrap behavior (already works)

### 3. Drill-Down Appointments (Mobile)

Replace the inner appointment table with stacked cards on mobile:
- Line 1: Date + Customer name
- Line 2: Disposition badge + Stars (setters) or Setter name (closers)
- "Full profile" link always visible (remove `hidden sm:inline`)

### 4. Nav Touch Targets

- Already h-14 with centered content — adequate
- Just ensure horizontal padding is sufficient (already px-3)

## Scope

- Only affects `src/app/page.tsx` (leaderboard tables + drill-down)
- No API changes
- No new dependencies
- Desktop layout unchanged
