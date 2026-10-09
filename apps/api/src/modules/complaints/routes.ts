// GB1 list, GB2 group counts, GB3 detail. Every query applies the caller's role scope (GA6); a complaint
// outside it is indistinguishable from one that does not exist.
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { App } from "../../app.js";
import { pool } from "../../db/client.js";
import { requireAuth } from "../auth/guard.js";
import { buildWhere, CLOSED_STATES, FilterQuery, PRIORITY_RANK_SQL } from "./filters.js";

export const CLOSE_REQUEST_COOLDOWN_MS = 24 * 3_600_000;

const SORTS = ["created_desc", "created_asc", "priority"] as const;
const ListQuery = FilterQuery.extend({
  sort: z.enum(SORTS).default("created_desc"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(400).optional(),
});

const GROUPS = ["state", "district", "city", "area", "department", "category_l1"] as const;
const GroupQuery = FilterQuery.extend({ groupBy: z.enum(GROUPS) });

/** The columns every complaint row in a list needs (joins give the readable names in both languages). */
export const LIST_SELECT = `
  c.ticket_id, c.public_code, c.status, c.priority_band, ${PRIORITY_RANK_SQL} AS prank, c.escalation_level, c.report_count,
  c.summary_en, c.category_code, c.category_l1, cat.names AS category_names, l1.names AS category_l1_names,
  c.state_code, gs.name AS state_name, c.district_id, gd.name AS district_name, c.city_id, gc.name AS city_name,
  c.area_id, ga.name AS area_name, ga.approximate AS area_approximate,
  c.department_id, d.agency_name, d.department_name,
  c.phone_masked, c.created_at, c.created_at::text AS created_at_raw, c.sla_due_at, c.resolved_at, c.closed_at,
  c.close_request_status, c.close_requested_at, c.reopen_count,
  ST_Y(c.geom) AS lat, ST_X(c.geom) AS lng,
  (c.sla_due_at IS NOT NULL AND c.sla_due_at < now() AND NOT (c.status = ANY(ARRAY['${CLOSED_STATES.join("','")}']))) AS sla_breached`;
export const LIST_JOINS = `
  FROM complaints c
  JOIN geo_states gs ON gs.code = c.state_code
  JOIN geo_districts gd ON gd.id = c.district_id
  JOIN geo_cities gc ON gc.id = c.city_id
  LEFT JOIN geo_areas ga ON ga.id = c.area_id
  LEFT JOIN departments d ON d.id = c.department_id
  JOIN categories cat ON cat.code = c.category_code
  LEFT JOIN category_l1 l1 ON l1.code = c.category_l1`;

type Row = Record<string, any>;
const shape = (r: Row) => ({
  id: r.ticket_id,
  code: r.public_code,
  status: r.status,
  priority: r.priority_band,
  escalationLevel: r.escalation_level,
  reportCount: r.report_count,
  summary: r.summary_en,
  category: { code: r.category_code, names: r.category_names, l1: r.category_l1, l1Names: r.category_l1_names },
  location: {
    state: { code: r.state_code, name: r.state_name },
    district: { id: r.district_id, name: r.district_name },
    city: { id: r.city_id, name: r.city_name },
    area: r.area_id ? { id: r.area_id, name: r.area_name, approximate: r.area_approximate } : null,
    lat: Number(r.lat),
    lng: Number(r.lng),
  },
  department: r.department_id ? { id: r.department_id, agency: r.agency_name, department: r.department_name } : null,
  phoneMasked: r.phone_masked, // the number itself is only ever returned by the logged reveal endpoint
  createdAt: r.created_at,
  slaDueAt: r.sla_due_at,
  slaBreached: r.sla_breached,
  resolvedAt: r.resolved_at,
  closedAt: r.closed_at,
  closeRequest: r.close_request_status ? { status: r.close_request_status, requestedAt: r.close_requested_at } : null,
  reopenCount: r.reopen_count,
});

function encodeCursor(parts: unknown[]): string {
  return Buffer.from(JSON.stringify(parts)).toString("base64url");
}
function decodeCursor(c: string | undefined, width: number): string[] | null {
  if (!c) return null;
  try {
    const v = JSON.parse(Buffer.from(c, "base64url").toString());
    return Array.isArray(v) && v.length === width && v.every((x) => typeof x === "string" || typeof x === "number") ? v.map(String) : null;
  } catch {
    return null;
  }
}

export function registerComplaintRoutes(app: App) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GB1: list ───────────────────────────────────────────────────────────────
  typed.get("/api/complaints", { preHandler: [requireAuth], schema: { querystring: ListQuery } }, async (req, reply) => {
    const { sort, limit, cursor, ...filters } = req.query;
    const where = buildWhere(req.user!, filters);
    const params = [...where.params];
    let sql = where.sql;
    let order: string;
    const width = sort === "priority" ? 3 : 2;
    const c = decodeCursor(cursor, width);
    if (cursor && !c) return reply.status(400).send({ error: "Invalid cursor", code: "VALIDATION" });

    if (sort === "priority") {
      order = `${PRIORITY_RANK_SQL} DESC, c.created_at DESC, c.ticket_id DESC`;
      if (c) {
        params.push(c[0], c[1], c[2]);
        const n = params.length;
        sql += ` AND (${PRIORITY_RANK_SQL}, c.created_at, c.ticket_id) < ($${n - 2}::int, $${n - 1}::timestamptz, $${n}::uuid)`;
      }
    } else {
      const asc = sort === "created_asc";
      order = `c.created_at ${asc ? "ASC" : "DESC"}, c.ticket_id ${asc ? "ASC" : "DESC"}`;
      if (c) {
        params.push(c[0], c[1]);
        const n = params.length;
        sql += ` AND (c.created_at, c.ticket_id) ${asc ? ">" : "<"} ($${n - 1}::timestamptz, $${n}::uuid)`;
      }
    }
    params.push(limit + 1);
    const { rows } = await pool.query(`SELECT ${LIST_SELECT} ${LIST_JOINS} WHERE ${sql} ORDER BY ${order} LIMIT $${params.length}`, params);

    const more = rows.length > limit;
    const page = more ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = more && last ? encodeCursor(sort === "priority" ? [last.prank, last.created_at_raw, last.ticket_id] : [last.created_at_raw, last.ticket_id]) : null;

    // The total is only worked out for the first page (it does not change as you scroll).
    let total: number | null = null;
    if (!cursor) {
      const t = await pool.query(`SELECT count(*)::int AS n FROM complaints c WHERE ${where.sql}`, where.params);
      total = t.rows[0].n;
    }
    return reply.send({ items: page.map(shape), nextCursor, total });
  });

  // ── GB2: counts per group ───────────────────────────────────────────────────
  typed.get("/api/complaints/groups", { preHandler: [requireAuth], schema: { querystring: GroupQuery } }, async (req, reply) => {
    const { groupBy, ...filters } = req.query;
    const where = buildWhere(req.user!, filters);
    const defs: Record<(typeof GROUPS)[number], { key: string; name: string; parent: string }> = {
      state: { key: "c.state_code", name: "gs.name", parent: "NULL::text" },
      district: { key: "c.district_id", name: "gd.name", parent: "c.state_code" },
      city: { key: "c.city_id", name: "gc.name", parent: "c.district_id" },
      area: { key: "COALESCE(c.area_id,'none')", name: `COALESCE(ga.name, '{"hi":"क्षेत्र तय नहीं","en":"No area matched"}'::jsonb)`, parent: "c.city_id" },
      department: { key: "COALESCE(c.department_id,'none')", name: `COALESCE(d.agency_name, '{"hi":"विभाग तय नहीं","en":"No department"}'::jsonb)`, parent: "NULL::text" },
      category_l1: { key: "c.category_l1", name: `COALESCE(l1.names, jsonb_build_object('en', c.category_l1, 'hi', c.category_l1))`, parent: "NULL::text" },
    };
    const g = defs[groupBy];
    const { rows } = await pool.query(
      `SELECT ${g.key} AS key, ${g.name} AS name, ${g.parent} AS parent,
              count(*)::int AS count,
              count(*) FILTER (WHERE NOT (c.status = ANY(ARRAY['${CLOSED_STATES.join("','")}'])))::int AS open,
              count(*) FILTER (WHERE c.status = 'WORK_DONE_PENDING_CONFIRMATION')::int AS awaiting_citizen
       ${LIST_JOINS} WHERE ${where.sql}
       GROUP BY 1, 2, 3 ORDER BY count(*) DESC, 1`,
      where.params,
    );
    const total = rows.reduce((n, r) => n + r.count, 0);
    return reply.send({ groupBy, total, groups: rows.map((r) => ({ key: r.key, name: r.name, parent: r.parent, count: r.count, open: r.open, awaitingCitizen: r.awaiting_citizen })) });
  });

  // ── GB3: detail ─────────────────────────────────────────────────────────────
  typed.get("/api/complaints/:id", { preHandler: [requireAuth], schema: { params: z.object({ id: z.string().uuid() }) } }, async (req, reply) => {
    const where = buildWhere(req.user!, {}, 2);
    const found = await pool.query(`SELECT ${LIST_SELECT}, c.original_text, c.original_lang, c.source_event_seq, c.close_requested_by, c.close_request_note, c.citizen_responded_at ${LIST_JOINS} WHERE c.ticket_id = $1 AND ${where.sql}`, [req.params.id, ...where.params]);
    const r = found.rows[0];
    if (!r) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" }); // also what out-of-scope looks like

    const [reporters, events] = await Promise.all([
      pool.query(`SELECT report_id, phone_masked, phone_cipher IS NOT NULL AS has_phone, created_at FROM complaint_reporters WHERE ticket_id = $1 ORDER BY created_at, report_id`, [req.params.id]),
      pool.query(`SELECT seq, type, from_state, to_state, actor_type, payload, created_at FROM complaint_events WHERE ticket_id = $1 ORDER BY seq`, [req.params.id]),
    ]);

    const requests = events.rows.filter((e) => e.type === "CLOSE_REQUESTED_BY_GOV");
    const lastRequestAt = requests.length ? new Date(requests[requests.length - 1].created_at).getTime() : 0;
    const cooldownUntil = lastRequestAt ? new Date(lastRequestAt + CLOSE_REQUEST_COOLDOWN_MS) : null;
    const inCooldown = cooldownUntil ? cooldownUntil.getTime() > Date.now() : false;
    const awaiting = r.status === "WORK_DONE_PENDING_CONFIRMATION";

    return reply.send({
      complaint: {
        ...shape(r),
        originalText: r.original_text,
        originalLang: r.original_lang,
        reporters: reporters.rows.map((p, index) => ({ index, phoneMasked: p.phone_masked, phoneAvailable: p.has_phone, createdAt: p.created_at })),
      },
      timeline: events.rows.map((e) => ({
        seq: e.seq, type: e.type, fromState: e.from_state, toState: e.to_state, actor: e.actor_type, at: e.created_at,
        // only the close-request note is shown from event payloads
        note: e.type === "CLOSE_REQUESTED_BY_GOV" ? e.payload?.note ?? null : null,
        official: e.type === "CLOSE_REQUESTED_BY_GOV" ? e.payload?.gov_user_name ?? null : null,
      })),
      closeRequest: {
        status: r.close_request_status,
        requestedAt: r.close_requested_at,
        requestedBy: r.close_requested_by,
        note: r.close_request_note,
        citizenRespondedAt: r.citizen_responded_at,
        reopenCount: r.reopen_count,
        // the button is on only when the citizen's confirmation is genuinely pending AND no request went out in the last 24 h
        canRequest: awaiting && !inCooldown,
        reason: !awaiting ? "NOT_AWAITING_CITIZEN" : inCooldown ? "TOO_SOON" : null,
        cooldownUntil: inCooldown ? cooldownUntil : null,
        history: requests.map((e) => ({ at: e.created_at, official: e.payload?.gov_user_name ?? null, note: e.payload?.note ?? null })),
      },
    });
  });
}
