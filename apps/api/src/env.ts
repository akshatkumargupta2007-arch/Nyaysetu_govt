// One place every env var is read and validated (GA1). Keys are validated where they are used.
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8081),
  SYNC_PORT: z.coerce.number().default(8091),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // The only browser origin allowed to call this API.
  GOV_WEB_ORIGIN: z.string().default("http://localhost:5174"),
  CITIZEN_INTERNAL_URL: z.string().default("http://localhost:8090"),

  GOV_JWT_PRIVATE_KEY: z.string().optional().default(""),
  GOV_JWT_PUBLIC_KEY: z.string().optional().default(""),
  SYNC_SIGNING_PUBLIC_KEY: z.string().optional().default(""),
  GOV_WRITEBACK_PRIVATE_KEY: z.string().optional().default(""),
  GOV_PHONE_SEAL_PRIVATE_KEY: z.string().optional().default(""),
  GOV_PHONE_SEAL_PUBLIC_KEY: z.string().optional().default(""),
  GOV_ADMIN_PASSWORD: z.string().optional().default(""),
  // Login name of the first administrator (the seed creates it). Required in production.
  GOV_ADMIN_EMAIL: z.string().optional().default(""),
  // How many reverse proxies sit in front of the API (Cloudflare, Railway...). Decides where the client address
  // is read from. "" or "0" = none (the socket address is used; X-Forwarded-For is ignored). A number = that many
  // hops. Otherwise a comma-separated list of proxy IPs/CIDRs. NEVER "true": that would trust a forged header.
  TRUST_PROXY: z.string().optional().default(""),
});

export type Env = z.infer<typeof EnvSchema>;

/** Turns the TRUST_PROXY setting into Fastify's `trustProxy` option. Throws on the unsafe value "true". */
export function parseTrustProxy(raw: string): boolean | number | string[] {
  const v = raw.trim().toLowerCase();
  if (v === "" || v === "0" || v === "false" || v === "none") return false;
  if (v === "true" || v === "all" || v === "*") throw new Error('TRUST_PROXY=true would trust a forged X-Forwarded-For header; use a hop count or a proxy IP list');
  if (/^\d+$/.test(v)) return Number(v);
  return raw.split(",").map((x) => x.trim()).filter(Boolean);
}

/** The database user in a connection string ("" when it cannot be read). */
export const dbUser = (url: string): string => {
  try {
    return decodeURIComponent(new URL(url).username);
  } catch {
    return "";
  }
};

/** In production every key must be present: refuse to start rather than run half-configured. Returns the problems. */
export function productionProblems(e: Env): string[] {
  if (e.NODE_ENV !== "production") return [];
  const missing = (["GOV_JWT_PRIVATE_KEY", "GOV_JWT_PUBLIC_KEY", "SYNC_SIGNING_PUBLIC_KEY", "GOV_WRITEBACK_PRIVATE_KEY", "GOV_PHONE_SEAL_PRIVATE_KEY"] as const).filter((k) => !e[k]);
  const problems = missing.map((k) => `${k} is not set (run: npm run gov:keys)`);
  if (/\/\/postgres:(dev)?@|\/\/postgres:dev:/.test(e.DATABASE_URL)) problems.push("DATABASE_URL uses the default development database password");
  // The "audit log cannot be edited" promise only holds for the restricted role. As the owner/superuser the
  // application could rewrite its own audit trail, so production must connect as gov_app.
  if (dbUser(e.DATABASE_URL) !== "gov_app") problems.push("DATABASE_URL must connect as the restricted gov_app role (set GOV_APP_DB_PASSWORD and run the migration as the owner with MIGRATE_DATABASE_URL)");
  if (e.TRUST_PROXY.trim() === "") problems.push("TRUST_PROXY must be set (number of proxy hops, e.g. 1 or 2; 0 only if the API is exposed directly)");
  else {
    try {
      parseTrustProxy(e.TRUST_PROXY);
    } catch (err) {
      problems.push((err as Error).message);
    }
  }
  if (!/^https:\/\//.test(e.GOV_WEB_ORIGIN)) problems.push("GOV_WEB_ORIGIN must be an https:// address in production");
  return problems;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    process.exit(1);
  }
  const problems = productionProblems(parsed.data);
  if (problems.length) {
    console.error("Unsafe production configuration:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
