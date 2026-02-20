# KIN Pulse — Sales Intelligence Dashboard

## What This Is

Sales coaching and accountability dashboard for KIN Solar. Not a reporting tool — a **coaching tool**. Every metric should answer "what should I do differently?"

**Live:** https://kinleaderboard.com (Vercel, deployed from Cursor via git push)
**Repo:** https://github.com/avelkins10/leaderboard.git

## Architecture

```
Next.js 14 (App Router) + Tailwind + shadcn-style components
├── Data Sources
│   ├── RepCard API — appointments, leaderboards, users, attachments
│   ├── QuickBase API — deals/sales, project milestones, funding
│   └── Supabase — webhook-enriched data (star ratings, power bills, quality stats, partnerships)
├── Webhooks (RepCard → Supabase)
│   └── /api/webhooks/repcard/[event] — door-knocked, appointment-set, appointment-update, appointment-outcome, closer-update, status-changed, contact-type-changed
├── API Routes
│   ├── /api/scorecard — main dashboard data (leaderboards + QB sales)
│   ├── /api/rep/[id] — rep profile with coaching metrics
│   ├── /api/rep/[id]/appointments — drill-down appointments (RepCard + Supabase merge)
│   ├── /api/office/[name] — office detail with setter accountability
│   ├── /api/cron/snapshot — periodic snapshot for trends
│   ├── /api/cron/sync-quality — 4-hourly quality sync (appointments + star ratings)
│   ├── /api/cron/verify-attachments — 2-hourly AI vision power bill check
│   └── /api/backfill — sync RepCard appointments to Supabase
└── Pages
    ├── / — Dashboard (setter/closer/office leaderboards with drill-downs)
    ├── /office — Office directory (cards with sits, field time, per-rep averages)
    ├── /office/[name] — Office detail (setter accountability, closer breakdown, funnel)
    ├── /rep — Rep directory
    ├── /rep/[id] — Rep profile (coaching metrics, quality, appointments, sales)
    ├── /quality — Quality page
    ├── /trends — Trends page
    ├── /admin — Admin attachment review (direct URL only, not in nav)
    └── /contact/[id] — Contact timeline
```

## Data Flow & Source of Truth

### RepCard API (primary for activity data)

- **Leaderboards** — setter stats (DK, QP, APPT, SITS, CLOS, SIT%), closer stats (LEAD, SAT, CLOS, CF, NOCL, FUS)
- **Appointments** — use `setter_ids`/`closer_ids` filters, NEVER fetch all and filter in JS
- **Users** — `/api/users/minimal` for roster, team assignments
- **Attachments** — `/appointments/attachments` and `/customers/attachments` for power bills
- **API Key:** env var `REPCARD_API_KEY`, imported from `@/lib/config`
- **Base URL:** `https://app.repcard.com/api`

### QuickBase API (primary for deal/sales data)

- **Deals** — sale date (FID 522), closer (517), setter (337), office (339), kW (13), PPW (543), status (255)
- **Date queries:** ALWAYS use `OAF`/`OBF` (on or after/before), NEVER `AF`/`BF` (excludes boundary dates!)
- **API Token:** env var `QB_API_TOKEN`, realm: `kin.quickbase.com`, projects table: `br9kwm8na`

### Supabase (webhook-enriched data only)

- **Star ratings** — computed by webhooks: 3★ = power bill + within 2 days, 2★ = power bill only, 1★ = no power bill
- **Power bills** — `has_power_bill`, `power_bill_urls` from webhook `appointment_attachment` and `contact.attachment`
- **Quality stats** — `is_quality`, `hours_to_appointment`
- **Partnerships** — setter-closer pair analysis from webhook appointment data
- **DO NOT use Supabase for:** appointment lists, active rep counts, leaderboard stats — use RepCard API

## Key Business Rules

### A Close is a Close

ALL QuickBase deals count as closes regardless of status. `totalSales` = all deals.

- **Active** — deal is progressing
- **Pending KCA** — awaiting intake approval (ACTIVE, not a cancel)
- **KCA** — intake approved (ACTIVE)
- **Rejected** — intake kicked back for corrections (ACTIVE, still alive, track separately)
- **Pending Cancel** — actually cancelling (CANCEL)
- **Cancelled** — dead deal (CANCEL)

