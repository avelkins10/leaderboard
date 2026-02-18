# Office Mapping

## Hierarchy

```
RepCard "Office" = Region (e.g., "Bitton Region", "Dynasty Region")
RepCard "Team"   = Actual office (e.g., "Stevens - Team 2026", "Douglass - Winter Haven 2026")
QB "Sales Office" = Canonical office name (e.g., "Stevens - Iowa 2025")
```

One QB office can have **multiple** RepCard teams (e.g., Stevens - Iowa consolidates Stevens + Bitton + Johnson teams). One RepCard team maps to **one** QB office.

## Active Mapping (2026)

| QB Sales Office | RepCard Team(s) | Team ID(s) | Region | Timezone |
|----------------|-----------------|------------|--------|----------|
| Stevens - Iowa 2025 | Stevens - Team 2026 | 5671 | Bitton Region | America/Chicago |
| | Bitton - Team 2026 | 6737 | Bitton Region | America/Chicago |
| | Johnson - Team 2026 | 7141 | Bitton Region | America/Chicago |
| Bontrager - Cincinnati 2025 | Bontrager - Fort Myers 2026 | 5818 | Richards Region | America/New_York |
| Molina - KC 2025 | Molina - Tampa Bay 2026 | 5674 | Richards Region | America/New_York |
| Douglass - Winter Haven 2025 | Douglass - Winter Haven 2026 | 5822 | Dynasty Region | America/New_York |
| Elevate - Orlando East 2025 | Free - Elevate Orlando 2026 | 5823 | Dynasty Region | America/New_York |
| Allen - Orlando West 2025 | Allen - Orlando 2026 | 5824 | Dynasty Region | America/New_York |
| Champagne - Panama City 2025 | Champagne - Panama City 2026 | 6311 | Champagne Dynasty | America/New_York |
| Adams - San Jose 2025 | Adams - San Jose 2025 | 6923 | Adams Region | America/Los_Angeles |

## Inactive Teams (still in config for historical data)

| RepCard Team | Team ID | Region | Notes |
|-------------|---------|--------|-------|
| Sawade - Louisville 2025 | 5673 | Richards Region | |
| Bryant - Columbus 2025 | 5675 | Richards Region | |
| Scariano - Crestview 2025 | 6312 | Champagne Dynasty | |
| Brewton - Ohio 2025 | 6714 | The Ohio State | |
| West - SoCal 2025 | 6715 | Dwest Region | |
| Pre Richards 2025 | 4714 | Richards Region | Regional-level, no QB office |

## Name Changes / Moves (2025 → 2026)

- **Molina - KC 2025** → renamed to **Molina - Tampa Bay 2026** (same team, new location)
- **Bontrager - Cincinnati 2025** → renamed to **Bontrager - Fort Myers 2026** (moved to Florida)
- QB still uses the 2025 names as canonical

## How Mapping Works in Code

The mapping is defined in `src/lib/config.ts` as `OFFICE_MAPPING` keyed by RepCard team ID.

### Helper Functions

```typescript
// RepCard team ID → QB office name
teamIdToQBOffice(5671) // → "Stevens - Iowa 2025"

// QB office name → all RepCard team names
qbOfficeToRepCardTeams("Stevens - Iowa 2025")
// → ["Stevens - Team 2026", "Bitton - Team 2026", "Johnson - Team 2026"]

// RepCard team name → QB office name
repCardTeamToQBOffice("Molina - Tampa Bay 2026") // → "Molina - KC 2025"

// Get timezone by either name
getTimezoneForTeam("Stevens - Team 2026")    // → "America/Chicago"
getTimezoneForTeam("Stevens - Iowa 2025")     // → "America/Chicago"
getOfficeTimezone("Stevens - Iowa 2025")       // → "America/Chicago" (QB name only)
```

## Important Notes

- **Supabase stores RepCard team names** (e.g., "Molina - Tampa Bay 2026") in `office_team` columns
- **Dashboard displays QB office names** (e.g., "Molina - KC 2025")
- When querying Supabase by office, always use `qbOfficeToRepCardTeams()` to get the correct filter values
- QB also stores RepCard team info directly on deals: FID 2393 (`rc_team`), FID 2392 (`rc_team_id`)
