// GA2: apply every sql/*.sql file in order, then make sure the restricted `gov_app` role exists.
// Run it as the database owner (postgres). Idempotent: running it twice changes nothing.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(here, "../../sql");

/** Quote a value as a SQL string literal (role passwords cannot be bound parameters). */
const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;

export async function migrate(databaseUrl: string, appPassword = process.env.GOV_APP_DB_PASSWORD ?? ""): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const files = readdirSync(sqlDir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      // The role must exist before 0002_grants.sql runs.
      if (file.startsWith("0002")) {
        if (appPassword) {
          const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'gov_app'");
          await client.query(
            exists.rowCount
              ? `ALTER ROLE gov_app LOGIN PASSWORD ${lit(appPassword)}`
              : `CREATE ROLE gov_app LOGIN PASSWORD ${lit(appPassword)}`,
          );
        }
      }
      await client.query(readFileSync(join(sqlDir, file), "utf8"));
      console.log(`applied sql/${file}`);
    }
    console.log("migration complete");
  } finally {
    await client.end();
  }
}

// Run directly: `npm run migrate`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  migrate(url).catch((err) => {
    console.error("migration failed:", err);
    process.exit(1);
  });
}
