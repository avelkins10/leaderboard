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
    "contact": { "id": 48636954, "firstName": "Bob", "lastName": "Jones", "address": "123 Main St" },
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
1. Log to `repcard_events` (no separate table yet)

**Important**: Status = door knock outcome, NOT deal stage. Values include:
- `Not Home`, `Not Interested`, `Appointment Scheduled`, `DQ-Shade`, `Come Back`, etc.
- `Appointment Scheduled` fires when a setter books an appointment on a lead

### 7. `contact-type-changed`
**Fires when**: A contact's type changes (Lead → Customer).

**What we do**:
1. Log to `repcard_events` (no separate table yet)

**Important**: Lead → Customer happens at or after close (status: Signed → Active → Pending KCA). This is NOT triggered at appointment set. It signals a deal was closed in RepCard.

**Caveat**: A RepCard type change is a *claim*, not verification. Only QB Sale Date counts as a real close.

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

// Check appointment-level attachments
if (appointment.attachments?.length > 0) has_power_bill = true

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
