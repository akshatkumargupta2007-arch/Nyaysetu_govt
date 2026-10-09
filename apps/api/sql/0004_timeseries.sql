-- migrate: statements
-- 0004: the time-series layer (Tiger Data / TimescaleDB). Idempotent.
-- Each "-- @@" starts a new query: continuous aggregates cannot be created or refreshed inside a transaction.
CREATE EXTENSION IF NOT EXISTS timescaledb;
-- @@
CREATE EXTENSION IF NOT EXISTS timescaledb_toolkit;
-- @@
-- One row per ledger event: the source stream for every dashboard. The tamper-evident complaint_events copy is NOT
-- changed; this table is fed next to it. `kind` is the event type (REPORT_CREATED is stored as REPORT_RECEIVED).
CREATE TABLE IF NOT EXISTS complaint_activity (
  at            timestamptz NOT NULL,
  ticket_id     uuid        NOT NULL,
  seq           int         NOT NULL,
  kind          text        NOT NULL,
  from_state    text,
  to_state      text,
  state_code    text, district_id text, city_id text, area_id text, department_id text,
  category_l1   text,
  priority_band text,
  cell          text,                  -- ~500 m grid cell "x:y" (see lib/activity.ts)
  age_hours     double precision,      -- hours since the ticket was created, at the time of this event
  sla_breached  boolean,               -- event time later than the SLA due time (null = no SLA)
  synthetic     boolean     NOT NULL DEFAULT false,   -- generated benchmark data, always labelled
  PRIMARY KEY (ticket_id, seq, at)
);
-- @@
SELECT create_hypertable('complaint_activity', by_range('at', INTERVAL '1 day'), if_not_exists => TRUE);
-- @@
CREATE INDEX IF NOT EXISTS complaint_activity_city_idx ON complaint_activity (city_id, at DESC);
-- @@
CREATE TABLE IF NOT EXISTS team_positions (
  at timestamptz NOT NULL, ticket_id uuid, team_id text, lat double precision, lng double precision, speed_kmh real,
  synthetic boolean NOT NULL DEFAULT false
);
-- @@
SELECT create_hypertable('team_positions', by_range('at', INTERVAL '1 day'), if_not_exists => TRUE);
-- @@
CREATE TABLE IF NOT EXISTS ai_calls (
  at timestamptz NOT NULL, source text NOT NULL DEFAULT 'citizen', model text NOT NULL, purpose text NOT NULL,
  ok boolean NOT NULL, latency_ms int NOT NULL, units int,
  synthetic boolean NOT NULL DEFAULT false
);
-- @@
SELECT create_hypertable('ai_calls', by_range('at', INTERVAL '1 day'), if_not_exists => TRUE);
-- @@
CREATE TABLE IF NOT EXISTS eval_runs (
  at timestamptz NOT NULL, model text NOT NULL, n int NOT NULL, accuracy double precision, clarify_rate double precision,
  median_latency_ms int, notes text
);
-- @@
SELECT create_hypertable('eval_runs', by_range('at', INTERVAL '30 days'), if_not_exists => TRUE);
-- @@
CREATE TABLE IF NOT EXISTS alerts (
  id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), kind text NOT NULL, city_id text, area_id text, category_l1 text,
  window_start timestamptz, observed int, expected numeric, zscore numeric, status text NOT NULL DEFAULT 'open',
  explanation jsonb, synthetic boolean NOT NULL DEFAULT false
);
-- @@
-- Backfill from the events gov already holds (safe to run again).
INSERT INTO complaint_activity (at, ticket_id, seq, kind, from_state, to_state, state_code, district_id, city_id, area_id,
                                department_id, category_l1, priority_band, cell, age_hours, sla_breached)
SELECT e.created_at, e.ticket_id, e.seq, CASE WHEN e.type = 'REPORT_CREATED' THEN 'REPORT_RECEIVED' ELSE e.type END,
       e.from_state, e.to_state, c.state_code, c.district_id, c.city_id, c.area_id, c.department_id, c.category_l1, c.priority_band,
       (floor(ST_X(c.geom) / 0.005 + 0.5)::int)::text || ':' || (floor(ST_Y(c.geom) / 0.005 + 0.5)::int)::text,
       extract(epoch FROM (e.created_at - c.created_at)) / 3600.0,
       CASE WHEN c.sla_due_at IS NULL THEN NULL ELSE e.created_at > c.sla_due_at END
