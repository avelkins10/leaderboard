# Architecture

## Overview

KIN PULSE is a real-time sales analytics dashboard for KIN Home Solar. It merges data from two systems:

- **RepCard** — Field sales activity (door knocks, appointments, dispositions, closer outcomes)
- **QuickBase** — CRM / project management (verified sales, milestones, funding, commissions)

Data flows into **Supabase** via webhooks for real-time storage, and the dashboard reads from all three sources.

## System Diagram

```
RepCard App (field reps)
    │
    ├── 7 Webhooks ──→ /api/webhooks/repcard/[event] ──→ Supabase
    │                                                      ├── appointments
    │                                                      ├── door_knocks
    │                                                      └── weekly_snapshots
    │
    └── REST API ──→ /api/scorecard (leaderboards, users, appointments)
                     /api/office/[name]
                     /api/rep/[id]

QuickBase (CRM)
    │
    └── REST API ──→ /api/scorecard (verified sales by closer/setter RepCard ID)
                     /api/rep/[id] (closer QB stats, sale details)

Supabase (real-time data store)
    │
    └── Postgres ──→ /api/appointments (drill-downs)
                     /api/contact/[id] (timelines)
                     /api/rep/[id] (quality stats, appointment history)
                     /api/cron/snapshot (weekly snapshots)
```

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS + custom design system (KIN PULSE theme)
- **Charts**: Recharts
- **Hosting**: Vercel
- **Database**: Supabase (PostgreSQL)
- **APIs**: RepCard REST, QuickBase REST

## Data Flow

### Real-Time (Webhooks → Supabase)
1. Rep knocks a door → RepCard fires `door-knocked` webhook
2. Rep sets appointment → `appointment-set` webhook → creates appointment record
3. Closer runs appointment → `appointment-outcome` webhook → updates disposition
4. Attachment uploaded → `appointment-update` webhook → checks for power bill
5. Contact type changes → `contact-type-changed` webhook → signals deal closed

### On-Demand (API calls per page load)
1. Dashboard loads → `/api/scorecard` calls RepCard leaderboards + QB sales API
2. Scorecard merges: RepCard activity stats + QB verified closes + Supabase quality/active reps
3. Office pages call `/api/office/[name]` → same merge at office level
4. Rep profiles call `/api/rep/[id]` → individual stats + Supabase appointment history

### Cross-System Matching
- **Primary**: RepCard User ID stored in QB (FID 2277 = closer, FID 2279 = setter) — 96-99% match rate
- **Fallback**: Name matching (case-insensitive contains)
- A **close only counts if it's in QuickBase** — RepCard "Closed (Pending KCA)" is just a claim

## Key Design Decisions

1. **Supabase for real-time, APIs for aggregates** — Webhooks feed Supabase for drill-downs and quality tracking. Leaderboard aggregates still come from RepCard API (they do the math).

2. **QB office names are canonical** — The dashboard groups everything by QB Sales Office name. RepCard team names are mapped to QB names via `OFFICE_MAPPING` in config.

3. **One RepCard team can map to one QB office, but one QB office can have multiple RepCard teams** — e.g., Stevens - Iowa 2025 has Stevens, Bitton, and Johnson teams.

4. **Quality is setter-owned** — The 3-star system measures setter appointment quality, not closer performance. Closers get QB-verified stats (deals, kW, PPW).

5. **All times are timezone-aware** — Each office has a timezone. All user-facing times display in the rep's local timezone.

## Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── appointments/route.ts   # Appointment drill-down (filter by setter, closer, office, disposition)
│   │   ├── backfill/route.ts       # One-time data backfill endpoint
│   │   ├── contact/[id]/route.ts   # Contact timeline (full lifecycle)
│   │   ├── cron/snapshot/route.ts  # Weekly snapshot (runs Monday 6am UTC)
│   │   ├── office/[name]/route.ts  # Office detail page data
│   │   ├── rep/[id]/route.ts       # Rep baseball card data
│   │   ├── scorecard/route.ts      # Main dashboard data
│   │   └── webhooks/repcard/[event]/route.ts  # 7 webhook receivers
│   ├── office/[name]/page.tsx      # Office detail UI
│   ├── quality/page.tsx            # Quality analytics UI
│   ├── rep/[id]/page.tsx           # Rep profile UI
│   ├── trends/page.tsx             # Trends UI
│   └── page.tsx                    # Main dashboard UI
├── components/                     # Shared UI components
└── lib/
    ├── config.ts                   # Office mapping, timezones, env vars
    ├── quickbase.ts                # QB API client
    ├── repcard.ts                  # RepCard API client
    ├── rep-roles.json              # RepCard role badges (seeded from Neon)
    ├── supabase.ts                 # Supabase client (lazy-loaded)
    └── supabase-queries.ts         # All Supabase query functions
```
