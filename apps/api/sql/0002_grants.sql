-- GA2: the restricted role gov-api connects as in production. The role itself (with its password)
-- is created by src/db/migrate.ts; this file only sets what it may do. Safe to re-run.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'gov_app') THEN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO gov_app', current_database());
    GRANT USAGE ON SCHEMA public TO gov_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gov_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gov_app;

    -- The accountability tables are append-only for the application: the portal can never edit or
    -- delete who looked at a phone number or what an official did.
    REVOKE UPDATE, DELETE, TRUNCATE ON phone_reveal_log FROM gov_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON gov_audit_log FROM gov_app;
    GRANT SELECT, INSERT ON phone_reveal_log TO gov_app;
    GRANT SELECT, INSERT ON gov_audit_log TO gov_app;
  END IF;
END $$;