**Cancel patterns:** ONLY `['cancelled', 'pending cancel']`. NOT rejected.

### Active Rep Definition (standardized everywhere)

- Setter active = `DK > 0` (knocked doors). NOT `DK > 0 || APPT > 0`.
- Closer active = `SAT >= 1` (sat appointments)
- Deduplicate by userId (same person can be both)
- Applied consistently on: dashboard, quality page, office detail, trends

### Sits Attribution

- **Sits belong to the setter's office**, not the closer's office. Use setter `SITS` stat.
- Office sits = sum of setter SITS, NOT closer SAT (closer may be from a different office).

### Office Deal Attribution

- Office closes come from QB `salesOffice` field (FID 339) — reflects where the lead originated.
- Closer-level QB closes use RepCard ID primary, name fallback attribution.

### Star Rating System

- **3★** — Power bill + appointment within 2 days of lead creation
- **2★** — Power bill but appointment > 2 days out
- **1★** — No power bill
- Power bills come from: `appointment_attachment` (on appointment) OR `contact.attachment` (on lead)
- `hours_to_appointment` = time from `contact.createdAt` (lead creation) to `appt_start_time`

### RepCard Disposition Categories

- **Sit** (green): Closed, Credit Fail, No Close, Follow Up, DQ: Shade/Offset
- **No Sit** (red): Appointment Canceled, Needs to Reschedule, No Show
- **Reschedule** (purple): Appointment Rescheduled
- **Scheduled**: null status (no outcome yet)

## Key Files

### Data Layer

- `src/lib/data.ts` — Core data processing: aggregation, cancel detection, office mapping, rep attribution, field time computation (`avgFieldHoursByOffice`)
- `src/lib/repcard.ts` — RepCard API client (leaderboards, users, appointments)
- `src/lib/quickbase.ts` — QuickBase API client (sales/deals). `QBSale` interface has `setterName`, `closerName`, `salesOffice`, `setterRepCardId`, `closerRepCardId`.
- `src/lib/supabase.ts` — Supabase client (admin + anon)
- `src/lib/supabase-queries.ts` — Supabase query functions: `getOfficeSetterQualityStats`, `getOfficePartnerships`, `getCloserQualityByStars`, `getFieldTimeStats` (all take setter IDs), `dispositionCategory`
- `src/lib/config.ts` — Office mapping, API keys, team→QB office mapping, `getOfficeTimezone()`
- `src/lib/format.ts` — `formatDate`, `formatDateShort` (timezone-aware), `formatNumber`, `formatKw`, `formatCurrency`

### Config

- `src/lib/config.ts` — `OFFICE_MAPPING` maps RepCard team IDs to QB office names. `normalizeQBOffice()` and `qbOfficeToRepCardTeams()` handle the mapping.
- `src/lib/rep-roles.json` — Manual role overrides by RepCard user ID

### Webhook Handler

- `src/app/api/webhooks/repcard/[event]/route.ts` — Processes all RepCard webhook events. Computes star_rating, has_power_bill, hours_to_appointment. Upserts to Supabase `appointments` table.

## Dashboard Features

### Leaderboard Tabs
- **Setters** — Rank-by filter chips (Appts, Sits, Sit%, Closes, Avg Stars, Waste%). Click to expand for appointment list + outcome badges.
- **Closers** — Rank-by filter chips (Closes, kW, Sits, Close%, Cancel%). Sits breakdown columns (CLS, NC, CF, FU) visible on xl screens. Expand for appointment list (with setter name), outcome badges, and QB Sales table (with setter name column).
- **Offices** — Rank-by filter chips (Closes, Active, kW, Appts, Sits, Sit%, Close%, Wk Avg, Cancel%, Sets/Setter, Cls/Closer). Per-rep averages computed.

### RepDrillDown Component
Inline in `page.tsx` (~line 238). Lazy-loads `/api/rep/{id}/appointments` via useSWR. Shows:
- Outcome badges (OutcomeRow component)
- Appointment table with setter/closer name, disposition, stars (setter), schedule-out (setter)
- QB Sales table (closer only) with setter name, kW, PPW, status

