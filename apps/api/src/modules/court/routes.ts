// Closure Court in the government portal. Reads go to the citizen stack through the signed internal door AFTER this
// API has checked that the complaint is inside the official's own area. Nothing here can close a complaint.
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { App } from "../../app.js";
import { env } from "../../env.js";
import { pool } from "../../db/client.js";
import { appendAudit } from "../../lib/audit.js";
import { citizenRpc, RpcError } from "../../lib/citizenRpc.js";
import { requireAuth, requireCsrf } from "../auth/guard.js";
import { assertTicketInScope, scopeWhere } from "../rbac.js";
import { proofSummaries } from "./summary.js";

const demoAllowed = () => env.NODE_ENV !== "production" || process.env.PULSE_SIM === "1";
const File = z.object({ name: z.string().min(1).max(120), mime: z.string().max(60), base64: z.string().min(8) });
const ProofBody = z.object({ files: z.array(File).min(1).max(4), declaredAt: z.string().datetime().optional().nullable(), note: z.string().max(500).optional() });
const notFound = { error: "Not found", code: "NOT_FOUND" };
const unavailable = (e: unknown) => (e instanceof RpcError ? { status: e.status === 404 ? 404 : 502, body: { error: e.message, code: e.code } } : { status: 500, body: { error: "Internal error", code: "INTERNAL" } });

