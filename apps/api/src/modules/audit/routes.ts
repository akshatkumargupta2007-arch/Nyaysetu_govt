// GB7: CSV export and the accountability views.
//   GET /api/export.csv        the current filters as a spreadsheet: masked phones ONLY, Hindi intact, safe in Excel
//   GET /api/audit/reveals     who looked at which phone number, and when (NATIONAL only)
//   GET /api/audit/log         every sensitive action (NATIONAL only)
//   GET /api/audit/verify      checks that the audit log's hash chain is unbroken (NATIONAL only)
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { App } from "../../app.js";
import { pool } from "../../db/client.js";
import { appendAudit, verifyAuditChain } from "../../lib/audit.js";
import { requireAuth } from "../auth/guard.js";
import { buildWhere, CLOSED_STATES, FilterQuery } from "../complaints/filters.js";
import { LIST_JOINS } from "../complaints/routes.js";

export const EXPORTS_PER_HOUR = 5;
export const EXPORT_MAX_ROWS = 20_000;

/** Excel runs a cell that starts with = + - @ (or a tab/CR) as a formula. A leading apostrophe makes it plain text. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADER = [
  "complaint_id", "mobile_masked", "category_en", "category_hi", "group_en", "group_hi", "state", "district", "city", "area",
  "department", "status", "priority", "escalation_level", "reports_merged", "created_at", "sla_due_at", "sla_breached",
  "citizen_verification", "reopened_times", "summary",
];

const Page = z.object({ before: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(200).default(50) });

export function registerAuditRoutes(app: App) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/api/export.csv", { preHandler: [requireAuth], schema: { querystring: FilterQuery } }, async (req, reply) => {
    const user = req.user!;
    const recent = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM gov_audit_log WHERE user_id = $1 AND action = 'EXPORT' AND at > now() - interval '1 hour'`,
      [user.id],
    );
    if (recent.rows[0]!.n >= EXPORTS_PER_HOUR) {
      return reply.status(429).header("Retry-After", "3600").send({ error: "Too many exports this hour", code: "EXPORT_LIMIT" });
    }
    const where = buildWhere(user, req.query);
    const { rows } = await pool.query(
      `SELECT c.public_code, c.phone_masked, cat.names AS cat, l1.names AS l1, gs.name AS state, gd.name AS district, gc.name AS city,
              ga.name AS area, d.agency_name, c.status, c.priority_band, c.escalation_level, c.report_count, c.created_at, c.sla_due_at,
              (c.sla_due_at IS NOT NULL AND c.sla_due_at < now() AND NOT (c.status = ANY(ARRAY['${CLOSED_STATES.join("','")}']))) AS breached,
              c.close_request_status, c.reopen_count, c.summary_en
       ${LIST_JOINS} WHERE ${where.sql} ORDER BY c.created_at DESC, c.ticket_id DESC LIMIT ${EXPORT_MAX_ROWS}`,
      where.params,
    );
    const en = (n: Record<string, string> | null) => n?.en ?? "";
    const hi = (n: Record<string, string> | null) => n?.hi ?? "";
    const lines = [HEADER.join(",")];
    for (const r of rows) {
      lines.push([
        r.public_code, r.phone_masked, en(r.cat), hi(r.cat), en(r.l1), hi(r.l1), en(r.state), en(r.district), en(r.city), r.area ? en(r.area) : "",
        r.agency_name ? en(r.agency_name) : "", r.status, r.priority_band, r.escalation_level, r.report_count, r.created_at, r.sla_due_at,
        r.breached ? "yes" : "no", r.close_request_status ?? "", r.reopen_count, r.summary_en,
      ].map(csvCell).join(","));
    }
    await appendAudit(pool, { userId: user.id, action: "EXPORT", target: "complaints.csv", payload: { rows: rows.length, filters: Object.keys(req.query).sort() } });
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="nyaysetu-complaints-${new Date().toISOString().slice(0, 10)}.csv"`)
      .header("Cache-Control", "no-store")
      .send(`﻿${lines.join("\r\n")}\r\n`); // the byte-order mark makes Excel read the Hindi correctly
  });

  const nationalOnly = async (req: Parameters<typeof requireAuth>[0], reply: Parameters<typeof requireAuth>[1]) => {
    if (req.user?.role !== "NATIONAL") return reply.status(403).send({ error: "Not allowed", code: "FORBIDDEN" });
  };

  typed.get("/api/audit/reveals", { preHandler: [requireAuth, nationalOnly], schema: { querystring: Page } }, async (req, reply) => {
    const { before, limit } = req.query;
    const { rows } = await pool.query(
      `SELECT l.id, l.user_id, u.name AS user_name, l.public_code, l.reason, l.ip, l.at
       FROM phone_reveal_log l LEFT JOIN gov_users u ON u.id = l.user_id
       WHERE ($1::bigint IS NULL OR l.id < $1) ORDER BY l.id DESC LIMIT $2`,
      [before ?? null, limit + 1],
    );
    const more = rows.length > limit;
    const page = more ? rows.slice(0, limit) : rows;
    return reply.send({ items: page.map((r) => ({ id: Number(r.id), userId: r.user_id, userName: r.user_name, code: r.public_code, reason: r.reason, ip: r.ip, at: r.at })), next: more ? Number(page[page.length - 1]!.id) : null });
  });

  typed.get("/api/audit/log", { preHandler: [requireAuth, nationalOnly], schema: { querystring: Page } }, async (req, reply) => {
    const { before, limit } = req.query;
    const { rows } = await pool.query(
      `SELECT a.id, a.user_id, u.name AS user_name, a.action, a.target, a.at
       FROM gov_audit_log a LEFT JOIN gov_users u ON u.id = a.user_id
       WHERE ($1::bigint IS NULL OR a.id < $1) ORDER BY a.id DESC LIMIT $2`,
      [before ?? null, limit + 1],
    );
    const more = rows.length > limit;
    const page = more ? rows.slice(0, limit) : rows;
    return reply.send({ items: page.map((r) => ({ id: Number(r.id), userId: r.user_id, userName: r.user_name, action: r.action, target: r.target, at: r.at })), next: more ? Number(page[page.length - 1]!.id) : null });
  });

  typed.get("/api/audit/verify", { preHandler: [requireAuth, nationalOnly] }, async (_req, reply) => {
    const broken = await verifyAuditChain(pool);
    return reply.send({ intact: broken === null, brokenAtId: broken });
  });
}
