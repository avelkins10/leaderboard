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
    ├── / — Dashboard (home, leaderboards, office scorecards)
    ├── /office — Office directory
    ├── /office/[name] — Office detail (setter accountability, closer stats, funnel)
    ├── /rep — Rep directory
    ├── /rep/[id] — Rep profile (coaching metrics, quality, appointments, sales)
    ├── /quality — Quality page
    ├── /trends — Trends page
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

### Active Rep Definition

- Setter active = `DK > 0` (knocked doors)
- Closer active = `SAT >= 1` (sat appointments)
- Deduplicate by userId (same person can be both)

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

- `src/lib/data.ts` — Core data processing: aggregation, cancel detection, office mapping, rep attribution
- `src/lib/repcard.ts` — RepCard API client (leaderboards, users, appointments)
- `src/lib/quickbase.ts` — QuickBase API client (sales/deals)
- `src/lib/supabase.ts` — Supabase client (admin + anon)
- `src/lib/supabase-queries.ts` — Supabase query functions (quality stats, partnerships)
- `src/lib/config.ts` — Office mapping, API keys, team→QB office mapping

### Config

- `src/lib/config.ts` — `OFFICE_MAPPING` maps RepCard team IDs to QB office names. `normalizeQBOffice()` and `qbOfficeToRepCardTeams()` handle the mapping.
- `src/lib/rep-roles.json` — Manual role overrides by RepCard user ID

### Webhook Handler

- `src/app/api/webhooks/repcard/[event]/route.ts` — Processes all RepCard webhook events. Computes star_rating, has_power_bill, hours_to_appointment. Upserts to Supabase `appointments` table.

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

### Office Name Mapping

QB uses names like "Stevens - Iowa 2025". RepCard uses team IDs mapping to names like "Stevens - Team 2026". `normalizeQBOffice()` handles the translation.

## Gotchas / Lessons Learned

- **QB date queries:** `AF`/`BF` = strictly after/before (excludes boundary). Use `OAF`/`OBF` = on or after/before.
- **RepCard per_page max is 100.** Always paginate.
- **RepCard appointments API does NOT include attachments inline.** Use `/appointments/attachments` and `/customers/attachments` endpoints separately.
- **Supabase `office_team` can be null** if appointment was synced from API (not webhook). Repair by mapping setter_id → team from users API.
- **`hours_to_appointment`** is lead creation → appointment time, NOT appointment creation → appointment time.
- **RepCard leaderboard CLOS stat includes "Closed (Pending KCA)"** — it's broader than QB verified closes.
- **`contact.createdAt`** in webhook payload = lead creation date. In RepCard appointments API, `createdAt` = appointment creation date. Different things.
- **Rejected ≠ Cancelled** — Rejected means intake kicked it back for corrections. Deal is still alive.
- **PPW outlier filtering:** `isValidPpw()` excludes PPW outside 0.5–8.0 from averages. Defined in `data.ts`.
- **Recruit prefix:** Rep names starting with "R - " are recruits. `cleanRepName()` strips the prefix, `isRecruit()` flags them.
- **avgStars:** Computed per setter from Supabase `appointments.star_rating` in `fetchScorecard()`. Not a RepCard API field.

## Environment Variables

```
REPCARD_API_KEY=...
QB_API_TOKEN=...
NEXT_PUBLIC_SUPABASE_URL=https://yijofudhciynjzsmpsqp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
CRON_SECRET=...
```
