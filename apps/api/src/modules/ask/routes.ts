// Ask the City. The AI only FILLS IN A FORM (a query spec chosen from a short list of views); this file checks the
// form, builds the SQL itself from fixed pieces, adds the official's area to it, runs it with a 3-second limit and
// writes the one-line summary from the returned numbers. The AI never writes SQL and never sees the data.
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { App } from "../../app.js";
import { pool } from "../../db/client.js";
import { citizenRpc, RpcError } from "../../lib/citizenRpc.js";
import { requireAuth, requireCsrf, type AuthUser } from "../auth/guard.js";
import { scopeWhere } from "../rbac.js";
import { cityIds } from "../pulse/routes.js";

type Def = { table: string; time: string; scope: "city" | "dept" | "complaints"; metrics: Record<string, string>; groups: Record<string, string>; filters: Record<string, string>; description: string };
export const VIEWS: Record<string, Def> = {
  reports_daily: { table: "activity_daily", time: "day", scope: "city", description: "reports received, work done, confirmed and reopened per day, by city, area and category",
    metrics: { received: "sum(received)::int", work_done: "sum(work_done)::int", confirmed: "sum(confirmed)::int", reopened: "sum(reopened)::int" },
    groups: { day: "day", city: "city_id", area: "area_id", category: "category_l1" }, filters: { category: "category_l1", city: "city_id", area: "area_id" } },
  resolution_daily: { table: "resolution_daily", time: "day", scope: "dept", description: "median and slowest-tenth (90th percentile) fix times per day, by city and department",
    metrics: { work_done: "sum(work_done)::int", median_hours: "round((approx_percentile(0.5, rollup(fix_hours)))::numeric, 1)", p90_hours: "round((approx_percentile(0.9, rollup(fix_hours)))::numeric, 1)" },
    groups: { day: "day", city: "city_id", department: "department_id" }, filters: { city: "city_id", department: "department_id" } },
  sla_daily: { table: "sla_hourly", time: "bucket", scope: "dept", description: "finished jobs past their deadline, by day, city and department",
    metrics: { work_done: "sum(work_done)::int", breached: "sum(breached)::int", breached_pct: "round(100.0 * sum(breached) / NULLIF(sum(work_done), 0), 1)" },
    groups: { day: "time_bucket('1 day', bucket)", city: "city_id", department: "department_id" }, filters: { city: "city_id", department: "department_id" } },
  tickets_summary: { table: "complaints c", time: "c.created_at", scope: "complaints", description: "counts of complaints (open, reopened, awaiting the citizen, resolved) by department, city, area, category and status",
    metrics: { total: "count(*)::int", open: "count(*) FILTER (WHERE c.status NOT IN ('CLOSED_CONFIRMED','CLOSED_UNCONFIRMED','REJECTED_NOT_CIVIC'))::int", reopened: "count(*) FILTER (WHERE c.status = 'REOPENED' OR c.reopen_count > 0)::int", awaiting_citizen: "count(*) FILTER (WHERE c.status = 'WORK_DONE_PENDING_CONFIRMATION')::int", resolved: "count(*) FILTER (WHERE c.status IN ('CLOSED_CONFIRMED','CLOSED_UNCONFIRMED'))::int" },
    groups: { department: "coalesce(c.department_id,'none')", city: "c.city_id", area: "coalesce(c.area_id,'none')", category: "c.category_l1", status: "c.status", priority: "c.priority_band" }, filters: { category: "c.category_l1", city: "c.city_id", department: "c.department_id", status: "c.status", priority: "c.priority_band" } },
  proof_outcomes: { table: "complaint_events e JOIN complaints c ON c.ticket_id = e.ticket_id", time: "e.created_at", scope: "complaints", description: "repair-proof outcomes by department or day (groups under 5 are hidden)",
    metrics: { total: "count(*)::int", passed: "count(*) FILTER (WHERE e.payload->>'verdict' = 'EVIDENCE_PASSED')::int", needed_more: "count(*) FILTER (WHERE e.payload->>'verdict' IN ('NEEDS_MORE_EVIDENCE','FAILED'))::int", rejected: "count(*) FILTER (WHERE e.payload->>'verdict' = 'REJECTED')::int", contested: "count(*) FILTER (WHERE e.payload->>'verdict' = 'NEEDS_HUMAN_REVIEW')::int" },
    groups: { department: "coalesce(c.department_id,'none')", day: "date_trunc('day', e.created_at)", city: "c.city_id" }, filters: { city: "c.city_id", department: "c.department_id" } },
};

