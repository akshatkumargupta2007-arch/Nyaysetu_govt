// The one place the test database URL is decided. It is derived from the gov .env connection (so the
// generated password is used) with the database name swapped to nyaysetu_gov_test. Override with
// TEST_DATABASE_URL. Used by vitest.config.ts and the global setup.
import { existsSync, readFileSync } from "node:fs";

export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const file = new URL("../../../../.env", import.meta.url);
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const m = text.match(/^DATABASE_URL=(.+)$/m);
  const base = m?.[1]?.trim() ?? "postgres://postgres:dev@localhost:5433/nyaysetu_gov";
  return base.replace(/\/[^/]+$/, "/nyaysetu_gov_test");
}
