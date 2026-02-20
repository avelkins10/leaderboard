# KIN Pulse — Punch List & Improvements

_Living document. Jerry audits and updates this continuously._
_Last updated: 2026-02-17 23:41 MST_

## 🔴 Critical — Data Accuracy

### C1: Rep API uses different leaderboard call than scorecard

- `scorecard` → `getTypedLeaderboards('closer')` + `getTypedLeaderboards('setter')` (filtered)
- `rep/[id]` → `getLeaderboards()` (unfiltered, returns ALL types)
- **Risk:** Different data returned by API based on filter presence
- **Fix:** Rep API should use `getTypedLeaderboards()` or shared `fetchScorecard()`

### ~~C2: Name matching uses .includes() — can false-match~~ ✅ FIXED

- `getRepSales()` in `data.ts`: `s.closerName?.toLowerCase().includes(fullName.toLowerCase())`
- "David Smith" would match "David Smithson"
- **Fix:** Use exact match or word-boundary match. Compare normalized full names with `===` after trimming.
- **Status:** Fixed in `data.ts` — `getRepSales()` now uses exact match (`===`) after trim

### ~~C3: QB date query is exclusive on upper bound~~ ✅ VERIFIED OK

- `BF` is exclusive but `useDateRange` already adds +1 day before sending
- Confirmed: `to=2026-02-18` with `BF.2026-02-18` returns 165 deals (includes Feb 17)

### ~~C4: Frontend field name mismatch after data.ts refactor~~ ✅ FIXED

- `data.ts` returns `allSetters` / `allClosers`
- `page.tsx` expects `setterLeaderboard` / `closerLeaderboard`
- **Fix:** Either rename in data.ts or remap in scorecard route
- **Status:** Fixed — `data.ts` returns `allSetters`/`allClosers`, `page.tsx` uses the same names

### ~~C5: Rep API redefines isCancel locally (shadowing import)~~ ✅ FIXED

- Line ~150 of `rep/[id]/route.ts` defines `const isCancel = ...` despite importing from data.ts
- Could drift from canonical implementation
- **Fix:** Remove local definition, use imported isCancel
- **Status:** Fixed — `rep/[id]/route.ts` now imports `isCancel` from `data.ts` without local override

### C6: QB query max 500 records

- `qbQuery()` defaults to `top = 500`
- Currently fine (165 YTD deals) but will break at scale or for historical queries
- **Fix:** Implement pagination or increase `top` to 2000

## 🟡 Important — UX/UI

### U1: No sortable leaderboard columns

- Currently static order
- **Fix:** Click-to-sort headers, default: Appts desc (setters), QB Closes desc (closers)

### U2: No expandable drill-down rows

- Can't see what feeds into a metric
- **Fix:** Click row → expand to show outcome breakdown (CANC/NOSH/NTR/RSCH/CF/SHAD for setters, NOCL/CF/FUS/CANC for closers)

### U3: No tab toggles for Setters/Closers/Offices

- All crammed into one page
- **Fix:** [Setters] [Closers] [Offices] tabs switching leaderboard views

### U4: No "My Office" view

- Leaders can't quickly see just their office
- **Fix:** Dropdown → select office → filtered view with bookmarkable URL

### U5: No "My Stats" view

- Reps can't quickly find themselves
- **Fix:** Dropdown → search/select name → goes to rep profile

### U6: No insight badges

- Raw numbers without context
- **Fix:** Add contextual callouts: "⚠️ 60% no power bill", "🔥 3-star close 2x rate", etc.

### U7: Mobile layout not optimized

- Tables don't stack well on mobile
- **Fix:** Responsive columns, touch-friendly rows, bottom tab nav

### U8: Date filter behavior unclear

- Need to verify date pickers work correctly across all pages
- Should show clear period label: "Week of Feb 17" or "YTD 2026"

## 🟢 Enhancements — Product Polish

### E1: Office comparison view

- Side-by-side comparison of two offices
- Shows where one excels vs the other

### E2: Trend sparklines in leaderboard rows

- Tiny charts showing week-over-week trend for each rep
- Instantly see who's trending up/down

### E3: Goal lines / benchmarks

- Show industry benchmarks or team targets
- "Company avg close rate: 15%" line on charts

### E4: Push notifications on milestones

- "David Smith just hit 20 closes YTD" → Telegram notification

### E5: Export to PDF / CSV

- Office managers want to print weekly reports

### E6: Dark mode toggle

- Currently dark themed but no toggle

### E7: Loading states & error handling

- Skeleton loaders, retry on failure, graceful degradation

### E8: Caching strategy

- RepCard data refreshes every page load
- Should cache in Supabase, update via webhooks
- API responses should have appropriate cache headers

### E9: Rep photo integration

- Pull from RepCard API user.image field
- Display in leaderboard rows and baseball cards

### E10: Appointment quality correlation display

- Show "3-star appointments close at X% vs 1-star at Y%"
- Makes the case for why quality matters

### E11: Deal timeline on rep profile

- Visual timeline: knock → set → sit → close/outcome → funded
- Each step with date and status

### E12: Weekly digest auto-generation

- Auto-generate Slack/Telegram weekly report from dashboard data
- Pre-formatted with key highlights and callouts