export const Spec = z.object({
  view: z.enum(Object.keys(VIEWS) as [string, ...string[]]),
  metrics: z.array(z.string().max(30)).min(1).max(4),
  group_by: z.array(z.string().max(30)).max(2).default([]),
  filters: z.record(z.string().max(30), z.string().max(60)).default({}),
  time: z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  order_by: z.object({ metric: z.string().max(30), dir: z.enum(["asc", "desc"]).default("desc") }).optional(),
  limit: z.number().int().min(1).max(100).default(10),
});
export type SpecT = z.infer<typeof Spec>;

/** Throws a plain message when the spec is not something we are willing to run. */
export function checkSpec(s: SpecT): void {
  const d = VIEWS[s.view]!;
  for (const m of s.metrics) if (!d.metrics[m]) throw new Error(`unknown metric ${m}`);
  for (const g of s.group_by) if (!d.groups[g]) throw new Error(`unknown group ${g}`);
  for (const k of Object.keys(s.filters)) if (!d.filters[k]) throw new Error(`unknown filter ${k}`);
  if (s.order_by && !d.metrics[s.order_by.metric] && !d.groups[s.order_by.metric]) throw new Error("unknown order");
  const days = (new Date(s.time.to).getTime() - new Date(s.time.from).getTime()) / 86_400_000;
  if (!(days >= 0) || days > 400) throw new Error("time range must be 0 to 400 days");
}

export interface Built { sql: string; params: unknown[] }
export async function buildQuery(s: SpecT, user: AuthUser): Promise<Built | { denied: string }> {
  const d = VIEWS[s.view]!; const params: unknown[] = [s.time.from, new Date(new Date(s.time.to).getTime() + 86_400_000).toISOString().slice(0, 10)];
  const where: string[] = [`${d.time} >= $1::date`, `${d.time} < $2::date`];
  if (d.scope === "complaints") { const sc = scopeWhere(user, 3, "c"); where.push(sc.sql); params.push(...sc.params); }
  else {
    const cities = await cityIds(user);
    if (cities === undefined) { if (!user.scopeDepartment) return { denied: "no area" }; if (d.scope === "city") return { denied: "This view is not available for department officials. Try the complaints summary." }; params.push(user.scopeDepartment); where.push(`department_id = $${params.length}`); }
    else if (cities) { params.push(cities); where.push(`city_id = ANY($${params.length}::text[])`); }
  }
  for (const [k, v] of Object.entries(s.filters)) { params.push(v); where.push(`${d.filters[k]} = $${params.length}`); }
  const gcols = s.group_by.map((g) => d.groups[g]!); const sel = [...s.group_by.map((g, i) => `${gcols[i]} AS "${g}"`), ...s.metrics.map((m) => `${d.metrics[m]} AS "${m}"`)];
  const order = s.order_by ? `ORDER BY "${s.order_by.metric}" ${s.order_by.dir === "asc" ? "ASC" : "DESC"} NULLS LAST` : (s.group_by.includes("day") ? `ORDER BY "day" ASC` : `ORDER BY "${s.metrics[0]}" DESC NULLS LAST`);
  const having = s.view === "proof_outcomes" && gcols.length ? "HAVING count(*) >= 5" : "";
  params.push(s.limit);
  return { sql: `SELECT ${sel.join(", ")} FROM ${d.table} WHERE ${where.join(" AND ")} ${gcols.length ? `GROUP BY ${gcols.join(", ")}` : ""} ${having} ${order} LIMIT $${params.length}`, params };
}

