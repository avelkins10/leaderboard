# Webhooks

## Overview

7 RepCard webhooks feed real-time data into Supabase. Each has a separate URL endpoint. All payloads are also logged to the `repcard_events` table for debugging/replay.

**Authentication**: None currently. Webhooks are unauthenticated POST requests from RepCard servers.

---

## Webhook Events

### 1. `appointment-set`

**Fires when**: A setter creates a new appointment.

**What we do**:

1. Create record in `appointments` table
2. Calculate `hours_to_appointment` (time between set and scheduled)
3. Check for power bill in attachments → set `has_power_bill`
4. Calculate star rating (1/2/3) and `is_quality`

**Key payload fields**:

```json
{
  "appointment": {
    "id": 12345,
    "setter": { "id": 186637, "firstName": "John", "lastName": "Doe" },
    "closer": { "id": 158546, "firstName": "Jane", "lastName": "Smith" },
    "contact": {
      "id": 48636954,
      "firstName": "Bob",
      "lastName": "Jones",
      "address": "123 Main St"
    },
    "time": "2026-02-18T20:00:00.000Z",
    "notes": "Interested in solar, has high electric bill",
    "attachments": [{ "url": "https://...", "name": "power_bill.pdf" }],
    "officeTeam": { "id": 5671, "name": "Stevens - Team 2026" }
  },
  "contact": {
    "attachment": "https://...",
    "latestAttachment": "https://...",
    "soloAttachment": "https://..."
  }
}
```

### 2. `appointment-update`

**Fires when**: Appointment details change (closer assigned, time changed, attachment added).

**What we do**:

1. Upsert appointment record
2. Re-check attachments for power bill (may have been added after initial set)
3. Recalculate star rating

### 3. `appointment-outcome`

**Fires when**: Closer dispositions an appointment.

**What we do**:

1. Update `disposition` field on appointment record
2. Map disposition string to category

**Disposition values**: `Closed`, `No Show`, `Canceled`, `Credit Fail`, `Shade`, `1 Legger`, `No Close`, `Follow Up`, `Reschedule`

### 4. `door-knocked`

**Fires when**: Rep knocks a door (GPS-verified).

**What we do**:

1. Insert into `door_knocks` table
2. **Dedup**: Skip if same `contact_id + rep_id` within 60 seconds

**Key payload fields**:

```json
{
  "user": { "id": 174886, "firstName": "David", "lastName": "Smith" },
  "contact": { "id": 48636954 },
  "officeTeam": { "id": 5671, "name": "Stevens - Team 2026" },
  "location": { "latitude": 41.5, "longitude": -93.6 },
  "knockedAt": "2026-02-17T22:30:00.000Z"
}
```

### 5. `closer-update`

**Fires when**: A closer is assigned/changed on an appointment.

**What we do**:

1. Update `closer_id` and `closer_name` on appointment record

### 6. `status-changed`

**Fires when**: A contact's status changes (door knock outcome).

**What we do**:

1. Log to `repcard_events` table
2. Insert into `lead_status_changes` table (contact_id, rep_id, rep_name, old_status, new_status, office_team, changed_at)
3. Check for contact-level attachments — if found, upgrade `has_power_bill`, `star_rating`, and `is_quality` on all related appointments that don't yet have a power bill

**Important**: Status = door knock outcome, NOT deal stage. Values include:

- `Not Home`, `Not Interested`, `Appointment Scheduled`, `DQ-Shade`, `Come Back`, etc.
- `Appointment Scheduled` fires when a setter books an appointment on a lead

### 7. `contact-type-changed`

**Fires when**: A contact's type changes (Lead → Customer).

**What we do**:

1. Log to `repcard_events` table
2. Insert into `contact_type_changes` table (contact_id, contact_name, contact_phone, contact_address, old_type, new_type, old/new_type_id, closer_id/name, setter_id/name, office_team, changed_at)
3. Check for contact-level attachments — if found, upgrade `has_power_bill`, `star_rating`, and `is_quality` on all related appointments that don't yet have a power bill

**Important**: Lead → Customer happens at or after close (status: Signed → Active → Pending KCA). This is NOT triggered at appointment set. It signals a deal was closed in RepCard.

**Caveat**: A RepCard type change is a _claim_, not verification. Only QB Sale Date counts as a real close.

---

## Webhook Handler Architecture

Single handler file: `src/app/api/webhooks/repcard/[event]/route.ts`

The `[event]` dynamic segment routes to the correct logic:

- `appointment-set` → upsert appointment + quality calc
- `appointment-update` → upsert appointment + re-check power bill
- `appointment-outcome` → update disposition
- `door-knocked` → insert door knock (with dedup)
- `closer-update` → update closer on appointment
- `status-changed` → log only
- `contact-type-changed` → log only

All events write to `repcard_events` table first, then process event-specific logic.

---

## Power Bill Detection Logic

```
has_power_bill = false

// Check appointment-level attachments (payload.appointment_attachment array)
if (appointment_attachment?.length > 0) has_power_bill = true

// Check contact-level attachments (lead's files)
if (contact.attachment) has_power_bill = true
if (contact.latestAttachment) has_power_bill = true
if (contact.soloAttachment) has_power_bill = true
```

Power bills can arrive at any time — initial appointment set, later update, or already on the lead's profile. The `appointment-update` webhook re-checks.

---

## Dedup Rules

### Door Knocks

Same `contact_id` + `rep_id` within 60 seconds = duplicate (skip).
Prevents double-counting when the app fires multiple events for one knock.

### Appointments

Keyed by `repcard_appointment_id` (unique constraint). Updates overwrite previous data.

---

## Cron Jobs (Data Integrity)

Two cron jobs supplement webhooks to ensure data completeness. Configured in `vercel.json`.

### `/api/cron/sync-quality` — every 4 hours

Fills gaps from missed webhooks and corrects star ratings.

1. **Sync appointments**: Fetches last 3 days from RepCard REST API → upserts into Supabase `appointments`
2. **Fetch attachments**: Checks `/appointments/attachments` and `/customers/attachments` endpoints
3. **Recompute ratings**: Updates `has_power_bill`, `is_quality`, and `star_rating` for all appointments in window

Can also reset `has_power_bill` from `true` to `false` if an attachment was removed from RepCard.

### `/api/cron/verify-attachments` — every 2 hours

AI-powered verification using GPT-4o-mini vision to classify images as power bills or not.

1. **Fetch attachments**: Single page (up to 100) from each attachment endpoint, 3-day window
2. **Skip already-verified**: Checks `attachments` table for previously classified URLs
3. **Vision AI**: Sends up to 15 images in parallel to GPT-4o-mini with a prompt asking if the image is related to electricity/power usage
4. **Store results**: Inserts into `attachments` table with `attachment_type: "power_bill_verified"` or `"not_power_bill"`
5. **Recompute ratings**: Updates affected appointments' `has_power_bill`, `star_rating`, `is_quality`

Requires `OPENAI_API_KEY` env var.
