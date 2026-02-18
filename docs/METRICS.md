# Metrics & Calculations

## Core Principle

**A close only counts if it's in QuickBase.** RepCard "Closed (Pending KCA)" is a claim, not a verified close. All close rates use QB Sale Date (FID 522) as the source of truth.

---

## Setter Metrics

### From RepCard Leaderboard
| Metric | Short | Description |
|--------|-------|-------------|
| Door Knocks | DK | Total doors knocked |
| Not Home | NP | Nobody answered |
| Qualified Pitches | QP | Got to pitch |
| Appointments Set | APPT | Appointments created |
| Sits | SITS | Appointments that happened (closer showed) |
| Closes (RepCard) | CLOS | RepCard-claimed closes (NOT authoritative) |
| Sit Rate | SIT% | SITS / APPT |
| Quality Hours | QHST | Hours spent knocking |
| Doors/Quality Hour | D/QH | DK / QHST |
| First Door Knock | FDK | Time of first knock |
| Last Door Knock | LDK | Time of last knock |
| Time Since First | TSF | LDK - FDK (time in field) |
| Door Knock Days | DKD | Days with at least 1 knock |

### From RepCard Appointment Data
| Metric | Description |
|--------|-------------|
| APPT | Total appointments |
| CANC | Canceled appointments |
| NOSH | No-shows |
| NTR | Not interested / DQ |
| RSCH | Rescheduled |

### Setter Accountability (Calculated)
| Metric | Formula | Description |
|--------|---------|-------------|
| QB Closes | Count of QB sales where setter_repcard_id matches | Verified closes |
| Sit/Close % | QB Closes ÷ RepCard SAT | True conversion rate |
| Waste Rate | (No Shows + Cancels + Dead Reschedules) ÷ Total Appts | Wasted appointments |
| Active | Has ≥1 door knock in the date range (from Supabase) | Currently working |

---

## Closer Metrics

### From RepCard Leaderboard
| Metric | Short | Description |
|--------|-------|-------------|
| Appointments | APPT | Appointments assigned |
| Sits | SITS | Appointments that happened |
| Closes (RepCard) | CLOS | RepCard-claimed closes |
| Sit Rate | SIT% | SITS / APPT |
| Close Rate | CLOSE% | CLOS / SITS |

### From RepCard Appointment Data (Dispositions)
| Disposition | Key | Description |
|-------------|-----|-------------|
| Closed | CLOS | Deal signed (RepCard claim) |
| No Show | NOSH | Homeowner wasn't there |
| Canceled | CANC | Appointment canceled |
| Credit Fail | CF | Failed credit check |
| Shade | SHADE | Property has too much shade |
| One Legger | 1LEG | Only one decision maker present |
| No Close | NOCL | Pitched but didn't close |
| Follow Up | FU | Needs follow-up visit |
| Reschedule | RSCH | Rescheduled for later |

### Closer QB Stats (from QuickBase)
| Metric | Formula | Description |
|--------|---------|-------------|
| Total Deals | Count of QB sales where closer_repcard_id matches | Verified closes |
| Total kW | Sum of system sizes | Volume sold |
| Avg System Size | Total kW ÷ Total Deals | Average install size |
| Avg PPW | Avg of Net PPW (FID 543) | Average price per watt |

### Discrepancy Detection
RepCard CLOS vs QB Closes are shown side-by-side per closer. Discrepancies highlight potential issues:
- RC > QB = closer claiming closes that aren't in CRM
- QB > RC = closes entered in CRM but not dispositioned in RepCard

---

## Appointment Quality (3-Star System)

Quality is **setter-owned**. Stars measure how well the setter prepared the appointment.

| Stars | Criteria | Description |
|-------|----------|-------------|
| ⭐ | Appointment set | Bare minimum — just got the appointment |
| ⭐⭐ | + Power bill attached | Setter collected the homeowner's power bill |
| ⭐⭐⭐ | + Power bill AND scheduled within 48 hours | High-quality: bill collected + timely scheduling |

### Calculation
```
star_rating = 1  // base
if (has_power_bill) star_rating = 2
if (has_power_bill AND hours_to_appointment <= 48 AND hours_to_appointment > 0) star_rating = 3
is_quality = (star_rating === 3)
```

### Power Bill Detection
Power bills are detected from RepCard webhook payloads:
1. **Primary**: `appointment.attachments[]` — files attached to the appointment
2. **Secondary**: `contact.attachment`, `contact.latestAttachment`, `contact.soloAttachment` — lead-level attachments
3. If ANY attachment exists, `has_power_bill = true`

### Hours to Appointment
```
hours_to_appointment = (appointment_time - appointment_set_time) / (1000 * 60 * 60)
```
Calculated when the appointment-set webhook fires. Negative or zero values are treated as invalid.

---

## Office Scorecard

Each office card shows:

| Section | Metrics |
|---------|---------|
| **Header** | Office name, active reps count, total door knocks |
| **Sales** | QB verified deals, total kW |
| **Setter Table** | Per-setter: DK, APPT, SITS, QB Closes, Waste, Quality Stars |
| **Closer Table** | Per-closer: RC Claims vs QB Closes, dispositions, Sit%, Close% |

### Active Reps
- **Current week**: Unique reps with ≥1 door knock today (timezone-aware)
- **Historical week**: Unique reps with ≥1 door knock in that date range
- Source: Supabase `door_knocks` table (real-time webhook data)

---

## Waste Analysis

**Waste = appointments that produced no value**

| Category | Description |
|----------|-------------|
| No Shows | Homeowner wasn't there |
| Cancels | Appointment canceled before it happened |
| Dead Reschedules | Rescheduled but never got a real follow-up (94% of reschedules) |

**Waste Rate** = (No Shows + Cancels + Dead Reschedules) ÷ Total Appointments

### Who Owns What
- **Setter owns**: No-shows (bad scheduling), shade DQs (should've checked), credit fails (should've pre-qualified)
- **Closer owns**: Close rate on quality sits, follow-up on reschedules
- **Two-way accountability**: Setters can challenge closer dispositions; closers can see setter quality

---

## Time Handling

All user-facing times display in the rep's **local timezone**:

| Region | Timezone |
|--------|----------|
| Dynasty (Douglass, Free/Elevate, Allen) | America/New_York |
| Richards (Bontrager, Molina) | America/New_York |
| Champagne | America/New_York |
| Bitton (Stevens, Bitton, Johnson) | America/Chicago |
| Adams | America/Los_Angeles |

Timezone is determined by office via `getTimezoneForTeam()` or `getOfficeTimezone()`.
