// Vitest global setup: make sure the test database exists and is migrated.
import pg from "pg";
import { migrate } from "../db/migrate.js";
import { testDatabaseUrl } from "./test-db-url.js";

export default async function setup() {
  const url = testDatabaseUrl();
  const dbName = new URL(url).pathname.slice(1);
  if (!/_test$/.test(dbName)) throw new Error(`refusing to run tests against non-test database "${dbName}"`);

  const admin = new pg.Client({ connectionString: url.replace(/\/[^/]+$/, "/postgres") });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!exists.rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }
  await migrate(url, "test_app_pw_local_only");
}
