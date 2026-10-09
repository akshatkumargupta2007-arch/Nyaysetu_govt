// Civic Pulse: time-series views over the Tiger Data (TimescaleDB) layer from migration 0004.
// Every endpoint is role-scoped like the rest of the portal. Roles that can be scoped by city read the continuous
// aggregates; a department-scoped role reads the raw hypertable (the aggregates do not carry the department).
// All numbers come from SQL; nothing here is estimated or written by a model.
import { performance } from "node:perf_hooks";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { App } from "../../app.js";
import { pool } from "../../db/client.js";
import { cellCentre } from "../../lib/activity.js";
import { requireAuth, type AuthUser } from "../auth/guard.js";
import { scopeWhere } from "../rbac.js";

const GRAINS = { hour: { agg: "activity_hourly", col: "bucket", step: "1 hour" }, day: { agg: "activity_daily", col: "day", step: "1 day" }, week: { agg: "activity_weekly", col: "week", step: "7 days" } } as const;

const Range = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  category_l1: z.string().max(100).optional(),
});
const range = (q: z.infer<typeof Range>, defaultDays: number) => {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - defaultDays * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
};

/** City ids the user may see, or null for everyone. Undefined means "cannot use city-keyed aggregates". */
export async function cityIds(user: AuthUser): Promise<string[] | null | undefined> {
  if (user.role === "NATIONAL") return null;
  if (user.role === "DEPARTMENT") return undefined;
  const col = user.role === "STATE" ? "d.state_code" : user.role === "DISTRICT" ? "gc.district_id" : "gc.id";
  const val = user.role === "STATE" ? user.scopeState : user.role === "DISTRICT" ? user.scopeDistrict : user.scopeCity;
  if (!val) return [];
  const { rows } = await pool.query(`SELECT gc.id FROM geo_cities gc JOIN geo_districts d ON d.id = gc.district_id WHERE ${col} = $1`, [val]);
  return rows.map((r) => r.id as string);
}

export async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t = performance.now();
  const value = await fn();
  return { value, ms: Math.round((performance.now() - t) * 10) / 10 };
}