FROM complaint_events e JOIN complaints c USING (ticket_id)
ON CONFLICT DO NOTHING;
-- @@
CREATE MATERIALIZED VIEW IF NOT EXISTS activity_hourly WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', at) AS bucket, city_id, area_id, category_l1, priority_band,
       count(*) FILTER (WHERE kind = 'REPORT_RECEIVED')                    AS received,
       count(*) FILTER (WHERE kind = 'REPORT_MERGED')                      AS merged,
       count(*) FILTER (WHERE (to_state = 'WORK_DONE_PENDING_CONFIRMATION' AND from_state IS DISTINCT FROM to_state)) AS work_done,
       count(*) FILTER (WHERE (to_state = 'CLOSED_CONFIRMED' AND from_state IS DISTINCT FROM to_state))               AS confirmed,
       count(*) FILTER (WHERE (to_state = 'REOPENED' AND from_state IS DISTINCT FROM to_state))                       AS reopened
FROM complaint_activity GROUP BY 1, 2, 3, 4, 5 WITH NO DATA;
-- @@
SELECT add_continuous_aggregate_policy('activity_hourly', start_offset => INTERVAL '400 days', end_offset => INTERVAL '1 hour',
                                       schedule_interval => INTERVAL '5 minutes', if_not_exists => TRUE);
-- @@
ALTER MATERIALIZED VIEW activity_hourly SET (timescaledb.materialized_only = false);
-- @@
CREATE MATERIALIZED VIEW IF NOT EXISTS activity_daily WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', bucket) AS day, city_id, area_id, category_l1,
       sum(received) AS received, sum(merged) AS merged, sum(work_done) AS work_done, sum(confirmed) AS confirmed, sum(reopened) AS reopened
FROM activity_hourly GROUP BY 1, 2, 3, 4 WITH NO DATA;
-- @@
SELECT add_continuous_aggregate_policy('activity_daily', start_offset => INTERVAL '400 days', end_offset => INTERVAL '1 day',
                                       schedule_interval => INTERVAL '15 minutes', if_not_exists => TRUE);
-- @@
ALTER MATERIALIZED VIEW activity_daily SET (timescaledb.materialized_only = false);
-- @@
CREATE MATERIALIZED VIEW IF NOT EXISTS activity_weekly WITH (timescaledb.continuous) AS
SELECT time_bucket('7 days', day) AS week, city_id, area_id, category_l1,
       sum(received) AS received, sum(work_done) AS work_done, sum(confirmed) AS confirmed, sum(reopened) AS reopened
FROM activity_daily GROUP BY 1, 2, 3, 4 WITH NO DATA;
-- @@
SELECT add_continuous_aggregate_policy('activity_weekly', start_offset => INTERVAL '800 days', end_offset => INTERVAL '7 days',
                                       schedule_interval => INTERVAL '1 hour', if_not_exists => TRUE);
-- @@
-- Map cells for the time-lapse heat map.
CREATE MATERIALIZED VIEW IF NOT EXISTS cell_daily WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', at) AS day, cell, city_id, category_l1,
       count(*) FILTER (WHERE kind = 'REPORT_RECEIVED') AS received,
       count(*) FILTER (WHERE (to_state = 'REOPENED' AND from_state IS DISTINCT FROM to_state))    AS reopened
FROM complaint_activity WHERE cell IS NOT NULL GROUP BY 1, 2, 3, 4 WITH NO DATA;
-- @@
SELECT add_continuous_aggregate_policy('cell_daily', start_offset => INTERVAL '400 days', end_offset => INTERVAL '1 hour',
                                       schedule_interval => INTERVAL '15 minutes', if_not_exists => TRUE);
