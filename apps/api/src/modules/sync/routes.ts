// GA5: the INTERNAL listener (port 8091, only reachable on sync_net). It accepts exactly one thing: a signed
// batch from the citizen stack. It is a separate Fastify instance so none of the public API is reachable here
// and none of this is reachable from the public port.
import Fastify from "fastify";
import { env } from "../../env.js";
import { pool, healthCheck } from "../../db/client.js";
import { verifySignedRequest } from "../../lib/signing.js";
import { LOG_REDACT_PATHS } from "../../app.js";
import { BatchSchema } from "./schema.js";
import { applyBatch } from "./receiver.js";

export const SYNC_PATH = "/internal/sync/batch";

export async function buildSyncApp() {
  const app = Fastify({
    logger: { level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL, redact: { paths: LOG_REDACT_PATHS, censor: "[redacted]" } },
    bodyLimit: 10 * 1024 * 1024,
  });

  // Keep the body exactly as received: the signature covers its bytes, so it must be checked BEFORE parsing.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => done(null, body));

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, "sync error");
    return reply.status(500).send({ error: "Internal error", code: "INTERNAL" });
  });

  app.get("/healthz", async (_req, reply) => {
    const db = await healthCheck();
    return reply.status(db ? 200 : 503).send({ ok: db });
  });

  app.post(SYNC_PATH, async (req, reply) => {
    const raw = typeof req.body === "string" ? req.body : "";
    const v = verifySignedRequest(env.SYNC_SIGNING_PUBLIC_KEY, "POST", SYNC_PATH, req.headers, raw);
    if (!v.ok) return reply.status(401).send({ error: "Rejected", code: v.reason === "stale" ? "STALE" : "BAD_SIGNATURE" });

    // Replay defence: a valid signature can be used once. (Recorded only AFTER the signature checks out, so
    // anonymous traffic cannot fill the table.)
    await pool.query(`DELETE FROM sync_nonces WHERE at < now() - interval '10 minutes'`);
    const fresh = await pool.query(`INSERT INTO sync_nonces (nonce) VALUES ($1) ON CONFLICT DO NOTHING`, [v.nonce]);
    if (!fresh.rowCount) return reply.status(401).send({ error: "Rejected", code: "REPLAY" });

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return reply.status(400).send({ error: "Invalid JSON", code: "VALIDATION" });
    }
    const parsed = BatchSchema.safeParse(json);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid batch", code: "VALIDATION", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) });
    }
    const result = await applyBatch(pool, parsed.data);
    return reply.send(result);
  });

  return app;
}

export type SyncApp = Awaited<ReturnType<typeof buildSyncApp>>;
