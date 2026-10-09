-- Past benchmark ("race") runs, so the Benchmark page can show a history. Idempotent.
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  total_rows    bigint NOT NULL,
  synthetic_rows bigint NOT NULL,
  tests         jsonb NOT NULL,
  storage       jsonb NOT NULL,
  best_speedup  numeric,
  run_by        text
);
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'gov_app') THEN
    GRANT SELECT, INSERT ON benchmark_runs TO gov_app;
    GRANT USAGE, SELECT ON SEQUENCE benchmark_runs_id_seq TO gov_app;
  END IF;
END $$;