export function registerCourtRoutes(app: App) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // The review queue: complaints that have repair proof activity, newest activity first (scoped to the official).
  typed.get("/api/court/queue", { preHandler: [requireAuth], schema: { querystring: z.object({ verdict: z.string().max(40).optional(), department: z.string().max(100).optional(), olderThanHours: z.coerce.number().int().min(0).max(24 * 365).optional(), sort: z.enum(["oldest", "newest"]).default("oldest") }) } }, async (req, reply) => {
    const sc = scopeWhere(req.user!, 1, "c");
    const { rows } = await pool.query(
      `WITH p AS (
         SELECT ticket_id, count(*) FILTER (WHERE type = 'PROOF_SUBMITTED')::int AS submissions,
                (array_agg(payload->>'verdict' ORDER BY seq DESC) FILTER (WHERE type IN ('PROOF_REJECTED_REUSED','PROOF_NEEDS_MORE','PROOF_FAILED','PROOF_CONTESTED','PROOF_PASSED')))[1] AS verdict,
                max(created_at) FILTER (WHERE type <> 'PROOF_CONTRACT_FROZEN') AS last_at,
                (array_agg(payload->>'source' ORDER BY seq DESC) FILTER (WHERE type = 'PROOF_CONTRACT_FROZEN'))[1] AS contract_source
         FROM complaint_events WHERE type LIKE 'PROOF\\_%' GROUP BY ticket_id)
       SELECT c.ticket_id, c.public_code, c.status, c.category_code, cat.names AS category_names, c.department_id, d.agency_name, ga.name AS area_name, gc.name AS city_name,
              c.created_at, p.submissions, p.verdict, p.last_at, p.contract_source
       FROM p JOIN complaints c ON c.ticket_id = p.ticket_id JOIN categories cat ON cat.code = c.category_code JOIN geo_cities gc ON gc.id = c.city_id
       LEFT JOIN departments d ON d.id = c.department_id LEFT JOIN geo_areas ga ON ga.id = c.area_id
       WHERE ${sc.sql} AND p.submissions > 0
       ORDER BY p.last_at ${req.query.sort === "newest" ? "DESC" : "ASC"} LIMIT 300`, sc.params);
    let items = rows.map((r) => ({ id: r.ticket_id, code: r.public_code, status: r.status, category: { code: r.category_code, names: r.category_names }, department: { id: r.department_id, agency: r.agency_name }, area: r.area_name, city: r.city_name, createdAt: r.created_at, submissions: r.submissions, verdict: r.verdict, lastActivity: r.last_at, contractSource: r.contract_source }));
    if (req.query.verdict) items = items.filter((i) => i.verdict === req.query.verdict);
    if (req.query.department) items = items.filter((i) => i.department.id === req.query.department);
    if (req.query.olderThanHours) items = items.filter((i) => i.lastActivity && Date.now() - new Date(i.lastActivity).getTime() > req.query.olderThanHours! * 3_600_000);
    const counts: Record<string, number> = {};
    for (const i of rows) counts[i.verdict ?? "NONE"] = (counts[i.verdict ?? "NONE"] ?? 0) + 1;
    const departments = [...new Map(rows.filter((r) => r.department_id).map((r) => [r.department_id, r.agency_name])).entries()].map(([id, agency]) => ({ id, agency }));
    return reply.send({ items, counts, departments });
  });

  // Everything the Closure Court page shows for one complaint.
  typed.get("/api/court/:id", { preHandler: [requireAuth], schema: { params: z.object({ id: z.string().uuid() }) } }, async (req, reply) => {
    if (!(await assertTicketInScope(req.user!, req.params.id))) return reply.status(404).send(notFound);
    const c = await pool.query(
      `SELECT c.ticket_id, c.public_code, c.status, c.priority_band, c.sla_due_at, c.created_at, c.original_text, c.original_lang, c.category_code, cat.names AS category_names, d.agency_name, ga.name AS area_name, gc.name AS city_name, c.close_request_status
       FROM complaints c JOIN categories cat ON cat.code = c.category_code JOIN geo_cities gc ON gc.id = c.city_id LEFT JOIN departments d ON d.id = c.department_id LEFT JOIN geo_areas ga ON ga.id = c.area_id WHERE c.ticket_id = $1`, [req.params.id]);
    const events = await pool.query(`SELECT seq, type, to_state, actor_type, payload, created_at FROM complaint_events WHERE ticket_id = $1 AND type LIKE 'PROOF\\_%' ORDER BY seq`, [req.params.id]);
    const summary = (await proofSummaries([req.params.id])).get(req.params.id) ?? null;
    let view: unknown = null; let citizenAvailable = true;
    try { view = await citizenRpc("court_view", { ticket_id: req.params.id }); } catch (e) { citizenAvailable = false; if (e instanceof RpcError && e.status === 404) return reply.status(404).send(notFound); }
    const r = c.rows[0];
    return reply.send({
      complaint: { id: r.ticket_id, code: r.public_code, status: r.status, priority: r.priority_band, slaDueAt: r.sla_due_at, createdAt: r.created_at, originalText: r.original_text, originalLang: r.original_lang, category: { code: r.category_code, names: r.category_names }, department: r.agency_name, area: r.area_name, city: r.city_name, closeRequestStatus: r.close_request_status },
      summary, view, citizenAvailable, events: events.rows.map((e) => ({ seq: e.seq, type: e.type, actor: e.actor_type, at: e.created_at, payload: e.payload })),
      demoControls: demoAllowed() && req.user!.role === "NATIONAL",
    });
  });

  // A stored picture or clip, through the same scope check.
  typed.get("/api/court/media/:id", { preHandler: [requireAuth], schema: { params: z.object({ id: z.string().uuid() }) } }, async (req, reply) => {
    try {
      const m = await citizenRpc<{ ticket_id: string; mime: string; base64: string }>("court_media", { id: req.params.id });
      if (!(await assertTicketInScope(req.user!, m.ticket_id))) return reply.status(404).send(notFound);
      return reply.header("Content-Type", m.mime).header("Cache-Control", "private, max-age=600").send(Buffer.from(m.base64, "base64"));
    } catch (e) { const u = unavailable(e); return reply.status(u.status).send(u.body); }
  });

  // Submit repair proof (the demo console / Open Challenge). National officials only, and never in production.
  typed.post("/api/court/:id/proof", { preHandler: [requireAuth, requireCsrf], bodyLimit: 30_000_000, config: { rateLimit: { max: 20, timeWindow: "1 minute" } }, schema: { params: z.object({ id: z.string().uuid() }), body: ProofBody } }, async (req, reply) => {
    if (req.user!.role !== "NATIONAL" || !demoAllowed()) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    if (!(await assertTicketInScope(req.user!, req.params.id))) return reply.status(404).send(notFound);
    try {
      const data = await citizenRpc("court_submit", { ticket_id: req.params.id, files: req.body.files, declaredAt: req.body.declaredAt ?? null, note: req.body.note, gov_user_id: req.user!.id }, 60_000);
      const code = (await pool.query(`SELECT public_code FROM complaints WHERE ticket_id = $1`, [req.params.id])).rows[0]?.public_code ?? req.params.id;
      await appendAudit(pool, { userId: req.user!.id, action: "COURT_PROOF_SUBMITTED", target: String(code) }).catch(() => undefined);
      return reply.send(data);
    } catch (e) { const u = unavailable(e); return reply.status(u.status).send(u.body); }
  });

  typed.post("/api/court/:id/before", { preHandler: [requireAuth, requireCsrf], bodyLimit: 30_000_000, schema: { params: z.object({ id: z.string().uuid() }), body: ProofBody } }, async (req, reply) => {
    if (req.user!.role !== "NATIONAL" || !demoAllowed()) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    if (!(await assertTicketInScope(req.user!, req.params.id))) return reply.status(404).send(notFound);
    try { return reply.send(await citizenRpc("court_before", { ticket_id: req.params.id, files: req.body.files }, 60_000)); } catch (e) { const u = unavailable(e); return reply.status(u.status).send(u.body); }
  });

  // AI health for the System health page (National): live from the citizen stack, which makes the calls.
  typed.get("/api/health/ai", { preHandler: [requireAuth] }, async (req, reply) => {
    if (req.user!.role !== "NATIONAL") return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    try { return reply.send(await citizenRpc("ai_health", {})); } catch (e) { const u = unavailable(e); return reply.status(u.status).send(u.body); }
  });

  // Scorecard: the last evaluation run (kept in memory) and, for National, a fresh run through the citizen stack.
  let lastEval: unknown = null; let evalRunning = false;
  typed.get("/api/court/scorecard", { preHandler: [requireAuth] }, async (_req, reply) => reply.send({ result: lastEval, running: evalRunning }));
  typed.post("/api/court/scorecard/run", { preHandler: [requireAuth, requireCsrf], config: { rateLimit: { max: 3, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (req.user!.role !== "NATIONAL") return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    if (evalRunning) return reply.status(409).send({ error: "Already running", code: "BUSY" });
    evalRunning = true;
    try { lastEval = await citizenRpc("eval_run", {}, 240_000); return reply.send({ result: lastEval, running: false }); }
    catch (e) { const u = unavailable(e); return reply.status(u.status).send(u.body); }
    finally { evalRunning = false; }
  });
}
