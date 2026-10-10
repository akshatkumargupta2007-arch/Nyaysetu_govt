// The gov-api Fastify app, assembled but not listening (so tests can build it without a port).
import Fastify, { type FastifyError, type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { env, parseTrustProxy } from "./env.js";
import { healthCheck } from "./db/client.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerComplaintRoutes } from "./modules/complaints/routes.js";
import { registerRevealRoute } from "./modules/complaints/reveal.js";
import { registerPhotoRoutes } from "./modules/complaints/photos.js";
import { registerStatsRoutes } from "./modules/stats/routes.js";
import { registerCloseRequestRoute } from "./modules/complaints/closeRequest.js";
import { registerMapRoutes } from "./modules/map/routes.js";
import { registerAuditRoutes } from "./modules/audit/routes.js";

// Never log these (Bible section 14): phone numbers, sealed phones, auth headers, cookies.
export const LOG_REDACT_PATHS = [
  "*.phone",
  "*.phone_cipher",
  "*.phone_masked",
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "req.body.password",
];

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
      redact: { paths: LOG_REDACT_PATHS, censor: "[redacted]" },
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
          : undefined,
    },
    genReqId: () => crypto.randomUUID(),
    // Which proxies to believe about the client address (see TRUST_PROXY in env.ts). Never `true`: that would let
    // anyone choose their own address with a forged X-Forwarded-For header and slip past every per-address limit.
    trustProxy: parseTrustProxy(env.TRUST_PROXY) as FastifyServerOptions["trustProxy"],
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // This API only ever returns JSON, so the CSP can forbid everything.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
  });
  await app.register(cors, {
    // A function (not a fixed string) so other origins get no CORS headers at all.
    origin: (origin, cb) => cb(null, !origin || origin === env.GOV_WEB_ORIGIN),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "authorization", "x-csrf-token", "x-view-as"],
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    // Tests make many calls from one address; a test opts back in with the x-test-rate-limit header.
    allowList: (req) => env.NODE_ENV === "test" && !req.headers["x-test-rate-limit"],
  });

  // Errors never leak stack traces or internals.
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (status >= 500) req.log.error({ err }, "unhandled error");
    if (status === 429) return reply.status(429).send({ error: "Too many requests", code: "RATE_LIMITED" });
    if (err.validation || (err as { code?: string }).code === "FST_ERR_VALIDATION") {
      return reply.status(400).send({ error: "Invalid request", code: "VALIDATION" });
    }
    return reply
      .status(status)
      .send({ error: status >= 500 ? "Internal error" : err.message, code: status >= 500 ? "INTERNAL" : "ERROR" });
  });
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: "Not found", code: "NOT_FOUND" }));

  app.get("/healthz", async (_req, reply) => {
    const db = await healthCheck();
    return reply.status(db ? 200 : 503).send({ ok: db, db: db ? "ok" : "down" });
  });

  registerAuthRoutes(app);
  registerComplaintRoutes(app);
  registerRevealRoute(app);
  registerPhotoRoutes(app);
  registerStatsRoutes(app);
  registerCloseRequestRoute(app);
  registerMapRoutes(app);
  registerAuditRoutes(app);

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
