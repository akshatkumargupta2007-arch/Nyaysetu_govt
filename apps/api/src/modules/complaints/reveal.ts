// GB4: POST /api/complaints/:id/reveal-phone. The phone number is stored sealed; this is the ONLY place it is
// opened. Every reveal is written to phone_reveal_log (which the app role can never edit or delete) BEFORE the
// number is returned, and the number itself is never written to any log.
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { App } from "../../app.js";
import { env } from "../../env.js";
import { pool } from "../../db/client.js";
import { appendAudit } from "../../lib/audit.js";
import { openSealedPhone } from "../../lib/phone-seal.js";
import { requireAuth, requireCsrf } from "../auth/guard.js";
import { buildWhere } from "./filters.js";

export const REVEALS_PER_HOUR = 30;

export function registerRevealRoute(app: App) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/api/complaints/:id/reveal-phone",
    {
      preHandler: [requireAuth, requireCsrf],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ reporterIndex: z.number().int().min(0).max(499).default(0), reason: z.string().trim().max(200).optional() }).default({ reporterIndex: 0 }),
      },
    },
    async (req, reply) => {
      const user = req.user!;
      reply.header("Cache-Control", "no-store");

      const where = buildWhere(user, {}, 2);
      const found = await pool.query<{ public_code: string; phone_cipher: string | null }>(
        `SELECT c.public_code, c.phone_cipher FROM complaints c WHERE c.ticket_id = $1 AND ${where.sql}`,
        [req.params.id, ...where.params],
      );
      const complaint = found.rows[0];
      if (!complaint) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });

      const recent = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM phone_reveal_log WHERE user_id = $1 AND at > now() - interval '1 hour'`, [user.id]);
      if (recent.rows[0]!.n >= REVEALS_PER_HOUR) {
        return reply.status(429).header("Retry-After", "3600").send({ error: "Too many numbers revealed this hour", code: "REVEAL_LIMIT" });
      }

      const reporters = await pool.query<{ phone_cipher: string | null }>(
        `SELECT phone_cipher FROM complaint_reporters WHERE ticket_id = $1 ORDER BY created_at, report_id`,
        [req.params.id],
      );
      const idx = req.body.reporterIndex;
      const cipher = reporters.rowCount ? reporters.rows[idx]?.phone_cipher : idx === 0 ? complaint.phone_cipher : undefined;
      if (cipher === undefined) return reply.status(404).send({ error: "No such reporter", code: "NOT_FOUND" });
      if (cipher === null) return reply.status(410).send({ error: "This number was deleted after the retention period", code: "PHONE_ERASED" });

      let digits: string;
      try {
        digits = openSealedPhone(env.GOV_PHONE_SEAL_PRIVATE_KEY, cipher);
      } catch {
        req.log.error({ ticketId: req.params.id }, "could not open a sealed phone number"); // never the data
        return reply.status(500).send({ error: "Internal error", code: "INTERNAL" });
      }

      // Log FIRST. If this fails the number is not returned.
      await pool.query(
        `INSERT INTO phone_reveal_log (user_id, ticket_id, public_code, reason, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)`,
        [user.id, req.params.id, complaint.public_code, req.body.reason ?? null, req.ip, String(req.headers["user-agent"] ?? "").slice(0, 300)],
      );
      await appendAudit(pool, { userId: user.id, action: "REVEAL_PHONE", target: complaint.public_code, payload: { reporterIndex: idx, ip: req.ip } });

      const phone = `+91${digits.replace(/\D/g, "").slice(-10)}`;
      return reply.send({ phone, tel: `tel:${phone}`, reporterIndex: idx, loggedAs: user.id });
    },
  );
}
