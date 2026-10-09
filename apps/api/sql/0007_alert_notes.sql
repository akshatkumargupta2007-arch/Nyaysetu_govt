-- Notes and status changes officials make on an alert (acknowledge, false alarm, free note). Idempotent.
CREATE TABLE IF NOT EXISTS alert_notes (
  id         bigserial PRIMARY KEY,
  alert_id   bigint NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  at         timestamptz NOT NULL DEFAULT now(),
  user_id    text NOT NULL,
  user_name  text NOT NULL,
  action     text NOT NULL CHECK (action IN ('ack', 'dismiss', 'reopen', 'note')),
  text       text
);
CREATE INDEX IF NOT EXISTS alert_notes_alert_idx ON alert_notes (alert_id, at DESC);
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'gov_app') THEN
    GRANT SELECT, INSERT ON alert_notes TO gov_app;
    GRANT USAGE, SELECT ON SEQUENCE alert_notes_id_seq TO gov_app;
    GRANT UPDATE (status) ON alerts TO gov_app;
  END IF;
END $$;
