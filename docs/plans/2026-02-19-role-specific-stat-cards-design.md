# Role-Specific Stat Cards — Design

## Goal

Replace the current one-size-fits-all stat cards on rep profiles with role-specific layouts that surface the most coaching-relevant metrics for closers and setters.

## Design: Big + Compact Card Pattern

Both roles use the same visual pattern:
- **Row 1**: 3 big hero cards showing the funnel (dark bg, large numbers)
- **Row 2**: Compact combo cards grouping related secondary metrics (smaller, multi-line)

---

## Closer Cards

### Row 1 — Funnel (Big MetricCards)
| Card | Source | Value |
|------|--------|-------|
| Assigned | RepCard Closer LB `LEAD` | count |
| Sat | RepCard Closer LB `SAT` | count |
| QB Closes | QuickBase deals | count |

### Row 2 — Compact Combo Cards
| Card | Metrics | Source |
|------|---------|--------|
| **Close %** | QB Closes / Sat × 100 | Computed |
| **Cancels** | Cancel count + Cancel % | QB deals with cancel status |

Close % color: green ≥35%, yellow ≥25%, red <25%.
Cancel % = cancelled / (closes + cancelled) × 100.

**Removed from current:** Closes (RepCard self-reported), Credit Fails, Follow Ups — these move to the Dispositions section below which already shows them.

---

## Setter Cards

### Row 1 — Funnel (Big MetricCards)
| Card | Source | Value |
|------|--------|-------|
| Appts Set | RepCard `setterCoaching.appointments` | count |
| Sat | RepCard `setterCoaching.sits` | count |
| QB Closes | QuickBase `setterCoaching.qbCloses` | count |

### Row 2 — Compact Combo Cards
| Card | Metrics | Source |
|------|---------|--------|
| **Conversion** | Sit % + Close % | Computed from setterCoaching |
| **Quality** | PB % + Avg Sched Out | Supabase quality + hours_to_appointment |
| **Field Time** | Avg Quality Hours + Avg Start + Avg End | RepCard LB: QHST, FDK, LDK (averaged across days in period) |

Sit % color: green ≥50%, yellow ≥30%, red <30%.
Close % color: green ≥15%, yellow ≥8%, red <8%.
Sched Out color: green ≤48h, yellow ≤72h, red >72h.
FDK/LDK displayed in rep's local timezone.

**Removed from current:** Doors, Pitches, Waste% — these move to the Appointment Outcomes section which already shows them.

---

## Compact Card Component

New `CompactMetricCard` — same dark bg as MetricCard but with multiple label/value rows:

```
┌─────────────────────┐
│ CONVERSION          │  ← title (uppercase, small)
│ Sit %    70.0%      │  ← row: label + value (color-coded)
│ Close %  30.0%      │  ← row: label + value (color-coded)
└─────────────────────┘
```

Each row can have its own color (green/yellow/red) based on thresholds.

---

## API Changes

Add to `setterCoaching` object:
- `avgQualityHours` — average of QHST across weekly leaderboards (or period total from setter LB)
- `avgFirstKnock` — average FDK time (formatted as HH:MM in local TZ)
- `avgLastKnock` — average LDK time

Add to `closerStats` section of response (or compute client-side):
- Close % already available from closer LB as `CLSE`
- Cancel count/% already in `closerQBStats`

No new API calls needed — all data already fetched, just needs to be included in response.

---

## What Stays the Same

- Appointment Outcomes section (setter) — unchanged
- Dispositions section (closer) — unchanged (already shows CF, FUS, etc.)
- Weekly Trend — unchanged
- Quality section — unchanged
- Appointment History — unchanged