export function registerPulseRoutes(app: App) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // Reports and fixes over time. Missing buckets are filled with zeros so a chart never invents a straight line.
  typed.get("/api/pulse/trend", { preHandler: [requireAuth], schema: { querystring: Range.extend({ grain: z.enum(["hour", "day", "week"]).default("day") }) } }, async (req, reply) => {
    const g = GRAINS[req.query.grain];
    const { from, to } = range(req.query, req.query.grain === "hour" ? 3 : req.query.grain === "day" ? 30 : 180);
    const cities = await cityIds(req.user!);
    const r = await timed(async () => {
      if (cities !== undefined) {
        const params: unknown[] = [from, to];
        let extra = "";
        if (cities) { params.push(cities); extra += ` AND city_id = ANY($${params.length}::text[])`; }
        if (req.query.category_l1) { params.push(req.query.category_l1); extra += ` AND category_l1 = $${params.length}`; }
        return pool.query(
          `SELECT time_bucket_gapfill('${g.step}', ${g.col}, $1::timestamptz, $2::timestamptz) AS t,
                  coalesce(sum(received),0)::int AS received, coalesce(sum(work_done),0)::int AS work_done,
                  coalesce(sum(confirmed),0)::int AS confirmed, coalesce(sum(reopened),0)::int AS reopened
           FROM ${g.agg} WHERE ${g.col} >= $1::timestamptz AND ${g.col} < $2::timestamptz${extra}
           GROUP BY 1 ORDER BY 1`, params);
      }
      const scope = scopeWhere(req.user!, 3, "a");
      const params: unknown[] = [from, to, ...scope.params];
      let extra = "";
      if (req.query.category_l1) { params.push(req.query.category_l1); extra = ` AND a.category_l1 = $${params.length}`; }
      return pool.query(
        `SELECT time_bucket_gapfill('${g.step}', a.at, $1::timestamptz, $2::timestamptz) AS t,
                count(*) FILTER (WHERE kind = 'REPORT_RECEIVED')::int AS received,
                count(*) FILTER (WHERE to_state = 'WORK_DONE_PENDING_CONFIRMATION' AND from_state IS DISTINCT FROM to_state)::int AS work_done,
                count(*) FILTER (WHERE to_state = 'CLOSED_CONFIRMED' AND from_state IS DISTINCT FROM to_state)::int AS confirmed,
                count(*) FILTER (WHERE to_state = 'REOPENED' AND from_state IS DISTINCT FROM to_state)::int AS reopened
         FROM complaint_activity a WHERE a.at >= $1::timestamptz AND a.at < $2::timestamptz AND ${scope.sql}${extra} GROUP BY 1 ORDER BY 1`, params);
    });
    return reply.send({ grain: req.query.grain, from, to, source: cities !== undefined ? GRAINS[req.query.grain].agg : "complaint_activity", ms: r.ms, series: r.value.rows });
  });

  // How long a fix takes: median and 90th percentile per day, from the mergeable percentile sketch.
  typed.get("/api/pulse/resolution", { preHandler: [requireAuth], schema: { querystring: Range } }, async (req, reply) => {
    const { from, to } = range(req.query, 60);
    const u = req.user!;
    const cities = await cityIds(u);
    const parts = ["day >= $1", "day < $2"];
    const params: unknown[] = [from, to];
    if (cities) { params.push(cities); parts.push(`city_id = ANY($${params.length}::text[])`); }
    if (u.role === "DEPARTMENT") {
      if (!u.scopeDepartment) return reply.send({ from, to, series: [] });
      params.push(u.scopeDepartment); parts.push(`department_id = $${params.length}`);
    }
    const r = await timed(() => pool.query(
      `SELECT day AS t, sum(work_done)::int AS work_done,
              round((approx_percentile(0.5, rollup(fix_hours)))::numeric, 1) AS median_hours,
              round((approx_percentile(0.9, rollup(fix_hours)))::numeric, 1) AS p90_hours
       FROM resolution_daily WHERE ${parts.join(" AND ")} GROUP BY day ORDER BY day`, params));
    return reply.send({ from, to, source: "resolution_daily", ms: r.ms, series: r.value.rows });
  });

  // Share of finished jobs that missed their SLA, per day.
  typed.get("/api/pulse/sla", { preHandler: [requireAuth], schema: { querystring: Range } }, async (req, reply) => {
    const { from, to } = range(req.query, 30);
    const u = req.user!;
    const cities = await cityIds(u);
    const parts = ["bucket >= $1", "bucket < $2"];
    const params: unknown[] = [from, to];
    if (cities) { params.push(cities); parts.push(`city_id = ANY($${params.length}::text[])`); }
    if (u.role === "DEPARTMENT") {
      params.push(u.scopeDepartment ?? ""); parts.push(`department_id = $${params.length}`);
    }
    const r = await timed(() => pool.query(
      `SELECT time_bucket('1 day', bucket) AS t, sum(work_done)::int AS work_done, sum(breached)::int AS breached,
              round(100.0 * sum(breached) / NULLIF(sum(work_done),0), 1) AS breached_pct
       FROM sla_hourly WHERE ${parts.join(" AND ")} GROUP BY 1 ORDER BY 1`, params));
    return reply.send({ from, to, source: "sla_hourly", ms: r.ms, series: r.value.rows });
  });

  // Where reports pile up, per ~500 m cell and day: feeds the time-lapse map.
  typed.get("/api/pulse/cells", { preHandler: [requireAuth], schema: { querystring: Range } }, async (req, reply) => {
    const { from, to } = range(req.query, 30);
    const u = req.user!;
    const cities = await cityIds(u);
    const r = await timed(async () => {
      if (cities !== undefined) {
        const params: unknown[] = [from, to];
        const parts = ["day >= $1", "day < $2"];
        if (cities) { params.push(cities); parts.push(`city_id = ANY($${params.length}::text[])`); }
        if (req.query.category_l1) { params.push(req.query.category_l1); parts.push(`category_l1 = $${params.length}`); }
        return pool.query(
          `SELECT day AS t, cell, city_id, sum(received)::int AS received, sum(reopened)::int AS reopened FROM cell_daily
           WHERE ${parts.join(" AND ")} GROUP BY 1, 2, 3 HAVING sum(received) > 0 ORDER BY 1, 2 LIMIT 40000`, params);
      }
      const scope = scopeWhere(u, 3, "a");
      const c2 = req.query.category_l1 ? ` AND a.category_l1 = $${3 + scope.params.length}` : "";
      return pool.query(
        `SELECT time_bucket('1 day', a.at) AS t, a.cell, a.city_id, count(*) FILTER (WHERE kind='REPORT_RECEIVED')::int AS received,
                count(*) FILTER (WHERE to_state='REOPENED')::int AS reopened
         FROM complaint_activity a WHERE a.at >= $1 AND a.at < $2 AND a.cell IS NOT NULL AND ${scope.sql}${c2}
         GROUP BY 1, 2, 3 HAVING count(*) FILTER (WHERE kind='REPORT_RECEIVED') > 0 ORDER BY 1, 2 LIMIT 40000`,
        [from, to, ...scope.params, ...(req.query.category_l1 ? [req.query.category_l1] : [])]);
    });
    const cells = r.value.rows.map((x) => ({ ...x, ...cellCentre(x.cell) }));
    const ids = [...new Set(cells.map((c) => c.city_id).filter(Boolean))];
    const names = ids.length ? (await pool.query(`SELECT id, name FROM geo_cities WHERE id = ANY($1::text[])`, [ids])).rows : [];
    return reply.send({ from, to, source: cities !== undefined ? "cell_daily" : "complaint_activity", ms: r.ms, cities: names, cells });
  });

  // Unusual clusters: reports in a cell in the last 24 h versus that cell's own daily history over the 28 days
  // before. A flag needs z >= 3 AND at least 5 reports, so one noisy cell never raises an alarm. Plain statistics.
  typed.get("/api/pulse/hotspots", { preHandler: [requireAuth] }, async (req, reply) => {
    const u = req.user!;
    const scope = scopeWhere(u, 1, "a");
    const r = await timed(() => pool.query(
      `WITH recent AS (
         SELECT a.cell, count(*)::int AS observed FROM complaint_activity a
         WHERE a.at >= now() - interval '24 hours' AND a.kind = 'REPORT_RECEIVED' AND a.cell IS NOT NULL AND ${scope.sql} GROUP BY a.cell),
       hist AS (
         SELECT cell, day, count(*)::int AS n FROM (
           SELECT a.cell, time_bucket('1 day', a.at) AS day FROM complaint_activity a
           WHERE a.at >= now() - interval '29 days' AND a.at < now() - interval '24 hours'
             AND a.kind = 'REPORT_RECEIVED' AND a.cell IS NOT NULL AND ${scope.sql}) s GROUP BY cell, day),
       base AS (SELECT cell, sum(n)::numeric / 28 AS mean, coalesce(stddev_samp(n), 0) AS sd FROM hist GROUP BY cell)
       SELECT r.cell, r.observed, round(coalesce(b.mean, 0), 2) AS expected,
              round((r.observed - coalesce(b.mean, 0)) / greatest(coalesce(b.sd, 0), 1), 2) AS zscore
       FROM recent r LEFT JOIN base b USING (cell)
       WHERE r.observed >= 8 AND r.observed >= 3 * coalesce(b.mean, 0) AND (r.observed - coalesce(b.mean, 0)) / greatest(coalesce(b.sd, 0), 1) >= 3
       ORDER BY zscore DESC LIMIT 20`, scope.params));
    return reply.send({ ms: r.ms, rule: "z >= 3, at least 8 reports in 24 h and 3x the usual", hotspots: r.value.rows.map((x) => ({ ...x, ...cellCentre(x.cell) })) });
  });

  // Health of the AI services (national only: it is about the platform, not a city).
  typed.get("/api/pulse/ai-health", { preHandler: [requireAuth] }, async (req, reply) => {
    if (req.user!.role !== "NATIONAL") return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const r = await timed(() => pool.query(
      `SELECT bucket AS t, model, sum(calls)::int AS calls, sum(errors)::int AS errors, round(avg(avg_ms)::numeric, 0) AS avg_ms,
              round((approx_percentile(0.95, rollup(latency)))::numeric, 0) AS p95_ms
       FROM ai_health_minutely WHERE bucket >= now() - interval '60 minutes' GROUP BY 1, 2 ORDER BY 1, 2`));
    return reply.send({ ms: r.ms, source: "ai_health_minutely", series: r.value.rows });
  });
}
