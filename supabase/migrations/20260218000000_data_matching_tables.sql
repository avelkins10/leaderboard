CREATE TABLE IF NOT EXISTS lead_status_changes (
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
CREATE INDEX IF NOT EXISTS idx_lead_status_contact ON lead_status_changes(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_rep ON lead_status_changes(rep_id);

CREATE TABLE IF NOT EXISTS contact_type_changes (
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
CREATE INDEX IF NOT EXISTS idx_contact_type_contact ON contact_type_changes(contact_id);

CREATE TABLE IF NOT EXISTS deal_matches (
  id bigserial PRIMARY KEY,
  qb_record_id bigint NOT NULL,
  appointment_id bigint,
  contact_id bigint,
  match_method text NOT NULL,
  match_confidence float,
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
  CONSTRAINT deal_matches_qb_record_id_key UNIQUE(qb_record_id)
);
CREATE INDEX IF NOT EXISTS idx_deal_matches_appt ON deal_matches(appointment_id);
CREATE INDEX IF NOT EXISTS idx_deal_matches_contact ON deal_matches(contact_id);

CREATE TABLE IF NOT EXISTS attachments (
  id bigserial PRIMARY KEY,
  contact_id bigint,
  appointment_id bigint,
  url text NOT NULL,
  source text,
  attachment_type text,
  uploaded_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_contact ON attachments(contact_id);
CREATE INDEX IF NOT EXISTS idx_attachments_appt ON attachments(appointment_id);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS star_rating int;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS contact_source text;

ALTER TABLE door_knocks ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE door_knocks ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE door_knocks ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
