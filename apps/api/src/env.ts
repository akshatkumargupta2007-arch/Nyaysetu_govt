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
});

export type Env = z.infer<typeof EnvSchema>;

/** In production every key must be present: refuse to start rather than run half-configured. Returns the problems. */
export function productionProblems(e: Env): string[] {
  if (e.NODE_ENV !== "production") return [];
  const missing = (["GOV_JWT_PRIVATE_KEY", "GOV_JWT_PUBLIC_KEY", "SYNC_SIGNING_PUBLIC_KEY", "GOV_WRITEBACK_PRIVATE_KEY", "GOV_PHONE_SEAL_PRIVATE_KEY"] as const).filter((k) => !e[k]);
  const problems = missing.map((k) => `${k} is not set (run: npm run gov:keys)`);
  if (/\/\/postgres:(dev)?@|\/\/postgres:dev:/.test(e.DATABASE_URL)) problems.push("DATABASE_URL uses the default development database password");
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
