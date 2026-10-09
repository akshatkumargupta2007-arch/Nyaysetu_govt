// GA3: reference seed. Loads the geography (states, districts, cities, category groups) and creates the demo
// admin plus one scoped user per role. Idempotent: running it twice changes nothing but refreshes names.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../lib/password.js";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
export const GEO_DIR = join(here, "../../../../data/geo");

const readJson = <T>(file: string): T => JSON.parse(readFileSync(join(GEO_DIR, file), "utf8")) as T;

type Named = { hi: string; en: string };

export async function seedGeo(db: pg.ClientBase | pg.Pool): Promise<{ states: number }> {
  const states = readJson<{ code: string; lgd_code: number | null; name: Named; verified: boolean }[]>("states.json");
  for (const s of states) {
    await db.query(
      `INSERT INTO geo_states (code, lgd_code, name, verified) VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO UPDATE SET lgd_code = EXCLUDED.lgd_code, name = EXCLUDED.name, verified = EXCLUDED.verified`,
      [s.code, s.lgd_code, JSON.stringify(s.name), s.verified],
    );
  }
  const districts = readJson<{ id: string; state_code: string; lgd_code: number | null; name: Named; verified: boolean }[]>("districts.json");
  for (const d of districts) {
    await db.query(
      `INSERT INTO geo_districts (id, state_code, lgd_code, name, verified) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET state_code = EXCLUDED.state_code, lgd_code = EXCLUDED.lgd_code, name = EXCLUDED.name, verified = EXCLUDED.verified`,
      [d.id, d.state_code, d.lgd_code, JSON.stringify(d.name), d.verified],
    );
  }
  const cities = readJson<{ id: string; district_id: string; name: Named; centroid: { lat: number; lng: number }; verified: boolean }[]>("cities.json");
  for (const c of cities) {
    await db.query(
      `INSERT INTO geo_cities (id, district_id, name, centroid, verified)
       VALUES ($1,$2,$3,ST_SetSRID(ST_MakePoint($4,$5),4326),$6)
       ON CONFLICT (id) DO UPDATE SET district_id = EXCLUDED.district_id, name = EXCLUDED.name,
         centroid = EXCLUDED.centroid, verified = EXCLUDED.verified`,
      [c.id, c.district_id, JSON.stringify(c.name), c.centroid.lng, c.centroid.lat, c.verified],
    );
  }
  const l1 = readJson<{ code: string; names: Named }[]>("category_l1.json");
  for (const k of l1) {
    await db.query(
      `INSERT INTO category_l1 (code, names) VALUES ($1,$2) ON CONFLICT (code) DO UPDATE SET names = EXCLUDED.names`,
      [k.code, JSON.stringify(k.names)],
    );
  }
  return { states: states.length };
}

export type SeedUser = {
  id: string; name: string; email: string; role: "NATIONAL" | "STATE" | "DISTRICT" | "CITY" | "DEPARTMENT";
  scopeState?: string; scopeDistrict?: string; scopeCity?: string; scopeDepartment?: string;
  password?: string; active: boolean;
};

export async function upsertUser(db: pg.ClientBase | pg.Pool, u: SeedUser): Promise<void> {
  // Only set the password when one is given (so re-seeding does not silently change a working login).
  const passwordHash = await hashPassword(u.password ?? randomBytes(24).toString("base64url"));
  await db.query(
    `INSERT INTO gov_users (id, name, email, password_hash, role, scope_state, scope_district, scope_city, scope_department, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
       scope_state = EXCLUDED.scope_state, scope_district = EXCLUDED.scope_district, scope_city = EXCLUDED.scope_city,
       scope_department = EXCLUDED.scope_department, active = EXCLUDED.active
       ${u.password ? ", password_hash = EXCLUDED.password_hash, failed_attempts = 0, locked_until = NULL" : ""}`,
    [u.id, u.name, u.email, passwordHash, u.role, u.scopeState ?? null, u.scopeDistrict ?? null, u.scopeCity ?? null, u.scopeDepartment ?? null, u.active],
  );
}

export async function seedUsers(db: pg.ClientBase | pg.Pool, adminPassword: string): Promise<void> {
  // The demo login: national scope, active.
  await upsertUser(db, { id: "admin", name: "Demo Admin", email: "admin@nyaysetu.local", role: "NATIONAL", password: adminPassword, active: true });
  // One user per role for RBAC tests. Inactive and without a known password, so they cannot log in.
  await upsertUser(db, { id: "demo.state", name: "Demo State User (CG)", email: "state.cg@nyaysetu.local", role: "STATE", scopeState: "CG", active: false });
  await upsertUser(db, { id: "demo.district", name: "Demo District User (Durg)", email: "district.durg@nyaysetu.local", role: "DISTRICT", scopeState: "CG", scopeDistrict: "CG.DURG", active: false });
  await upsertUser(db, { id: "demo.city", name: "Demo City User (Bhilai)", email: "city.bhilai@nyaysetu.local", role: "CITY", scopeState: "CG", scopeDistrict: "CG.DURG", scopeCity: "cg.bhilai", active: false });
  await upsertUser(db, { id: "demo.dept", name: "Demo Department User (BMC)", email: "dept.bmc@nyaysetu.local", role: "DEPARTMENT", scopeState: "CG", scopeCity: "cg.bhilai", scopeDepartment: "cg.bhilai.bmc", active: false });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  let adminPassword = process.env.GOV_ADMIN_PASSWORD ?? "";
  let generated = false;
  if (!adminPassword) {
    adminPassword = randomBytes(12).toString("base64url");
    generated = true;
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { states } = await seedGeo(client);
    await seedUsers(client, adminPassword);
    console.log(`seeded ${states} states/UTs, districts, cities, category groups, and users`);
    console.log("demo admin: admin@nyaysetu.local");
    if (generated) console.log(`GOV_ADMIN_PASSWORD was not set; generated for this run only: ${adminPassword}`);
    else console.log("password: GOV_ADMIN_PASSWORD from the gov .env");
  } finally {
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("seed failed:", err);
    process.exit(1);
  });
}
