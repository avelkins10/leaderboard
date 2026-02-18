# KIN Sales Intel — V0 Handoff Document

## What This App Does
Sales analytics dashboard for a solar installation company (KIN Home). Merges field activity data from RepCard (door knocks, appointments, dispositions) with verified sales data from QuickBase. Real-time via webhooks, historical via API backfill stored in Supabase.

## Tech Stack
- **Next.js 14** (App Router, TypeScript, Tailwind CSS)
- **Recharts** for charts
- **Supabase** for real-time data (webhooks + historical)
- **RepCard API** for field activity (door knocks, appointments, dispositions)
- **QuickBase API** for verified sales data
- Deployed on **Vercel**

## Current File Structure
```
src/
├── app/
│   ├── page.tsx                          # Dashboard
│   ├── layout.tsx                        # Root layout
│   ├── office/[name]/page.tsx            # Office detail
│   ├── rep/[id]/page.tsx                 # Rep profile
│   ├── quality/page.tsx                  # Quality metrics
│   ├── trends/page.tsx                   # Week-over-week trends
│   └── api/
│       ├── scorecard/route.ts            # Main data endpoint
│       ├── office/[name]/route.ts        # Office detail data
│       ├── rep/[id]/route.ts             # Rep detail data
│       ├── trends/route.ts               # Multi-week data
│       ├── snapshot/route.ts             # Supabase weekly snapshot
│       ├── backfill/route.ts             # One-time 2026 backfill
│       └── webhooks/repcard/[event]/route.ts  # Webhook receiver
├── components/
│   ├── Nav.tsx
│   ├── MetricCard.tsx
│   ├── Section.tsx
│   ├── WeekPicker.tsx
│   ├── Tooltip.tsx
│   ├── StatusBadge.tsx
│   └── FunnelChart.tsx
├── lib/
│   ├── config.ts                         # Office mapping, env vars
│   ├── quickbase.ts                      # QB API client
│   ├── repcard.ts                        # RepCard API client
│   └── supabase.ts                       # Supabase client
public/
├── logo-white.png                        # KIN logo (white, for dark headers)
└── logo.png                              # KIN logo (color)
```

## Design Guidelines
- **Dark theme** — gray-950 base
- **KIN branding** — use white logo in header/nav
- **Color coding** for metrics:
  - Green = good (high sit%, high close%, low waste%)
  - Yellow = warning
  - Red = bad (low sit%, high waste%, big discrepancies)
- **Responsive** — works on desktop and tablet (office managers use iPads)
- **Tooltips** — every metric should have an explainer on hover

## Pages to Build/Redesign

### 1. Dashboard (`/`)
The main view. At a glance: how's the company doing this week?

