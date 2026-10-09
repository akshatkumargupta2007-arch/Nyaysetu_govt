-- migrate: statements
-- 0005: a plain-Postgres twin of complaint_activity (same columns, ordinary table, ordinary btree indexes).
-- It exists for one reason: the "race" on the Civic Pulse page asks the SAME question of ordinary Postgres and of the
-- Tiger Data hypertable, live, so the difference is measured rather than claimed. A statement-level trigger keeps it
-- in step with every insert. Idempotent.
CREATE TABLE IF NOT EXISTS complaint_activity_plain (LIKE complaint_activity INCLUDING DEFAULTS);
-- @@
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaint_activity_plain_pkey') THEN
    ALTER TABLE complaint_activity_plain ADD CONSTRAINT complaint_activity_plain_pkey PRIMARY KEY (ticket_id, seq, at);
  END IF;
END $$;
-- @@
CREATE INDEX IF NOT EXISTS complaint_activity_plain_at_idx ON complaint_activity_plain (at DESC);
-- @@
CREATE INDEX IF NOT EXISTS complaint_activity_plain_city_idx ON complaint_activity_plain (city_id, at DESC);
-- @@
CREATE OR REPLACE FUNCTION complaint_activity_mirror() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO complaint_activity_plain SELECT * FROM new_rows ON CONFLICT DO NOTHING;
  RETURN NULL;
END $$;
-- @@
DROP TRIGGER IF EXISTS complaint_activity_mirror_trg ON complaint_activity;
-- @@
CREATE TRIGGER complaint_activity_mirror_trg AFTER INSERT ON complaint_activity
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION complaint_activity_mirror();
-- @@
-- Catch up anything that was there before the trigger.
INSERT INTO complaint_activity_plain SELECT * FROM complaint_activity ON CONFLICT DO NOTHING;
-- @@
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'gov_app') THEN
    GRANT SELECT ON complaint_activity_plain TO gov_app;
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON complaint_activity_plain FROM gov_app;
  END IF;
END $$;
