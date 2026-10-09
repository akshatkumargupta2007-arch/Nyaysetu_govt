// Civic Pulse, the live half: what is happening right now, a forecast band, alerts raised by a background job,
// a built-in load simulator for demos, and the race between ordinary Postgres and Tiger Data.
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type pg from "pg";
import type { App } from "../../app.js";
import { env } from "../../env.js";
import { pool } from "../../db/client.js";
import { cellCentre } from "../../lib/activity.js";
import { requireAuth, type AuthUser } from "../auth/guard.js";
import { scopeWhere } from "../rbac.js";
import { cityIds, timed } from "./routes.js";

const forbidden = { error: "Forbidden", code: "FORBIDDEN" };

// ---------- load simulator (demo only) ----------
type Sim = { timer: NodeJS.Timeout; rate: number; since: number; surgeUntil: number; surgeCell: { lng: number; lat: number; city: string } | null; inserted: number };
let sim: Sim | null = null;
const simAllowed = () => env.NODE_ENV !== "production" || process.env.PULSE_SIM === "1";

async function simTick(s: Sim) {
  const surging = Date.now() < s.surgeUntil && s.surgeCell;
  const sc = s.surgeCell;
  const n = s.rate;
  await pool.query(
    `WITH cities AS (SELECT gc.id AS city_id, gd.id AS district_id, gd.state_code, ST_X(gc.centroid) AS lng, ST_Y(gc.centroid) AS lat, row_number() OVER (ORDER BY gc.id) AS rn
                     FROM geo_cities gc JOIN geo_districts gd ON gd.id = gc.district_id),
          g AS (SELECT gen_random_uuid() AS ticket_id, random() AS r, random() AS r2, random() AS r3, random() AS r4,
                       (SELECT 1 + floor(random() * count(*))::int FROM cities) AS rn,
                       (random() < $2::float8 AND $3::boolean) AS on_surge
                FROM generate_series(1, $1::int))
     INSERT INTO complaint_activity (at, ticket_id, seq, kind, from_state, to_state, state_code, district_id, city_id, department_id, category_l1,
                                     priority_band, cell, age_hours, sla_breached, synthetic)
     SELECT now(), g.ticket_id, 1,
            CASE WHEN g.r < 0.55 OR g.on_surge THEN 'REPORT_RECEIVED' ELSE 'STATE_CHANGED' END,
            CASE WHEN g.r < 0.55 OR g.on_surge THEN NULL WHEN g.r < 0.80 THEN 'ASSIGNED' WHEN g.r < 0.95 THEN 'WORK_DONE_PENDING_CONFIRMATION' ELSE 'WORK_DONE_PENDING_CONFIRMATION' END,
            CASE WHEN g.r < 0.55 OR g.on_surge THEN 'SUBMITTED' WHEN g.r < 0.80 THEN 'ASSIGNED' WHEN g.r < 0.95 THEN 'WORK_DONE_PENDING_CONFIRMATION'
                 WHEN g.r < 0.985 THEN 'CLOSED_CONFIRMED' ELSE 'REOPENED' END,
            c.state_code, c.district_id, CASE WHEN g.on_surge THEN $4::text ELSE c.city_id END, c.city_id || '.dept' || (1 + floor(g.r2 * 3)::int),
            CASE WHEN g.on_surge THEN 'WATER' ELSE (ARRAY['ROADS','STREETLIGHTS','WATER','SANITATION','DRAINAGE','GARBAGE','PARKS','TRAFFIC'])[1 + floor(g.r2 * 8)::int] END,
            'Medium',
            CASE WHEN g.on_surge THEN (floor($5::float8 / 0.005 + 0.5)::int)::text || ':' || (floor($6::float8 / 0.005 + 0.5)::int)::text
                 ELSE (floor((c.lng + (g.r + g.r2 + g.r3 - 1.5) * 0.05) / 0.005 + 0.5)::int)::text || ':' || (floor((c.lat + (g.r2 + g.r3 + g.r4 - 1.5) * 0.05) / 0.005 + 0.5)::int)::text END,
            CASE WHEN g.r < 0.55 OR g.on_surge THEN 0 ELSE 2 + g.r2 * 60 END, g.r2 > 0.9, true
     FROM g JOIN cities c ON c.rn = g.rn`,
    [n, surging ? 0.6 : 0, Boolean(surging), sc?.city ?? "", sc?.lng ?? 0, sc?.lat ?? 0],
  );
  s.inserted += n;
}