**Content:**
- Summary cards: total deals, total kW, avg system size, avg PPW
- Active reps badge per office (who's in the field TODAY)
- Office scorecard table — every office with: doors, sets, sits, QB closes, sit%, close%, waste%, avg appointment quality (⭐), active reps
- Top closers (by QB verified closes)
- Top setters (by appointment quality + volume)
- Week picker (prev/next/today)

### 2. Office Detail (`/office/[name]`)
Drill into one office.

**Content:**
- Office header with region, active rep count
- Summary cards
- Sales funnel visualization: Doors → Appointments → Sits → Closes (with conversion rates between each step)
- Setter accountability table:
  | Setter | Set | ⭐ Avg | No Show | Cancel | Sits | QB Closes | Sit% | Close% | Waste% |
- Closer table:
  | Closer | Leads | Sat | QB Closes | RC Claims | Sit/Close% | CF | Shade | No Close | 1 Leg | FU |
- Highlight discrepancy when RC Claims > QB Closes

### 3. Rep Baseball Card (`/rep/[id]`)
Individual rep profile — designed like a sports trading card.

**Setter Card:**
- Header: profile photo, name, role badge (🟢 Rookie / 🔵 Veteran / ⭐ Area Director), office, region
- Composite rep score
- Primary stats grid:
  - Doors Knocked
  - Appointments Set
  - ⭐ Avg Appointment Quality (1.0–3.0)
  - Sit Rate %
  - Close Rate % (QB verified)
  - Waste Rate %
  - Doors to Deal (D/$)
- Quality breakdown: how many ⭐, ⭐⭐, ⭐⭐⭐ appointments
- Records & highlights: biggest day, best week, time in field
- Disposition impact: what happened to their appointments (pie/bar chart)

**Closer Card:**
- Header: same as setter
- Primary stats:
  - Assigned Leads
  - Appointments Sat
  - QB Verified Closes
  - Sit/Close %
  - Total kW Sold
  - Avg System Size
  - Avg PPW
- Disposition breakdown (pie chart): Closed, No Close, CF, Shade, 1 Legger, Follow Up
- Records: biggest day, biggest deal, best week
- Small section for setting stats if they also knock doors

**Office Card (`/office/[name]/card`):**
- Office name, region, manager
- Team stats: doors, sets, sits, closes, quality avg, kW
- Mini roster: photo thumbnails of each rep with their key stat
- Top performer highlighted
- Office records: best day, best week

### 4. Quality Page (`/quality`)
Teaching tool — helps reps understand what makes a good appointment.

**Content:**
- Education cards explaining:
  - What is a quality appointment? (power bill + <48hrs)
  - ⭐ Star system explained
  - Why no-shows happen
  - Why credit fails happen
  - What is a 1-legger
- Office quality comparison (bar chart of avg ⭐ rating per office)
- Setter quality table sorted by worst waste rate first (coaching focus)

### 5. Trends (`/trends`)
Week-over-week performance tracking.

**Content:**
- Company-wide line chart: deals/doors/sits/closes over time
- Multi-office comparison with toggleable offices
- Metric selector (deals, doors, sits, closes, quality avg)
- 4/6/8 week range selector
- Week-over-week change cards with trend arrows (↑ 12% or ↓ 5%)

## ⭐ Appointment Quality System (3-Star Rating)
This is core to the product.

- ⭐ (1 star) = Appointment was set
- ⭐⭐ (2 stars) = Appointment has power bill attached
- ⭐⭐⭐ (3 stars) = Power bill attached AND scheduled within 48 hours of lead creation

**Per setter:** Average star rating across all their appointments = their quality score
**Per office:** Average across all setters

Display as actual stars (⭐⭐⭐ or ⭐⭐☆) or as a number (2.7/3.0).

## Data Available from API

### GET /api/scorecard?from=YYYY-MM-DD&to=YYYY-MM-DD
Returns:
```json
{
  "period": { "from": "...", "to": "..." },
  "summary": { "totalSales": 8, "totalKw": 70.4, "avgSystemSize": 8.8, "avgPpw": 3.25 },
  "offices": {
    "Office Name": {
      "setters": [{ "userId": 123, "name": "...", "qbOffice": "...", "DK": 150, "APPT": 10, "SITS": 6, "qbCloses": 3, ... }],
      "closers": [{ "userId": 456, "name": "...", "LEAD": 8, "SAT": 6, "CLOS": 4, "qbCloses": 3, "CF": 1, "SHAD": 0, "NOCL": 1, "FUS": 1 }],
      "setterAppts": [{ "APPT": 10, "CANC": 2, "NOSH": 1, "NTR": 1, "RSCH": 0 }],
      "closerAppts": [{ ... }],
      "sales": { "deals": 3, "kw": 26.4 },
      "activeReps": 5
    }
  },
  "salesByCloser": { "David Smith": { "deals": 2, "kw": 17.6, "office": "..." } },
  "salesBySetter": { "Cameron Bott": { "deals": 1, "kw": 8.8 } },
  "activeRepsByOffice": { "Stevens - Iowa 2025": 12 }
}
```

### Setter stats available per rep:
- DK (doors knocked), NP (no pitch), QP (qualified pitch)
- APPT (appointments set), SITS (appointments sat), CLOS (closed pending KCA)
- SIT% (set/sit ratio), D/$ (doors to deal)
- qbCloses (QuickBase verified closes)
- From appointment data: CANC, NOSH, NTR, RSCH
- Calculated: waste rate, close rate

### Closer stats available per rep:
- LEAD (assigned leads), SAT (appointments sat)
- CLOS (claimed closes / pending KCA), qbCloses (QB verified)
- CLSE (sit/close %), CF (credit fails), SHAD (shade/offset DQ)
- NOCL (no close), FUS (follow up)
- From QB: deals, kW, avg PPW

### Supabase appointments table (for quality scoring + drill-downs):
Each appointment record has:
- setter_id, setter_name, closer_id, closer_name
- contact_name, contact_phone, contact_address, contact_city, contact_state
- latitude, longitude (GPS)
- office_team, office_region
- appointment_time, lead_created_at
- hours_to_appointment (calculated)
- has_power_bill (boolean), power_bill_urls (array of S3 image URLs)
- is_quality (boolean — has_power_bill AND hours <= 48)
- disposition, disposition_category ("Sit", "No Sit", "Reschedule")
- setter_notes (raw notes from setter to closer)
- both_spouses_present (1-legger flag)

### Supabase door_knocks table (for active reps + daily tracking):
- rep_id, rep_name, office_team, office_region
- address, city, state, latitude, longitude
- outcome (e.g., "Pitched - Not Interested")
- knocked_at (timestamp)

### Rep photos:
Available from RepCard user object: `user.image` field contains S3 URL.
Example: `https://s3-ap-southeast-2.amazonaws.com/repcard/users/JgbvD17603877071693.jpg`

### Rep roles (for badge display):
From `user.role`:
- "Rookie - Setter"
- "Veteran - Setter"
- "Closer"
- "Area Director"
- "Regional Manager"

## ⏰ Timezone Requirements (IMPORTANT)
Offices span multiple US timezones. All user-facing times MUST display in the rep's local timezone.

| Region | Timezone |
|--------|----------|
| Dynasty (Douglass, Free, Allen) | America/New_York (Eastern) |
| Richards (Molina, Bontrager) | America/New_York (Eastern) |
| Champagne | America/New_York (Eastern) |
| Bitton (Stevens, Bitton, Johnson) | America/Chicago (Central) |
| Adams | America/Los_Angeles (Pacific) |

- Door knock times, appointment times, "knocking hours" displays → all in local tz
- Leaderboard metrics → timezone-aware when showing daily breakdowns
- The webhook/API data stores times in UTC — convert for display

## Office Mapping
RepCard "Team" = actual office. RepCard "Office" = region.

| RepCard Team | QB Sales Office | Region |
|---|---|---|
| Stevens - Team 2026 | Stevens - Iowa 2025 | Bitton |
| Bitton - Team 2026 | Stevens - Iowa 2025 | Bitton |
| Johnson - Team 2026 | Stevens - Iowa 2025 | Bitton |
| Bontrager - Fort Myers 2026 | Bontrager - Cincinnati 2025 | Richards |
| Molina - Tampa Bay 2026 | Molina - KC 2025 | Richards |
| Douglass - Winter Haven 2026 | Douglass - Winter Haven 2025 | Dynasty |
| Free - Elevate Orlando 2026 | Elevate - Orlando East 2025 | Dynasty |
| Allen - Orlando 2026 | Allen - Orlando West 2025 | Dynasty |
| Champagne - Panama City 2026 | Champagne - Panama City 2025 | Champagne |
| Adams - San Jose 2025 | Adams - San Jose 2025 | Adams |

## Key Business Rules
1. **A close only counts if it's in QuickBase.** RepCard "Closed (Pending KCA)" is a claim, not a verified close.
2. **Sit/Close % = QB closes ÷ RepCard SAT** (not RepCard CLOS / SAT)
3. **Waste = No Shows + Cancels + Dead Reschedules** (setter's fault)
4. **Quality = power bill + <48hrs** (3-star system)
5. **Setters own appointment quality** — credit fails, shade DQs, no-shows all reflect on the setter
6. **Two-way accountability** — setters can drill into dispositions to challenge closer claims

## Color Thresholds
| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Setter Sit Rate | >50% | 30-50% | <30% |
| Setter Close Rate | >15% | 8-15% | <8% |
| Setter Waste Rate | <15% | 15-30% | >30% |
| Appointment Quality | ⭐⭐⭐ (2.5+) | ⭐⭐ (1.5-2.4) | ⭐ (<1.5) |
| RC Claims vs QB Closes | Match | Small gap | Big gap |