-- @@
-- How long fixes take (median and p90 come from the toolkit's mergeable percentile sketch).
CREATE MATERIALIZED VIEW IF NOT EXISTS resolution_daily WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', at) AS day, city_id, department_id,
       count(*) AS work_done, percentile_agg(age_hours) AS fix_hours
FROM complaint_activity WHERE (to_state = 'WORK_DONE_PENDING_CONFIRMATION' AND from_state IS DISTINCT FROM to_state) AND age_hours IS NOT NULL
GROUP BY 1, 2, 3 WITH NO DATA;
-- @@
SELECT add_continuous_aggregate_policy('resolution_daily', start_offset => INTERVAL '400 days', end_offset => INTERVAL '1 hour',
                                       schedule_interval => INTERVAL '15 minutes', if_not_exists => TRUE);
-- @@
CREATE MATERIALIZED VIEW IF NOT EXISTS sla_hourly WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', at) AS bucket, city_id, department_id,
       count(*) AS work_done, count(*) FILTER (WHERE sla_breached) AS breached
FROM complaint_activity WHERE (to_state = 'WORK_DONE_PENDING_CONFIRMATION' AND from_state IS DISTINCT FROM to_state) GROUP BY 1, 2, 3 WITH NO DATA;
-- @@
SELECT add_continuous_aggregate_policy('sla_hourly', start_offset => INTERVAL '400 days', end_offset => INTERVAL '1 hour',
                                       schedule_interval => INTERVAL '15 minutes', if_not_exists => TRUE);
-- @@
-- Health of the AI services, one row per model and purpose per minute.
CREATE MATERIALIZED VIEW IF NOT EXISTS ai_health_minutely WITH (timescaledb.continuous) AS
SELECT time_bucket('1 minute', at) AS bucket, model, purpose,
       count(*) AS calls, count(*) FILTER (WHERE NOT ok) AS errors,
       avg(latency_ms) AS avg_ms, max(latency_ms) AS max_ms, percentile_agg(latency_ms) AS latency
FROM ai_calls GROUP BY 1, 2, 3 WITH NO DATA;
-- @@
SELECT add_continuous_aggregate_policy('ai_health_minutely', start_offset => INTERVAL '3 days', end_offset => INTERVAL '1 minute',
                                       schedule_interval => INTERVAL '1 minute', if_not_exists => TRUE);
-- @@
ALTER MATERIALIZED VIEW ai_health_minutely SET (timescaledb.materialized_only = false);
-- @@
-- Compression (columnstore) and retention. Accountability tables (gov_audit_log, phone_reveal_log) are NOT hypertables
-- and are never under a policy.
ALTER TABLE complaint_activity SET (timescaledb.compress, timescaledb.compress_segmentby = 'city_id', timescaledb.compress_orderby = 'at DESC');
-- @@
SELECT add_compression_policy('complaint_activity', INTERVAL '1 day', if_not_exists => TRUE);
-- @@
ALTER TABLE team_positions SET (timescaledb.compress, timescaledb.compress_segmentby = 'ticket_id', timescaledb.compress_orderby = 'at DESC');
-- @@
SELECT add_compression_policy('team_positions', INTERVAL '1 day', if_not_exists => TRUE);
-- @@
SELECT add_retention_policy('team_positions', INTERVAL '7 days', if_not_exists => TRUE);
-- @@
ALTER TABLE ai_calls SET (timescaledb.compress, timescaledb.compress_segmentby = 'model', timescaledb.compress_orderby = 'at DESC');
-- @@
SELECT add_compression_policy('ai_calls', INTERVAL '1 day', if_not_exists => TRUE);
-- @@
SELECT add_retention_policy('ai_calls', INTERVAL '30 days', if_not_exists => TRUE);
-- @@
-- Materialise whatever the backfill added (parents first).
CALL refresh_continuous_aggregate('activity_hourly', NULL, NULL);
-- @@
CALL refresh_continuous_aggregate('activity_daily', NULL, NULL);
-- @@
CALL refresh_continuous_aggregate('activity_weekly', NULL, NULL);
-- @@
CALL refresh_continuous_aggregate('cell_daily', NULL, NULL);
-- @@
CALL refresh_continuous_aggregate('resolution_daily', NULL, NULL);
-- @@
CALL refresh_continuous_aggregate('sla_hourly', NULL, NULL);
-- @@
-- Read-only role for "Ask the City": aggregates only, 3-second statement timeout.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analyst_ro') THEN CREATE ROLE analyst_ro NOLOGIN; END IF;
  GRANT SELECT ON activity_hourly, activity_daily, activity_weekly, cell_daily, resolution_daily, sla_hourly, ai_health_minutely TO analyst_ro;
  ALTER ROLE analyst_ro SET statement_timeout = '3s';
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'gov_app') THEN
    -- 0002_grants.sql ran before these tables existed on a fresh database, so grant here.
    GRANT SELECT, INSERT ON complaint_activity, team_positions, ai_calls, eval_runs TO gov_app;
    GRANT SELECT, INSERT, UPDATE ON alerts TO gov_app;
    GRANT USAGE, SELECT ON SEQUENCE alerts_id_seq TO gov_app;
    GRANT SELECT ON activity_hourly, activity_daily, activity_weekly, cell_daily, resolution_daily, sla_hourly, ai_health_minutely TO gov_app;
    -- 0002 grants everything on every table each time it runs; take back what the time-series layer must never allow.
    REVOKE UPDATE, DELETE, TRUNCATE ON complaint_activity, team_positions, ai_calls, eval_runs FROM gov_app;
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON activity_hourly, activity_daily, activity_weekly, cell_daily, resolution_daily, sla_hourly, ai_health_minutely FROM gov_app;
    GRANT analyst_ro TO gov_app;   -- so the API can run an Ask-the-City query as the read-only role (SET LOCAL ROLE)
  END IF;
END $$;