// ---------- hotspots -> alerts (background job) ----------
const HOTSPOT_SQL = `
  WITH recent AS (SELECT cell, count(*)::int AS observed, mode() WITHIN GROUP (ORDER BY city_id) AS city_id, mode() WITHIN GROUP (ORDER BY category_l1) AS cat
                  FROM complaint_activity WHERE at >= now() - interval '24 hours' AND kind = 'REPORT_RECEIVED' AND cell IS NOT NULL GROUP BY cell),
       hist AS (SELECT cell, day, count(*)::int AS n FROM (
                  SELECT cell, time_bucket('1 day', at) AS day FROM complaint_activity
                  WHERE at >= now() - interval '29 days' AND at < now() - interval '24 hours' AND kind = 'REPORT_RECEIVED' AND cell IS NOT NULL) s GROUP BY cell, day),
       base AS (SELECT cell, sum(n)::numeric / 28 AS mean, coalesce(stddev_samp(n), 0) AS sd FROM hist GROUP BY cell)
  SELECT r.cell, r.observed, r.city_id, r.cat, round(coalesce(b.mean, 0), 2) AS expected,
         round((r.observed - coalesce(b.mean, 0)) / greatest(coalesce(b.sd, 0), 1), 2) AS zscore
  FROM recent r LEFT JOIN base b USING (cell)
  WHERE r.observed >= 8 AND r.observed >= 3 * coalesce(b.mean, 0) AND (r.observed - coalesce(b.mean, 0)) / greatest(coalesce(b.sd, 0), 1) >= 3`;

/** Finds unusual clusters and records each once per cell per day in `alerts`. Returns how many were new. */
export async function detectHotspots(db: pg.Pool = pool): Promise<number> {
  const { rows } = await db.query(HOTSPOT_SQL);
  let fresh = 0;
  for (const r of rows) {
    const done = await db.query(
      `INSERT INTO alerts (kind, city_id, category_l1, window_start, observed, expected, zscore, explanation, synthetic)
       SELECT 'HOTSPOT', $1, $2, now() - interval '24 hours', $3, $4, $5, $6::jsonb,
              EXISTS (SELECT 1 FROM complaint_activity WHERE cell = $7 AND at >= now() - interval '24 hours' AND synthetic)
       WHERE NOT EXISTS (SELECT 1 FROM alerts WHERE kind = 'HOTSPOT' AND explanation->>'cell' = $7 AND at >= now() - interval '24 hours')`,
      [r.city_id, r.cat, r.observed, r.expected, r.zscore, JSON.stringify({ cell: r.cell, rule: "z >= 3, at least 8 reports in 24 h and 3x the usual" }), r.cell],
    );
    fresh += done.rowCount ?? 0;
  }
  return fresh;
}

