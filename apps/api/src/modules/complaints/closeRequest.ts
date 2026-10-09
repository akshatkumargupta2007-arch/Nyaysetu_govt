// GB6: POST /api/complaints/:id/close-request (Bible 7.1).
// An official asks the CITIZEN to verify that the work is really done. This never closes anything: it only
// asks the citizen stack (over the signed internal door) to append one note to the ticket, and the citizen
// answers in their own app.
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { App } from "../../app.js";
import { env } from "../../env.js";
import { pool } from "../../db/client.js";
import { appendAudit } from "../../lib/audit.js";
import { signRequest } from "../../lib/signing.js";
import { requireAuth, requireCsrf } from "../auth/guard.js";
import { buildWhere } from "./filters.js";
import { cooldownState, lastCloseRequestAt } from "./cooldown.js";

export const CITIZEN_CLOSE_PATH = "/internal/gov/close-request";

/** One request per ticket + official + clock hour, so a double-click or a retry is the same request. */
export const idempotencyKey = (ticketId: string, userId: string, at = new Date()): string =>
  createHash("sha256").update(`${ticketId}|${userId}|${at.toISOString().slice(0, 13)}`).digest("hex");

type Answer = { status: number; json: { ok?: boolean; code?: string; duplicate?: boolean; seq?: number; retryAfterSeconds?: number; state?: string } };

async function callCitizen(body: object): Promise<Answer> {
  const raw = JSON.stringify(body);
  const res = await fetch(`${env.CITIZEN_INTERNAL_URL.replace(/\/$/, "")}${CITIZEN_CLOSE_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...signRequest(env.GOV_WRITEBACK_PRIVATE_KEY, "POST", CITIZEN_CLOSE_PATH, raw) },
    body: raw,
    signal: AbortSignal.timeout(10_000),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Answer["json"] };
}

export function registerCloseRequestRoute(app: App) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/api/complaints/:id/close-request",
    {
      preHandler: [requireAuth, requireCsrf],
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: { params: z.object({ id: z.string().uuid() }), body: z.object({ note: z.string().trim().max(300).optional() }).default({}) },
    },
    async (req, reply) => {
      const user = req.user!;
      const where = buildWhere(user, {}, 2);
      const found = await pool.query<{ public_code: string; status: string }>(
        `SELECT c.public_code, c.status FROM complaints c WHERE c.ticket_id = $1 AND ${where.sql}`,
        [req.params.id, ...where.params],
      );
      const c = found.rows[0];
      if (!c) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });

      // 1. only while the citizen's confirmation is pending
      if (c.status !== "WORK_DONE_PENDING_CONFIRMATION") {
        return reply.status(409).send({ error: "The work is not marked done, so there is nothing for the citizen to verify yet", code: "WRONG_STATE", status: c.status });
      }
      // 2. at most one request every 24 hours
      const cool = cooldownState(await lastCloseRequestAt(req.params.id));
      if (cool.inCooldown) {
        return reply.status(409).header("Retry-After", String(cool.retryAfterSeconds)).send({ error: "A request was already sent in the last 24 hours", code: "TOO_SOON", retryAfterSeconds: cool.retryAfterSeconds });
      }

      // 3. ask the citizen stack (signed, one narrow door)
      const key = idempotencyKey(req.params.id, user.id);
      let answer: Answer;
      try {
        answer = await callCitizen({ ticket_id: req.params.id, gov_user_id: user.id, gov_user_name: user.name, note: req.body.note ?? null, idempotency_key: key });
      } catch (err) {
        req.log.error({ err: (err as Error).message }, "citizen stack unreachable for close request");
        return reply.status(502).send({ error: "Could not reach the citizen app. Nothing was sent. Try again.", code: "CITIZEN_UNREACHABLE" });
      }
      if (answer.status === 409) {
        return reply.status(409).send({ error: answer.json.code === "TOO_SOON" ? "A request was already sent in the last 24 hours" : "The citizen app says the work is not awaiting confirmation", code: answer.json.code ?? "WRONG_STATE", retryAfterSeconds: answer.json.retryAfterSeconds });
      }
      if (answer.status !== 200 || !answer.json.ok) {
        req.log.error({ status: answer.status, code: answer.json.code }, "citizen stack refused the close request");
        return reply.status(502).send({ error: "The citizen app could not take this request", code: "CITIZEN_REFUSED" });
      }

      // 4. show it straight away (the next sync brings the real ledger event)
      await pool.query(`INSERT INTO close_requests (idempotency_key, ticket_id, user_id, note) VALUES ($1,$2,$3,$4) ON CONFLICT (idempotency_key) DO NOTHING`, [key, req.params.id, user.id, req.body.note ?? null]);
      await pool.query(
        `UPDATE complaints SET close_request_status = 'requested', close_requested_at = now(), close_requested_by = $2, close_request_note = $3, citizen_responded_at = NULL WHERE ticket_id = $1`,
        [req.params.id, user.name, req.body.note ?? null],
      );
      await appendAudit(pool, { userId: user.id, action: "CLOSE_REQUEST", target: c.public_code, payload: { duplicate: Boolean(answer.json.duplicate) } });
      return reply.send({ ok: true, duplicate: Boolean(answer.json.duplicate), closeRequest: { status: "requested", note: req.body.note ?? null } });
    },
  );
}
