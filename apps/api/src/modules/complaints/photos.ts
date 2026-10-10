// The photos a citizen attached to a complaint, shown when an official opens its details.
//   GET /api/complaints/:id/photos            -> which photos exist (kind, time, whether they can be shown)
//   GET /api/complaints/:id/photos/:mediaId   -> the picture itself
// The portal keeps no copy: every picture is asked for from the citizen stack over the signed internal door.
// An official outside the complaint's area gets "not found", exactly like the detail page. Every picture an
// official opens is written to the audit log (who, which complaint).
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { App } from "../../app.js";
import { pool } from "../../db/client.js";
import { appendAudit } from "../../lib/audit.js";
import { getPhoto, listPhotos, MediaError } from "../../lib/citizenMedia.js";
import { requireAuth } from "../auth/guard.js";
import { buildWhere } from "./filters.js";

const Params = z.object({ id: z.string().uuid() });

async function inScope(req: { user?: unknown }, ticketId: string): Promise<boolean> {
  const where = buildWhere(req.user as never, {}, 2);
  const found = await pool.query(`SELECT 1 FROM complaints c WHERE c.ticket_id = $1 AND ${where.sql}`, [ticketId, ...where.params]);
  return Boolean(found.rowCount);
}

export function registerPhotoRoutes(app: App) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/api/complaints/:id/photos", { preHandler: [requireAuth], schema: { params: Params } }, async (req, reply) => {
    if (!(await inScope(req, req.params.id))) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });
    try {
      return reply.header("Cache-Control", "no-store").send({ items: await listPhotos(req.params.id) });
    } catch (err) {
      const e = err as MediaError;
      req.log.error({ code: e.code }, "listing photos failed");
      return reply.status(502).send({ error: "The photos could not be loaded", code: "CITIZEN_UNREACHABLE" });
    }
  });

  typed.get(
    "/api/complaints/:id/photos/:mediaId",
    { preHandler: [requireAuth], config: { rateLimit: { max: 120, timeWindow: "1 minute" } }, schema: { params: Params.extend({ mediaId: z.string().uuid() }) } },
    async (req, reply) => {
      if (!(await inScope(req, req.params.id))) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });
      let file;
      try {
        file = await getPhoto(req.params.id, req.params.mediaId);
      } catch (err) {
        const e = err as MediaError;
        if (e.status === 404) return reply.status(404).send({ error: "This photo is not available", code: "NOT_STORED" });
        req.log.error({ code: e.code }, "fetching a photo failed");
        return reply.status(502).send({ error: "The photo could not be loaded", code: "CITIZEN_UNREACHABLE" });
      }
      await appendAudit(pool, { userId: req.user!.id, action: "PHOTO_VIEW", target: req.params.id, payload: { mediaId: req.params.mediaId } });
      return reply
        .header("Content-Type", file.mime)
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Disposition", "inline")
        .send(Buffer.from(file.data_base64, "base64"));
    },
  );
}
