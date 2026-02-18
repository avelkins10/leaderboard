# Schema Reference

## Supabase Tables

### `appointments`
Core appointment tracking. Created by `appointment-set` webhook, updated by `appointment-outcome` and `appointment-update`.

| Column | Type | Description |
|--------|------|-------------|
| id | bigint (PK) | Auto-increment |
| repcard_appointment_id | bigint (unique) | RepCard's appointment ID |
| setter_id | bigint | RepCard user ID of setter |
| setter_name | text | Setter full name |
| closer_id | bigint | RepCard user ID of closer |
| closer_name | text | Closer full name |
| contact_id | bigint | RepCard contact/lead ID |
| contact_name | text | Contact full name |
| contact_address | text | Contact address |
| office_team | text | RepCard team name (NOT QB office name) |
| appointment_time | timestamptz | Scheduled appointment time |
| disposition | text | Outcome (e.g., "Closed", "No Show", "Credit Fail", "1 Legger") |
| has_power_bill | boolean | Whether power bill was attached |
| hours_to_appointment | float | Hours between appointment set and appointment time |
| is_quality | boolean | 3-star quality (has_power_bill AND hours_to_appointment <= 48) |
| star_rating | int | 1, 2, or 3 stars |
| setter_notes | text | Notes from setter |
| created_at | timestamptz | Record creation time |
| updated_at | timestamptz | Last update time |

### `door_knocks`
Real-time door knock tracking. Created by `door-knocked` webhook.

| Column | Type | Description |
|--------|------|-------------|
| id | bigint (PK) | Auto-increment |
| rep_id | bigint | RepCard user ID |
| rep_name | text | Rep full name |
| contact_id | bigint | RepCard contact ID |
| office_team | text | RepCard team name |
| knocked_at | timestamptz | When the knock happened |
| latitude | float | GPS latitude |
| longitude | float | GPS longitude |
| created_at | timestamptz | Record creation time |

**Dedup rule**: Same contact_id + rep_id within 60 seconds = skip.

### `weekly_snapshots`
Weekly office scorecards, stored by the cron job every Monday.

| Column | Type | Description |
|--------|------|-------------|
| id | bigint (PK) | Auto-increment |
| week_start | date | Monday of the week |
| office | text | QB office name |
| data | jsonb | Full scorecard snapshot |
| created_at | timestamptz | Snapshot time |

### `repcard_events`
Raw webhook event log. Every webhook payload is stored here for debugging/replay.

| Column | Type | Description |
|--------|------|-------------|
| id | bigint (PK) | Auto-increment |
| event_type | text | Webhook event name |
| payload | jsonb | Full webhook payload |
| created_at | timestamptz | Received time |

---

## QuickBase Fields We Use

### Projects Table: `br9kwm8na`

#### Sales & Matching
| FID | Name | Usage |
|-----|------|-------|
| 522 | Sales Date | Verified sale date (QB = source of truth for closes) |
| 339 | Sales Office | QB office name (e.g., "Stevens - Iowa 2025") |
| 517 | Closer Name | Closer full name |
| 337 | Setter Name | Setter full name |
| 2277 | Related Closer - repcard_id | RepCard user ID for closer (99% populated) |
| 2279 | Related Setter - repcard_id | RepCard user ID for setter (96% populated) |
| 2392 | rc_team_id | RepCard team ID from setter's record |
| 2393 | rc_team | RepCard team name from setter's record |
| 2390 | rc_office_id | RepCard office (region) ID |

#### System & Pricing
| FID | Name | Usage |
|-----|------|-------|
| 13 | System Size kW | System size in kilowatts |
| 543 | Net PPW | Net price per watt |
| 133 | System Price | Total system price |
| 344 | Lender | Financing company |
| 189 | State | Installation state |
| 255 | Project Status | Current project status |

#### Milestone Dates
| FID | Name | Populated | Source |
|-----|------|-----------|--------|
| 522 | Sales Date | 100% | Enerflo |
| 461 | Intake Completed Date | 91% | Manual |
| 312 | NTP Approval Date | 93% | Manual |
| 208 | Permit Approved | 53% | Manual |
| 178 | Install Scheduled Start Date | 50% | Arrivy |
| 534 | Install Completed Date | 43% | Arrivy |
| 491 | Passing Inspection Date | 29% | Manual |
| 538 | PTO Approved Date | 20% | Manual |

#### Funding
| FID | Name | Description |
|-----|------|-------------|
| 1913 | M1 Deposit Date | First milestone payment received |
| 1914 | M2 Deposit Date | Second milestone payment |
| 1915 | M3 Deposit Date | Third milestone payment |
| 1888/1889/1890 | Net M1/M2/M3 Received | Actual amounts received |
| 1938 | Total Receivable | Expected total |
| 1495 | Total Amount Received | Actual total received |
| 1942 | Is Funded? | Boolean funding status |

#### Commission
| FID | Name | Description |
|-----|------|-------------|
| 19 | Gross PPW | Before fees/adders |
| 545 | Dealer Fee PPW | Lender dealer fees |
| 544 | Rep Adder PPW | Rep-requested adders (reduce commission) |
| 543 | Net PPW | Final net price per watt |
| 2480 | Commissionable PPW | Rounded net PPW |
| 755 | Closer Redline | Minimum PPW threshold |
| 763 | Closer Commission Rate | Per-watt commission rate |
| 764 | Closer Total Commission | Calculated commission amount |

### Other QB Tables
| Table ID | Name | Records | Usage |
|----------|------|---------|-------|
| `bub2ixkr4` | Funding | ~4,900 | M1/M2/M3 milestone submissions |
| `btkc3zrxs` | Lender Receivable | ~6,100 | Actual lender payments |
| `bsiz6sw8r` | Costs | ~15,900 | Per-project cost tracking |
| `bsaycczmf` | Adders | child table | Customer and rep adders |
| `bu4s5xtja` | Commission Milestone Log | ~3,200 | Commission payout tracking |

---

## RepCard API Endpoints

Base URL: `https://app.repcard.com/api`
Auth: `x-api-key` header

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/users/minimal?per_page=100&page=1` | GET | All users (paginated) |
| `/users?per_page=100&page=1` | GET | Full user details |
| `/leaderboards?from=YYYY-MM-DD&to=YYYY-MM-DD` | GET | All leaderboard data |
| `/appointments?per_page=150&page=1&from=YYYY-MM-DD&to=YYYY-MM-DD` | GET | Appointments (paginated) |
| `/offices` | GET | Offices (regions) |
| `/offices/teams` | GET | Teams (actual offices) |

### Leaderboard Names
- `Setter Leaderboard` — DK, NP, QP, APPT, SITS, CLOS, SIT%, D/QH, FDK, LDK, TSF
- `Closer Leaderboard` — APPT, SITS, CLOS, SIT%, CLOSE%
- `Setter Appointment Data` — APPT, CANC, NOSH, NTR, RSCH
- `Closer Appointment Data` — APPT, CANC, NOSH, CF, SHADE, 1LEG, NOCL, FU, RSCH, CLOS

---

## Neon DB (Legacy — kineticsales.app)

Connection: `postgresql://neondb_owner:npg_Fz3GX7tOdheE@ep-raspy-leaf-affmmeed-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require`

Used for one-time backfills only. Key tables:
- `repcard_appointment_attachments` (1,776 records) — power bill detection
- `repcard_customer_attachments` (1,188 records) — lead-level attachments
- `repcard_users` (with `raw_data->>'role'`) — role badges
- `repcard_status_logs` (181K records) — door knock outcome history
