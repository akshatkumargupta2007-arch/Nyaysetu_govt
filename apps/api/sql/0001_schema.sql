-- GA2: gov database schema (GOVERNMENT_BIBLE section 5 + section 6 extras). Idempotent: safe to run on every deploy.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- geography dimensions -------------------------------------------------------
CREATE TABLE IF NOT EXISTS geo_states (
  code text PRIMARY KEY,                    -- 'CG', 'KA'
  lgd_code int,
  name jsonb NOT NULL,                      -- {"hi":"...","en":"Chhattisgarh"}
  verified boolean NOT NULL DEFAULT false   -- LGD code checked against the official directory?
);
CREATE TABLE IF NOT EXISTS geo_districts (
  id text PRIMARY KEY,                      -- 'CG.DURG', 'KA.BENGALURU_URBAN'
  state_code text NOT NULL REFERENCES geo_states,
  lgd_code int,
  name jsonb NOT NULL,
  verified boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS geo_cities (
  id text PRIMARY KEY,                      -- = citizen tenant id: 'cg.bhilai', 'ka.bengaluru'
  district_id text NOT NULL REFERENCES geo_districts,
  name jsonb NOT NULL,
  centroid geometry(Point,4326) NOT NULL,
  verified boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS geo_areas (
  id text PRIMARY KEY,                      -- = citizen boundary id: 'cg.bhilai.ward.14'
  city_id text NOT NULL REFERENCES geo_cities,
  kind text NOT NULL,                       -- ward | sector | corridor | cantonment
  name jsonb NOT NULL,
  approximate boolean NOT NULL DEFAULT false,
  geom geometry(MultiPolygon,4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS geo_areas_geom_idx ON geo_areas USING gist (geom);
CREATE INDEX IF NOT EXISTS geo_areas_city_idx ON geo_areas (city_id);

CREATE TABLE IF NOT EXISTS departments (
  id text PRIMARY KEY,                      -- citizen agency id (+ dept key)
  agency_name jsonb NOT NULL,
  department_name jsonb,
  kind text
);
CREATE TABLE IF NOT EXISTS category_l1 (code text PRIMARY KEY, names jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS categories (
  code text PRIMARY KEY,
  l1 text NOT NULL,
  names jsonb NOT NULL,
  icon text
);

-- the fact table -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaints (
  ticket_id uuid PRIMARY KEY,               -- citizen tickets.id
  public_code text UNIQUE NOT NULL,         -- complaint ID shown to officials
  state_code text NOT NULL REFERENCES geo_states,
  district_id text NOT NULL REFERENCES geo_districts,
  city_id text NOT NULL REFERENCES geo_cities,
  area_id text REFERENCES geo_areas,        -- null if no polygon matched
  department_id text REFERENCES departments,
  category_code text NOT NULL REFERENCES categories,
  category_l1 text NOT NULL,
  status text NOT NULL,                     -- citizen ticket state, verbatim
  priority_band text NOT NULL,
  escalation_level int NOT NULL DEFAULT 0,
  report_count int NOT NULL DEFAULT 1,
  summary_en text NOT NULL,                 -- summary_officer_en
  original_text text,                       -- first report, verbatim
  original_lang text,
  geom geometry(Point,4326) NOT NULL,
  h3_r9 text NOT NULL,
  phone_masked text,                        -- '98XXXXXX21' (first registering citizen)
  phone_cipher text,                        -- sealed to the gov key; null after erasure
  sla_due_at timestamptz,
  created_at timestamptz NOT NULL,
  resolved_at timestamptz,
  closed_at timestamptz,
  close_request_status text,                -- null | requested | confirmed | reopened | unconfirmed
  close_requested_at timestamptz,
  close_requested_by text,
  close_request_note text,
  citizen_responded_at timestamptz,
  reopen_count int NOT NULL DEFAULT 0,
  source_event_seq int NOT NULL,            -- last citizen event seq applied (idempotency)
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS complaints_geo_idx ON complaints (state_code, district_id, city_id, area_id);
CREATE INDEX IF NOT EXISTS complaints_dept_idx ON complaints (department_id);
CREATE INDEX IF NOT EXISTS complaints_cat_status_idx ON complaints (category_l1, status);
CREATE INDEX IF NOT EXISTS complaints_created_idx ON complaints (created_at DESC);
CREATE INDEX IF NOT EXISTS complaints_geom_idx ON complaints USING gist (geom);
CREATE INDEX IF NOT EXISTS complaints_h3_idx ON complaints (h3_r9);
CREATE INDEX IF NOT EXISTS complaints_code_trgm_idx ON complaints USING gin (public_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS complaints_summary_trgm_idx ON complaints USING gin (summary_en gin_trgm_ops);

-- every person who reported the same ticket (each separately revealable)
CREATE TABLE IF NOT EXISTS complaint_reporters (
  ticket_id uuid NOT NULL REFERENCES complaints ON DELETE CASCADE,
  report_id uuid NOT NULL,
  phone_masked text,
  phone_cipher text,
  phone_last4 text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (ticket_id, report_id)
);
CREATE INDEX IF NOT EXISTS complaint_reporters_last4_idx ON complaint_reporters (phone_last4);

-- per-ticket timeline copy (read-only display)
CREATE TABLE IF NOT EXISTS complaint_events (
  ticket_id uuid NOT NULL REFERENCES complaints ON DELETE CASCADE,
  seq int NOT NULL,
  type text NOT NULL,
  from_state text,
  to_state text,
  actor_type text,
  payload jsonb,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (ticket_id, seq)
);

-- gov people and security ----------------------------------------------------
CREATE TABLE IF NOT EXISTS gov_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,              -- argon2id
  role text NOT NULL CHECK (role IN ('NATIONAL','STATE','DISTRICT','CITY','DEPARTMENT')),
  scope_state text, scope_district text, scope_city text, scope_department text,
  totp_secret text,
  active boolean NOT NULL DEFAULT true,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gov_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES gov_users,
  refresh_hash text NOT NULL,
  family_id uuid NOT NULL DEFAULT gen_random_uuid(),   -- rotation family: reuse of an old token revokes it
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip text, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gov_sessions_user_idx ON gov_sessions (user_id);
CREATE INDEX IF NOT EXISTS gov_sessions_refresh_idx ON gov_sessions (refresh_hash);

CREATE TABLE IF NOT EXISTS phone_reveal_log (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES gov_users,
  ticket_id uuid NOT NULL,
  public_code text NOT NULL,
  reason text,
  ip text, user_agent text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS phone_reveal_log_user_idx ON phone_reveal_log (user_id, at DESC);

CREATE TABLE IF NOT EXISTS gov_audit_log (   -- append-only, hash-linked like the citizen event ledger
  id bigserial PRIMARY KEY,
  user_id text,
  action text NOT NULL,                      -- LOGIN, LOGIN_FAIL, REVEAL_PHONE, CLOSE_REQUEST, EXPORT, ...
  target text,
  payload jsonb NOT NULL DEFAULT '{}',
  at timestamptz NOT NULL DEFAULT now(),
  prev_hash text NOT NULL,
  hash text NOT NULL
);

-- sync bookkeeping -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_nonces (nonce text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sync_nonces_at_idx ON sync_nonces (at);
CREATE TABLE IF NOT EXISTS sync_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_batch_at timestamptz
);
INSERT INTO sync_state (id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS sync_errors (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  ticket_id uuid,
  reason text NOT NULL,
  payload jsonb
);

-- close-request idempotency (GB6): one row per request key
CREATE TABLE IF NOT EXISTS close_requests (
  idempotency_key text PRIMARY KEY,
  ticket_id uuid NOT NULL,
  user_id text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS close_requests_ticket_idx ON close_requests (ticket_id, created_at DESC);
