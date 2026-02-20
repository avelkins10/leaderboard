# Office Cards + Field Time from Supabase — Design

## Part 1: Field Time from Supabase door_knocks

New query `getFieldTimeStats(repIds, from, to, timezone)` in `supabase-queries.ts`:
- Query `door_knocks` table filtered by rep_ids and date range
- Group by rep_id + date (converted to local timezone)
- Per day per rep: first knock = min(knocked_at), last knock = max(knocked_at), hours = last - first
- Return per-rep averages: avg start time, avg end time, avg hours/day
- For office summaries: aggregate across all reps
- Replaces RepCard FDK/LDK/QHST leaderboard values

## Part 2: Office Detail Page Redesign

### Setter Summary Cards
- Row 1 (big): Total Appts | Total Sits | QB Closes
- Row 2 (compact): Conversion (Set/Sit% + Sit/Close%) | Quality (PB% + Avg Stars) | Avg Field Time (Hours + Start)

### Closer Summary Cards
- Row 1 (big): Total Assigned | Total Sat | QB Closes
- Row 2 (compact): Close % | Cancels + Cancel %

### Setter Accountability Table (10 cols)
# | Setter | Appts | Sits | Closes | Set/Sit% | Sit/Close% | PB% | Stars | Hrs | Start

### Closer Table (8 cols)
# | Closer | Assigned | Sat | Closes | Close% | Cancel% | kW | PPW

### Keep as-is
- Sales Funnel section
- Partnerships section
- Secondary KPIs (Installs, Speed to Close)

## Part 3: Rep Profile Update

Replace RepCard FDK/LDK/QHST in Field Time compact card with Supabase door_knocks computed values. Same data source as office page.