### Office Directory (`/office`)
- Cards per office showing: closes, kW, appts, sits, active reps, close rate, avg field hours
- Data comes from `/api/scorecard` — uses `avgFieldHoursByOffice` from `data.ts`
- Sits = `Math.max(setterSits, closerSats)` for directory cards

### Office Detail Page (`/office/[name]`)
- Setter accountability table with QB closes, PB%, avg stars, field time (start/end/avg hours)
- Closer table with sits breakdown (CLS, NC, CF, FU on lg screens), outcomes attached via office API
- Only active setters shown (DK > 0 filter)
- Appointment funnel visualization (total → sat → closed → closer fault → setter fault)

### Field Time
- Source: Supabase `door_knocks` table (`rep_id`, `knocked_at`)
- `getFieldTimeStats()` in `supabase-queries.ts` — computes per-rep: avg hours/day, avg start time, avg end time
- `avgFieldHoursByOffice` in `data.ts` — groups knocks by rep + LOCAL date (timezone-aware), computes per-rep avg, then per-office avg
- Both must use setter→office mapping (not `office_team` from door_knocks) and local timezone date grouping

### Trends Page (`/trends`)
- Weekly snapshots from Supabase `weekly_snapshots` table
- Live current-week data from `/api/trends` (fetches leaderboards + sales for current period)
- Active reps counted from leaderboard `item_id` (NOT `user_id`)
- Charts: closes, kW, appts, sits, active reps per office over time

### Filter Chips (Rank By)
- All three tabs (setters, closers, offices) have filter chip rows for quick re-sorting
- Defined as `SETTER_CATEGORIES`, `CLOSER_CATEGORIES`, `OFFICE_CATEGORIES` constants in `page.tsx`
- Clicking a chip sets the sort key + descending direction, highlights the active metric
- Column headers remain independently sortable via `SortHeader` component

## Common Patterns

### Merging RepCard + Supabase Data

RepCard API provides appointment lists (names, dates, dispositions). Supabase provides webhook-enriched data (star ratings, power bills). Merge by appointment ID:

```typescript
const { data: starData } = await supabaseAdmin
  .from("appointments")
  .select("id, star_rating, has_power_bill")
  .in("id", apptIds);
const starMap = new Map(starData.map((s) => [s.id, s]));
for (const appt of appointments) {
  const sb = starMap.get(appt.id);
  if (sb) {
    appt.star_rating = sb.star_rating;
    appt.has_power_bill = sb.has_power_bill;
  }
}
```

### QB Sales Attribution

RepCard ID primary, name fallback. Both closer and setter attribution tracked separately:

```typescript
const qbData = byCloserRC[closer.userId] || byCloserName[closer.name];
closer.qbCloses = (qbData?.deals || 0) + (qbData?.cancelled || 0); // A close is a close
```

### Supabase Queries — Always Use Setter/Closer IDs

Supabase `office_team` can be null. Always query by setter_id/closer_id arrays:

```typescript
// In office API: fetch leaderboard first, extract IDs, then query Supabase
const setterIds = setters.map((s: any) => s.userId);
const [qualityStats, partnerships, fieldTimeData] = await Promise.all([
  setterIds.length > 0 ? getOfficeSetterQualityStats(teams, from, to, setterIds) : Promise.resolve([]),
  setterIds.length > 0 ? getOfficePartnerships(teams, from, to, setterIds) : Promise.resolve([]),
  setterIds.length > 0 ? getFieldTimeStats(setterIds, null, from, to, tz) : Promise.resolve([]),
]);
```

### Supabase Date Boundaries — Use `dateBoundsUTC()`

All Supabase timestamp queries must use `dateBoundsUTC(from, to)` from `data.ts` instead of hardcoded `T00:00:00Z`/`T23:59:59Z` suffixes. This converts YYYY-MM-DD date strings to UTC boundaries aligned to America/Chicago timezone (handles CST/CDT automatically):

```typescript
import { dateBoundsUTC } from "@/lib/data";
const bounds = dateBoundsUTC(from, to);
const { data } = await supabaseAdmin
  .from("appointments")
  .select("*")
  .gte("appointment_time", bounds.gte)
  .lte("appointment_time", bounds.lte);
```

### Office Name Mapping

QB uses names like "Stevens - Iowa 2025". RepCard uses team IDs mapping to names like "Stevens - Team 2026". `normalizeQBOffice()` handles the translation.