export function startPulseJobs(db: pg.Pool, log: (m: string) => void): () => void {
  let busy = false;
  const t = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const n = await detectHotspots(db);
      if (n) log(`pulse: ${n} new hotspot alert(s)`);
    } catch (e) {
      log(`pulse job failed: ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  }, 15_000);
  t.unref();
  return () => clearInterval(t);
}

/** Hourly report counts for the user's scope between two timestamps, from the aggregate when possible. */
async function hourlySource(u: AuthUser, p: { lo: string; hi: string }) {
  const cities = await cityIds(u);
  if (cities !== undefined) {
    return { sql: `SELECT bucket, sum(received)::int AS n FROM activity_hourly WHERE bucket >= $1::timestamptz AND bucket < $2::timestamptz${cities ? " AND city_id = ANY($3::text[])" : ""} GROUP BY bucket`, params: cities ? [p.lo, p.hi, cities] : [p.lo, p.hi] };
  }
  const scope = scopeWhere(u, 3, "a");
  return { sql: `SELECT time_bucket('1 hour', a.at) AS bucket, count(*) FILTER (WHERE kind = 'REPORT_RECEIVED')::int AS n FROM complaint_activity a WHERE a.at >= $1::timestamptz AND a.at < $2::timestamptz AND ${scope.sql} GROUP BY 1`, params: [p.lo, p.hi, ...scope.params] };
}

export function registerLiveRoutes(app: App) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // What the database is, in numbers, straight from its own catalog.
  typed.get("/api/pulse/engine", { preHandler: [requireAuth] }, async (_req, reply) => {
    const q = async (sql: string) => (await pool.query(sql)).rows[0];
    const ext = await q(`SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'`);
    const hyp = await q(`SELECT count(*)::int AS n FROM timescaledb_information.hypertables`);
    const cag = await q(`SELECT count(*)::int AS n FROM timescaledb_information.continuous_aggregates`);
    const ch = await q(`SELECT count(*)::int AS n, count(*) FILTER (WHERE is_compressed)::int AS compressed FROM timescaledb_information.chunks WHERE hypertable_name = 'complaint_activity'`);
    const jobs = await q(`SELECT count(*)::int AS n FROM timescaledb_information.jobs WHERE proc_name LIKE 'policy_%'`);
    return reply.send({ timescaledb: ext?.extversion ?? null, hypertables: hyp.n, continuous_aggregates: cag.n, chunks: ch.n, compressed_chunks: ch.compressed, policy_jobs: jobs.n });
  });

  // The heartbeat: write rate, a live feed, and this hour's count from the real-time aggregate.
  typed.get("/api/pulse/live", { preHandler: [requireAuth] }, async (req, reply) => {
    const u = req.user!;
    const scope = scopeWhere(u, 1, "a");
    const r = await timed(async () => {
      const eps = await pool.query(`SELECT count(*)::int AS n FROM complaint_activity a WHERE a.at >= now() - interval '10 seconds' AND ${scope.sql}`, scope.params);
      const feed = await pool.query(
        `SELECT a.at, a.kind, a.to_state, a.city_id, a.category_l1, a.cell, a.synthetic FROM complaint_activity a WHERE a.at >= now() - interval '1 hour' AND ${scope.sql} ORDER BY a.at DESC LIMIT 14`, scope.params);
      const hour = await hourlySource(u, { lo: new Date(Date.now() - 3_600_000).toISOString(), hi: new Date(Date.now() + 3_600_000).toISOString() });
      const last = await pool.query(`SELECT coalesce(sum(n),0)::int AS n FROM (${hour.sql}) s`, hour.params);
      const total = u.role === "NATIONAL" ? (await pool.query(`SELECT approximate_row_count('complaint_activity')::bigint AS n`)).rows[0].n : null;
      return { eps: eps.rows[0].n / 10, reportsLastHour: last.rows[0].n, totalEvents: total === null ? null : Number(total), feed: feed.rows };
    });
    return reply.send({ ...r.value, ms: r.ms, sim: sim ? { rate: sim.rate, seconds: Math.round((Date.now() - sim.since) / 1000), inserted: sim.inserted, surging: Date.now() < sim.surgeUntil } : null, simAllowed: simAllowed() });
  });

  // Last 48 h next to what that hour of the week usually looks like (mean +/- 2 sd over the 4 weeks before), plus the
  // next 24 h. Arithmetic only: no model. A point above the band is "more reports than this hour normally gets".
  typed.get("/api/pulse/forecast", { preHandler: [requireAuth] }, async (req, reply) => {
    const u = req.user!;
    const now = new Date();
    const hourStart = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
    const lo = new Date(hourStart.getTime() - 28 * 86_400_000).toISOString();
    const hi = new Date(hourStart.getTime() + 3_600_000).toISOString();
    const src = await hourlySource(u, { lo, hi });
    const r = await timed(() => pool.query(
      `WITH h AS (${src.sql}),
            norm AS (SELECT extract(isodow FROM bucket)::int AS dow, extract(hour FROM bucket)::int AS hr, avg(n)::float8 AS mean, coalesce(stddev_samp(n), 0)::float8 AS sd
                     FROM h WHERE bucket < $${src.params.length + 1}::timestamptz - interval '48 hours' GROUP BY 1, 2),
            grid AS (SELECT g AS t FROM generate_series($${src.params.length + 1}::timestamptz - interval '47 hours', $${src.params.length + 1}::timestamptz + interval '24 hours', interval '1 hour') g)
       SELECT grid.t, h.n AS actual, round(norm.mean)::int AS expected, greatest(round(norm.mean - 2 * norm.sd), 0)::int AS lower, round(norm.mean + 2 * norm.sd)::int AS upper
       FROM grid LEFT JOIN h ON h.bucket = grid.t
       LEFT JOIN norm ON norm.dow = extract(isodow FROM grid.t)::int AND norm.hr = extract(hour FROM grid.t)::int
       ORDER BY grid.t`, [...src.params, hourStart.toISOString()]));
    return reply.send({ now: now.toISOString(), source: "activity_hourly", ms: r.ms, points: r.value.rows });
  });

  typed.get("/api/pulse/alerts", { preHandler: [requireAuth] }, async (req, reply) => {
    const cities = await cityIds(req.user!);
    if (cities === undefined) return reply.send({ alerts: [] });
    const { rows } = await pool.query(
      `SELECT id, at, kind, city_id, category_l1, observed, expected::float8 AS expected, zscore::float8 AS zscore, status, explanation, synthetic
       FROM alerts WHERE ${cities ? "city_id = ANY($1::text[])" : "TRUE"} AND at >= now() - interval '24 hours' ORDER BY zscore DESC, at DESC LIMIT 8`, cities ? [cities] : []);
    return reply.send({ alerts: rows.map((a) => ({ ...a, ...(a.explanation?.cell ? cellCentre(a.explanation.cell) : {}) })) });
  });

  // Demo load generator. National admins only, never in production unless PULSE_SIM=1.
  typed.post("/api/pulse/sim", { preHandler: [requireAuth], schema: { body: z.object({ action: z.enum(["start", "stop", "surge"]), rate: z.number().int().min(1).max(400).optional() }) } }, async (req, reply) => {
    if (req.user!.role !== "NATIONAL" || !simAllowed()) return reply.status(403).send(forbidden);
    const { action, rate } = req.body;
    if (action === "stop") {
      if (sim) clearInterval(sim.timer);
      sim = null;
      return reply.send({ running: false });
    }
    if (action === "start") {
      if (sim) clearInterval(sim.timer);
      const s: Sim = { timer: null as unknown as NodeJS.Timeout, rate: rate ?? 40, since: Date.now(), surgeUntil: 0, surgeCell: null, inserted: 0 };
      let busy = false;
      s.timer = setInterval(async () => {
        if (busy) return;
        busy = true;
        try { await simTick(s); } catch (e) { req.log.error({ err: e }, "sim tick failed"); } finally { busy = false; }
      }, 1000);
      sim = s;
      return reply.send({ running: true, rate: s.rate });
    }
    if (!sim) return reply.status(409).send({ error: "Start the simulator first", code: "NOT_RUNNING" });
    const c = (await pool.query(`SELECT id, ST_X(centroid) AS lng, ST_Y(centroid) AS lat FROM geo_cities ORDER BY random() LIMIT 1`)).rows[0];
    sim.surgeCell = { city: c.id, lng: c.lng + (Math.random() - 0.5) * 0.05, lat: c.lat + (Math.random() - 0.5) * 0.05 };
    sim.surgeUntil = Date.now() + 45_000;
    return reply.send({ running: true, surgeSeconds: 45, city: c.id });
  });

  // The race: the same three questions asked of ordinary Postgres (complaint_activity_plain), of the Tiger Data
  // hypertable, and of the continuous aggregates. Each runs 3 times; the median is shown. All times are measured now.
  typed.get("/api/pulse/race", { preHandler: [requireAuth] }, async (req, reply) => {
    if (req.user!.role !== "NATIONAL") return reply.status(403).send(forbidden);
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    const run = async (sql: string, params: unknown[]) => {
      const ms: number[] = []; let rows: Record<string, unknown>[] = [];
      for (let i = 0; i < 3; i++) { const r = await timed(() => pool.query(sql, params)); ms.push(r.ms); rows = r.value.rows; }
      return { ms: median(ms), rows };
    };
    const day0 = Math.floor(Date.now() / 86_400_000) * 86_400_000;
    const from90 = new Date(day0 - 90 * 86_400_000).toISOString();
    const from30 = new Date(day0 - 30 * 86_400_000).toISOString();
    const to0 = new Date(day0).toISOString(); // closed days only: today's rows may still be waiting for the next aggregate refresh
    const sum = (rows: Record<string, unknown>[], k: string) => rows.reduce((s, r) => s + Number(r[k]), 0);
    const FIX = "to_state = 'WORK_DONE_PENDING_CONFIRMATION' AND from_state IS DISTINCT FROM to_state AND age_hours IS NOT NULL";
    const q1 = (t: string) => `SELECT time_bucket('1 day', at) AS day, category_l1, count(*) FILTER (WHERE kind = 'REPORT_RECEIVED')::int AS n FROM ${t} WHERE at >= $1 AND at < $2 GROUP BY 1, 2`;
    const q2 = (t: string) => `SELECT cell, count(*) FILTER (WHERE kind = 'REPORT_RECEIVED')::int AS n FROM ${t} WHERE at >= $1 AND at < $2 AND cell IS NOT NULL GROUP BY cell ORDER BY n DESC LIMIT 10`;
    const q3 = (t: string) => `SELECT time_bucket('1 day', at) AS day, percentile_cont(0.5) WITHIN GROUP (ORDER BY age_hours) AS med FROM ${t} WHERE at >= $1 AND at < $2 AND ${FIX} GROUP BY 1`;
    const [p1, h1, a1] = [await run(q1("complaint_activity_plain"), [from90, to0]), await run(q1("complaint_activity"), [from90, to0]),
      await run(`SELECT day, category_l1, sum(received)::int AS n FROM activity_daily WHERE day >= $1 AND day < $2 GROUP BY 1, 2`, [from90, to0])];
    const [p2, h2, a2] = [await run(q2("complaint_activity_plain"), [from30, to0]), await run(q2("complaint_activity"), [from30, to0]),
      await run(`SELECT cell, sum(received)::int AS n FROM cell_daily WHERE day >= $1 AND day < $2 GROUP BY cell ORDER BY n DESC LIMIT 10`, [from30, to0])];
    const [p3, h3, a3] = [await run(q3("complaint_activity_plain"), [from90, to0]), await run(q3("complaint_activity"), [from90, to0]),
      await run(`SELECT day, approx_percentile(0.5, rollup(fix_hours)) AS med FROM resolution_daily WHERE day >= $1 AND day < $2 GROUP BY day`, [from90, to0])];
    const size = (await pool.query(
      `SELECT pg_total_relation_size('complaint_activity_plain')::bigint AS plain, hypertable_size('complaint_activity')::bigint AS hyper,
              (SELECT count(*) FROM complaint_activity_plain)::bigint AS rows`)).rows[0];
    const sp = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10) / 10 : null);
    // Ties can order cells differently, so compare the counts of the top ten, which must be identical.
    const counts = (rows: Record<string, unknown>[]) => JSON.stringify(rows.map((r) => Number(r.n)));
    const topMatch = counts(p2.rows) === counts(h2.rows) && counts(p2.rows) === counts(a2.rows);
    return reply.send({
      rows: Number(size.rows),
      tests: [
        { id: "daily", plain_ms: p1.ms, hypertable_ms: h1.ms, aggregate_ms: a1.ms, speedup: sp(p1.ms, Math.min(h1.ms, a1.ms)), same_answer: sum(p1.rows, "n") === sum(h1.rows, "n") && sum(p1.rows, "n") === sum(a1.rows, "n") },
        { id: "cells", plain_ms: p2.ms, hypertable_ms: h2.ms, aggregate_ms: a2.ms, speedup: sp(p2.ms, Math.min(h2.ms, a2.ms)), same_answer: topMatch },
        { id: "fixtime", plain_ms: p3.ms, hypertable_ms: h3.ms, aggregate_ms: a3.ms, speedup: sp(p3.ms, Math.min(h3.ms, a3.ms)), same_answer: p3.rows.length > 0 && Math.abs(sum(p3.rows, "med") - sum(a3.rows, "med")) / Math.max(1, sum(p3.rows, "med")) < 0.05, note: "aggregate uses a percentile sketch: close, not identical" },
      ],
      storage: { plain_bytes: Number(size.plain), tiger_bytes: Number(size.hyper), ratio: Number(size.hyper) > 0 ? Math.round((Number(size.plain) / Number(size.hyper)) * 10) / 10 : null },
      note: "Same data, same machine, measured when you opened this page, over complete days (up to midnight UTC). Rows marked synthetic are generated, not real complaints.",
    });
  });
}
