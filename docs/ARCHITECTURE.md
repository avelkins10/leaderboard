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

Cron Jobs (Vercel)
    │
    ├── /api/cron/snapshot      — weekly snapshot (Mon 6am UTC)
    ├── /api/cron/sync-quality  — appointment sync + star recompute (every 4h)
    └── /api/cron/verify-attachments — AI vision power bill check (every 2h)
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

## Deal Matching (QB ↔ RepCard)

Every QB deal is matched to a RepCard appointment. 90% YTD match rate.

**Matching chain (priority order):**

1. **Phone** (84% of matches) — normalize both to 10 digits, exact match. Confidence: 0.95 if closer ID also matches, 0.8 otherwise.
2. **Address** (3%) — normalize addresses, partial match on street number + name. Confidence: 0.85 with closer match.
3. **Name + Date** (3%) — last name match + same closer + appointment within 30 days of sale. Confidence: 0.6.

Phone normalization: strip non-digits, drop leading '1' if 11 digits, take last 10.
Address normalization: lowercase, strip apt/unit/suite, abbreviate street types, strip zip.

Matching logic: `src/lib/matching.ts`
Match API: `POST /api/match/deals` (batch), `GET /api/match/deal/[qb_record_id]` (single)

**Key principle:** A close only counts if it's in QuickBase. RepCard "Closed (Pending KCA)" is a claim, not verification.

## Contact Lifecycle

A contact flows through these stages (tracked across systems):

```
Door Knock (door_knocks) → Status: "Not Home" / "Appointment Scheduled" (lead_status_changes)
  → Appointment Set (appointments) → Closer Assigned → Appointment Outcome (disposition)
    → Status: "Signed" → "Pending KCA" (lead_status_changes)
      → Contact Type: Lead → Customer (contact_type_changes)
        → QB Deal Created (deal_matches links it all together)
```

Timeline API: `GET /api/contact/[id]` — returns chronological events from all tables.

## Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── activity/route.ts       # Real-time activity feed
│   │   ├── appointments/route.ts   # Appointment drill-down
│   │   ├── backfill/route.ts       # Data backfill endpoint
│   │   ├── backfill/history/route.ts # Historical backfill from Neon
│   │   ├── contact/[id]/route.ts   # Contact timeline
│   │   ├── cron/snapshot/route.ts  # Weekly snapshot (Mon 6am UTC)
│   │   ├── cron/sync-quality/route.ts  # 4-hourly quality sync
│   │   ├── cron/verify-attachments/route.ts  # 2-hourly AI vision verification
│   │   ├── match/deals/route.ts    # Batch deal matching (QB ↔ RC)
│   │   ├── match/deal/[id]/route.ts # Single deal full chain
│   │   ├── office/[name]/route.ts  # Office detail page data
│   │   ├── pipeline/route.ts       # Pipeline/status aggregation
│   │   ├── rep/[id]/route.ts       # Rep baseball card data
│   │   ├── rep/[id]/appointments/route.ts # Rep appointment drill-down
│   │   ├── scorecard/route.ts      # Main dashboard data
│   │   ├── trends/route.ts         # Multi-week trend data
│   │   └── webhooks/repcard/[event]/route.ts  # 7 webhook receivers
│   ├── page.tsx                    # Main dashboard UI
│   ├── contact/[id]/page.tsx       # Contact timeline UI
│   ├── office/page.tsx             # Office directory
│   ├── office/[name]/page.tsx      # Office detail UI
│   ├── quality/page.tsx            # Quality analytics UI
│   ├── rep/page.tsx                # Rep directory
│   ├── rep/[id]/page.tsx           # Rep profile UI
│   └── trends/page.tsx             # Trends UI
├── components/                     # Shared UI components
└── lib/
    ├── config.ts                   # Office mapping, timezones, env vars
    ├── matching.ts                 # Phone/address normalization + matching
    ├── quickbase.ts                # QB API client
    ├── repcard.ts                  # RepCard API client
    ├── rep-roles.json              # Static role override file
    ├── supabase.ts                 # Supabase client (lazy-loaded)
    └── supabase-queries.ts         # All Supabase query functions
```