## Gotchas / Lessons Learned

- **QB date queries:** `AF`/`BF` = strictly after/before (excludes boundary). Use `OAF`/`OBF` = on or after/before.
- **RepCard per_page max is 100.** Always paginate.
- **RepCard appointments API does NOT include attachments inline.** Use `/appointments/attachments` and `/customers/attachments` endpoints separately.
- **Supabase `office_team` can be null** if appointment was synced from API (not webhook). NEVER query Supabase by `office_team`. Always use `setter_id`/`closer_id` with `.in()` filter.
- **Supabase queries must use setter/closer IDs** — partnerships, quality stats, field time all take setter IDs as params. Fetch leaderboard data first, extract IDs, then query Supabase in a second Promise.all.
- **`hours_to_appointment`** is lead creation → appointment time, NOT appointment creation → appointment time.
- **RepCard leaderboard CLOS stat includes "Closed (Pending KCA)"** — it's broader than QB verified closes.
- **RepCard leaderboard user IDs** are `s.item_id`, NOT `s.user_id` (which doesn't exist). Using `s.user_id` gives `undefined`.
- **`contact.createdAt`** in webhook payload = lead creation date. In RepCard appointments API, `createdAt` = appointment creation date. Different things.
- **Rejected ≠ Cancelled** — Rejected means intake kicked it back for corrections. Deal is still alive.
- **PPW outlier filtering:** `isValidPpw()` excludes PPW outside 0.5–8.0 from averages. Defined in `data.ts`.
- **Recruit prefix:** Rep names starting with "R - " are recruits. `cleanRepName()` strips the prefix, `isRecruit()` flags them.
- **avgStars:** Computed per setter from Supabase `appointments.star_rating` in `fetchScorecard()`. Not a RepCard API field.
- **PB% denominator:** Must use Supabase `total_appts` (same source as `power_bill_count`) to avoid >100%. RepCard APPT count can differ from Supabase appointment count.
- **Field time computation:** Groups door_knocks by rep + LOCAL date (timezone-aware via `getOfficeTimezone()`). Computes per-rep avg hours/day, then averages across reps per office. Both office directory cards and detail pages must use the same logic.
- **Timezone-aware date formatting:** Use `formatDate()`/`formatDateShort()` with timezone parameter. Offices have timezones defined in `OFFICE_MAPPING`.
- **Multiple RepCard teams per office:** Some QB offices have multiple RepCard teams (e.g., Stevens has teams 5671, 6737, 7141 all mapping to "Stevens - Iowa 2025"). This is correct — all teams roll into one office.
- **Tooltip component:** Uses `text` prop, NOT `content`. `<Tooltip text="...">`.
- **Date range `to` is inclusive.** `useDateRange` hook returns `from`/`to` as inclusive YYYY-MM-DD dates. QuickBase (`OBF`) and Supabase (`.lte`) treat dates as inclusive. NEVER add +1 day to the end date in the hook or API routes.
- **RepCard `to_date` is EXCLUSIVE.** RepCard API returns 0 results when `from_date == to_date`. The `rcExclusiveEnd()` helper in `repcard.ts` adds +1 day automatically. Direct RepCard URL calls (in `rep/[id]/route.ts`, `rep/[id]/appointments/route.ts`) must also add +1 day to `to_date`.
- **Supabase UTC timestamp boundaries:** NEVER use hardcoded `T00:00:00Z`/`T23:59:59Z` suffixes — they align to UTC midnight, not Central time. Always use `dateBoundsUTC(from, to)` from `data.ts` which computes correct UTC boundaries for America/Chicago timezone.
- **Server-side `getMonday()`/`getToday()`:** Use America/Chicago timezone, not UTC. UTC `.toISOString().split("T")[0]` gives wrong date during evening hours in Central time.
- **Supabase default row limit is 1000.** Queries returning more rows (e.g. company-wide `door_knocks`) must paginate with `.range()`. Without pagination, results are silently truncated.

## Environment Variables

```
REPCARD_API_KEY=...
QB_API_TOKEN=...
NEXT_PUBLIC_SUPABASE_URL=https://yijofudhciynjzsmpsqp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
CRON_SECRET=...
```
