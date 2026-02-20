> **Status: IMPLEMENTED** — This build spec has been fully implemented. Kept for historical reference. See WEBHOOKS.md and SCHEMA.md for current documentation.

# Build Spec: Comprehensive Data Matching & New Tables

## 1. New Supabase Tables

### `lead_status_changes`

Track every status change on a contact (door knock outcomes, appointment scheduling, etc.)

```sql
CREATE TABLE lead_status_changes (
  id bigserial PRIMARY KEY,
  contact_id bigint NOT NULL,
  rep_id bigint,
  rep_name text,
  old_status text,
  new_status text,
  office_team text,
  changed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_lead_status_contact ON lead_status_changes(contact_id);
CREATE INDEX idx_lead_status_rep ON lead_status_changes(rep_id);
```

### `contact_type_changes`

Track Lead→Customer transitions (signals a close in RepCard)

```sql
CREATE TABLE contact_type_changes (
  id bigserial PRIMARY KEY,
  contact_id bigint NOT NULL,
  contact_name text,
  contact_phone text,
  contact_address text,
  old_type text,
  new_type text,
  old_type_id int,
  new_type_id int,
  closer_id bigint,
  closer_name text,
  setter_id bigint,
  setter_name text,
  office_team text,
  changed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_contact_type_contact ON contact_type_changes(contact_id);
```

### `deal_matches`

Links QB projects to RepCard appointments

```sql
CREATE TABLE deal_matches (
  id bigserial PRIMARY KEY,
  qb_record_id bigint NOT NULL,
  appointment_id bigint REFERENCES appointments(id),
  contact_id bigint,
  match_method text NOT NULL, -- 'phone', 'address', 'name_date', 'manual'
  match_confidence float, -- 0.0 to 1.0
  qb_customer_name text,
  qb_customer_phone text,
  qb_customer_address text,
  qb_closer_rc_id text,
  qb_setter_rc_id text,
  qb_sale_date timestamptz,
  qb_system_size_kw float,
  qb_net_ppw float,
  qb_sales_office text,
  rc_contact_name text,
  rc_contact_phone text,
  rc_contact_address text,
  rc_disposition text,
  rc_appointment_time timestamptz,
  matched_at timestamptz DEFAULT now(),
  UNIQUE(qb_record_id)
);
CREATE INDEX idx_deal_matches_appt ON deal_matches(appointment_id);
CREATE INDEX idx_deal_matches_contact ON deal_matches(contact_id);
```

### `attachments`

Track all attachments (power bills, contracts, etc.)

```sql
CREATE TABLE attachments (
  id bigserial PRIMARY KEY,
  contact_id bigint,
  appointment_id bigint,
  url text NOT NULL,
  source text, -- 'appointment', 'contact', 'lead'
  attachment_type text, -- 'power_bill', 'contract', 'unknown'
  uploaded_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_attachments_contact ON attachments(contact_id);
CREATE INDEX idx_attachments_appt ON attachments(appointment_id);
```

## 2. Add Columns to Existing Tables

### `appointments` — add:

- `contact_email text`
- `star_rating int` (1, 2, or 3 — computed)
- `qb_record_id bigint` (already exists but populate it via deal_matches)
- `contact_source text` (where the lead came from)

### `door_knocks` — add:

- `contact_name text`
- `contact_phone text`
- `created_at timestamptz DEFAULT now()`

## 3. API Routes

### `POST /api/match/deals` — Batch match QB deals to RC appointments

Query QB for recent deals, then for each:

1. Try phone match (strip formatting, match last 10 digits)
2. Try address match (normalize, fuzzy compare)
3. Try name + closer_id + date proximity (within 30 days)
   Store results in `deal_matches` table.

### `GET /api/match/deals?from=&to=` — Get match results

Returns deal matches with both QB and RC data side-by-side.

### `GET /api/match/deal/[qb_record_id]` — Single deal match

Shows the full chain: QB deal → RC appointment → door knocks → status changes → attachments.

### `GET /api/contact/[id]` — Enhanced contact timeline (ALREADY EXISTS, enhance it)

Add: status changes, type changes, attachments, matched QB deal info.

## 4. Webhook Handler Updates

### `status-changed` — NOW writes to `lead_status_changes`

```
{
  contact_id, rep_id, rep_name, old_status, new_status, office_team, changed_at
}
```

### `contact-type-changed` — NOW writes to `contact_type_changes`

```
{
  contact_id, contact_name, contact_phone, contact_address,
  old_type, new_type, old_type_id, new_type_id,
  closer_id, closer_name, setter_id, setter_name, office_team, changed_at
}
```

### All appointment webhooks — also write to `attachments` table

When power bill detected, create attachment record.

### `door-knocked` — capture contact_name and contact_phone

## 5. Backfill from Neon

### Historical appointments (47K)

Pull from Neon `repcard_appointments` + `repcard_customers`:

- Phone, email, address from raw_data
- Dispositions, closer/setter IDs
- Has power bill flag

### Historical status logs (181K)

Pull from Neon `repcard_status_logs`:

- Contact status changes over time

### Historical deal matching

Run phone + address matching against QB deals from last 12 months.

## 6. QB Fields for Matching

| FID  | Name              | Usage                       |
| ---- | ----------------- | --------------------------- |
| 3    | Record ID         | QB project ID               |
| 145  | Customer Name     | Match target                |
| 146  | Customer Address  | Match target (full address) |
| 148  | Mobile Phone      | Match target (primary)      |
| 149  | Email             | Match target (secondary)    |
| 522  | Sales Date        | Date proximity              |
| 517  | Closer Name       | Verification                |
| 337  | Setter Name       | Verification                |
| 2277 | Closer RepCard ID | Cross-system link           |
| 2279 | Setter RepCard ID | Cross-system link           |
| 13   | System Size kW    | Stored on match             |
| 543  | Net PPW           | Stored on match             |
| 339  | Sales Office      | Stored on match             |

## 7. Phone Matching Logic

```
normalize(phone):
  strip everything except digits
  if starts with '1' and length 11: drop leading '1'
  return last 10 digits

match(qb_phone, rc_phone):
  return normalize(qb_phone) === normalize(rc_phone)
```

## 8. Address Matching Logic

```
normalize(addr):
  lowercase, strip unit/apt/suite/# suffixes
  replace common abbreviations (st/street, dr/drive, ave/avenue, etc.)
  strip zip code
  return cleaned

match(qb_addr, rc_addr):
  return normalize(qb_addr).includes(normalize(rc_addr)) ||
         normalize(rc_addr).includes(normalize(qb_addr))
  OR: extract street number + first word of street name, compare
```
