# KIN Pulse V2 — Build Specification

## Vision
Best-in-class sales performance platform. Every metric accurate. Every drill-down meaningful. Every rep and leader can find exactly what they need in seconds. Mobile-first. Real-time.

## Current Issues
1. **Data inconsistency** — numbers don't match across pages (setter stats on main page vs rep page vs office page)
2. **No drill-down** — can't click into metrics to see what feeds into them
3. **No sorting** — leaderboards are static, can't sort by different columns
4. **No personalization** — no "My Office" or "My Stats" quick views
5. **Limited navigation** — hard to move between views
6. **Not mobile optimized** — layout breaks on phones
7. **Metric attribution** — some setters/closers may be misattributed due to matching logic

## Architecture Principles
- **Single source of truth**: The scorecard API is the canonical data source. All pages should derive from consistent data.
- **Correct attribution**: RepCard ID matching (FID 2277 closer, FID 2279 setter) is primary. Name fallback is secondary.
- **Cancel handling**: `isCancel()` = status.toLowerCase().includes('cancelled') || status.toLowerCase().includes('pending cancel'). Always filter from active counts.
- **Install Complete (FID 534)** for install counts, NOT Sale Date.

## Navigation Structure
```
┌─────────────────────────────────────────────┐
│  KIN PULSE    [Dashboard] [Offices] [Reps]  │
│               [Quality] [Trends]            │
│               [My Office ▾] [My Stats ▾]    │
└─────────────────────────────────────────────┘
```

### Tabs
1. **Dashboard** — company-wide overview, top metrics, leaderboards
2. **Offices** — all offices grid, click into any office
3. **Reps** — all reps searchable/filterable, click into any rep
4. **Quality** — appointment quality, star ratings, waste analysis
5. **Trends** — time-series charts, week-over-week
6. **My Office** — dropdown to select office, bookmarkable URL
7. **My Stats** — dropdown to select rep, bookmarkable URL

## Dashboard Page (/)
### Top Metrics Row
- Total Appointments Set (YTD)
- Total QB Closes (active, excludes cancels)
- Total kW Sold (active)
- Company Close Rate (QB closes / total sits)
- Cancel Rate (cancelled / (active + cancelled))

### Leaderboard Tabs: [Setters] [Closers] [Offices]
Quick toggle between three leaderboard views.

### Setter Leaderboard (default view)
Default sort: **Appointments Set** (desc)
Columns: Rank | Name | Office | Appts Set | Sits | QB Closes | Close % | ⭐ Avg | Waste %
- **Sortable** by any column (click header)
- **Expandable rows** — click row to show:
  - Outcome breakdown: CANC | NOSH | NTR | RSCH | CF | SHAD
  - Quality breakdown: ⭐ | ⭐⭐ | ⭐⭐⭐ counts
  - Link to full rep profile

### Closer Leaderboard
Default sort: **QB Closes** (desc)
Columns: Rank | Name | Office | QB Closes | kW | Avg PPW | Sits | Close % | Cancel % | Cancel Count
- **Expandable rows** — click row to show:
  - Outcome breakdown: NOCL | CF | FUS | CANC
  - Active vs cancelled deal list
  - Link to full rep profile

### Office Leaderboard
Default sort: **QB Closes** (desc)
Columns: Rank | Office | QB Closes | kW | Appts Set | Sits | Close % | Cancel % | Active Reps
- **Expandable rows** — click to show:
  - Top 3 closers, top 3 setters
  - Setter/closer counts
  - Link to full office page

## Office Page (/office/[name])
- Office header with key stats
- Setter table (same columns as main, filtered to office)
- Closer table (same columns as main, filtered to office)
- Recent deals list
- Activity feed (recent knocks, appointments from Supabase)

## Rep Page (/rep/[id])
Baseball card style:
- Photo (from RepCard), name, role badge (Setter/Closer/Both), office
- Key stats: Appts/Closes/kW/Stars/Close%/Cancel%
- **Appointment history** — every appointment with outcome, date, contact
- **Deal matches** — QB deals matched to this rep
- **Quality breakdown** — star distribution chart
- **Outcome distribution** — pie/bar chart of disposition codes
- **Contact timeline** — for closers, show lifecycle of their deals

## Data Consistency Rules
1. A setter's `appointments` count on the main page MUST match their count on their rep page
2. A closer's `qbCloses` on the main page MUST match their rep page
3. Office `qbCloses` = sum of all closers' `qbCloses` in that office
4. Company `totalSales` = sum of all office sales
5. Cancel % formula: `cancelled / (active + cancelled) * 100` — consistent everywhere
6. Close % formula: `qbCloses / sits * 100` — consistent everywhere

## API Improvements Needed
- `/api/scorecard` — ensure all metrics are computed from same base query
- `/api/rep/[id]` — must use identical logic to scorecard for consistency
- `/api/office/[name]` — must use identical logic to scorecard for consistency
- Consider: single data-fetch function shared by all three APIs

## Mobile Design
- Stack leaderboard columns on mobile (show key 3-4 cols, swipe for more)
- Bottom tab navigation on mobile
- Cards stack vertically
- Touch-friendly expandable rows (larger tap targets)
- Responsive text sizes

## Coaching Philosophy — Every Number Tells a Story

This is NOT a reporting tool. It's a COACHING tool. Every metric should answer: "What should I do differently?"

### Setter Coaching Questions (the dashboard should make these obvious)
- **Effort**: Are they knocking enough doors? Volume matters.
- **Quality**: Are they getting power bills? (star ratings — ⭐⭐ and ⭐⭐⭐)
- **Urgency**: Are they setting within 48 hours? (3-star = power bill + <48hrs)
- **Reliability**: Are their appointments actually sitting? (no-show rate, cancel rate)
- **Pipeline quality**: Are the sits turning into closes? If not — credit fails (bad qualifying) or closer issue?

### Closer Coaching Questions
- **Conversion**: Are they closing the sits they get? (close rate)
- **Failure modes**: What kills deals? NOCL = sales skill issue. CF = setter sent bad lead. FUS = not closing first visit.
- **Retention**: Are deals sticking? (cancel rate)
- **Pipeline**: Are they getting enough sits? (setter volume feeding them)

### Office/Leader Coaching Questions
- **Bottleneck identification**: Not enough doors? Not enough sits? Not enough closes?
- **Setter coaching needs**: High no-show, low stars, no power bills → specific reps to coach
- **Closer coaching needs**: Low close rate, high cancel rate → specific reps to coach
- **Quality distribution**: What % of appointments are 1/2/3 star?

### Insight Badges & Callouts
Display contextual insights where data reveals something actionable:
- "⚠️ 60% of appointments have no power bill"
- "🔥 3-star appointments close at 2x the rate"
- "📉 45% no-sit rate — setter coaching needed"
- "🎯 Top closers have <15% cancel rate"
- "⏰ Same-day/next-day sets have 30% higher sit rate"

### The Test
For every screen, ask: "If an office manager looked at this at 7am, would they know exactly what to focus on today?" If not, it's not done.

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- SWR for client data fetching
- Recharts for visualizations
- Supabase for real-time data
- QuickBase API for deal data
- RepCard API for activity data
