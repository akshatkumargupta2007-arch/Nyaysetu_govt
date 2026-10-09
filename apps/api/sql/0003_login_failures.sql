-- Login lockout is tracked per (email, address), not per account, so a stranger typing wrong passwords for
-- someone else's email can no longer lock that person out, and unknown emails behave exactly like real ones.
CREATE TABLE IF NOT EXISTS gov_login_failures (
  email text NOT NULL,
  ip text NOT NULL,
  fails int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email, ip)
);
CREATE INDEX IF NOT EXISTS gov_login_failures_updated_idx ON gov_login_failures (updated_at);

-- 0002_grants.sql runs before this file on a fresh database, so grant here too.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'gov_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON gov_login_failures TO gov_app;
  END IF;
END $$;