export function summarise(s: SpecT, rows: Record<string, unknown>[]): string {
  if (!rows.length) return "No rows match this question for your area and dates.";
  const m = s.metrics[0]!; const g = s.group_by[0];
  const fmt = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-IN") : String(v));
  const top = rows[0]!;
  if (!g) return `${m.replace(/_/g, " ")}: ${fmt(top[m])} (${s.time.from} to ${s.time.to}).`;
  const label = String(top[g]).slice(0, 10).replace(/T.*/, "");
  return `The highest ${m.replace(/_/g, " ")} by ${g} is ${label} (${fmt(top[m])}), out of ${rows.length} rows shown (${s.time.from} to ${s.time.to}).`;
}

export function registerAskRoutes(app: App) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get("/api/ask/views", { preHandler: [requireAuth] }, async (_req, reply) => reply.send({ views: Object.entries(VIEWS).map(([name, d]) => ({ name, description: d.description, metrics: Object.keys(d.metrics), groups: Object.keys(d.groups), filters: Object.keys(d.filters) })) }));

  typed.post("/api/ask", { preHandler: [requireAuth, requireCsrf], config: { rateLimit: { max: 20, timeWindow: "1 minute" } }, schema: { body: z.object({ question: z.string().trim().min(3).max(300), lang: z.enum(["en", "hi"]).default("en") }) } }, async (req, reply) => {
    const t0 = Date.now(); let raw: { cannot?: boolean; reason?: string; spec?: unknown };
    try {
      raw = await citizenRpc("ask_spec", { question: req.body.question, lang: req.body.lang, views: Object.entries(VIEWS).map(([name, d]) => ({ name, description: d.description, metrics: Object.keys(d.metrics), groups: Object.keys(d.groups), filters: Object.keys(d.filters) })), today: new Date().toISOString().slice(0, 10) }, 30_000);
    } catch (e) {
      return reply.send({ status: "degraded", message: e instanceof RpcError ? "The AI helper is not available right now, so only the views list can be used." : "The AI helper failed.", views: Object.keys(VIEWS) });
    }
    if (raw.cannot || !raw.spec) return reply.send({ status: "cannot", reason: raw.reason ?? "This question cannot be answered with the data this page may use.", views: Object.keys(VIEWS) });
    const parsed = Spec.safeParse(raw.spec);
    if (!parsed.success) return reply.send({ status: "cannot", reason: "The AI produced a form we could not accept, so nothing was run.", views: Object.keys(VIEWS) });
    try { checkSpec(parsed.data); } catch (e) { return reply.send({ status: "cannot", reason: `The question needs something outside the allowed views (${(e as Error).message}).`, views: Object.keys(VIEWS) }); }
    const built = await buildQuery(parsed.data, req.user!);
    if ("denied" in built) return reply.send({ status: "cannot", reason: built.denied, views: Object.keys(VIEWS) });
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY"); await client.query("SET LOCAL statement_timeout = '3000ms'");
      const q0 = Date.now(); const r = await client.query(built.sql, built.params); const queryMs = Date.now() - q0;
      await client.query("COMMIT");
      const rows = r.rows;
      return reply.send({ status: "ok", spec: parsed.data, columns: r.fields.map((f) => f.name), rows, summary: summarise(parsed.data, rows), ms: Date.now() - t0, queryMs, scope: req.user!.role, source: VIEWS[parsed.data.view]!.table.split(" ")[0] });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      return reply.send({ status: "error", message: (e as Error).message.includes("statement timeout") ? "The question took too long and was stopped." : "The question could not be run." });
    } finally { client.release(); }
  });
}
