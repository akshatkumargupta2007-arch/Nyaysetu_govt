// GA4: POST /api/auth/login | refresh | logout, GET /api/me.
import { z } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { App } from "../../app.js";
import { env } from "../../env.js";
import { pool } from "../../db/client.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { appendAudit } from "../../lib/audit.js";
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS, newOpaqueToken, sha256Hex, signAccessToken } from "../../lib/tokens.js";
import { CSRF_COOKIE, loadUser, requireAuth, requireCsrf } from "./guard.js";

const REFRESH_COOKIE = "gov_refresh";
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

// A real argon2 hash to compare against when the email is unknown, so timing does not reveal who exists.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password"));

const prod = env.NODE_ENV === "production";

function setSessionCookies(reply: FastifyReply, refreshToken: string, csrf: string) {
  reply.setCookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true, sameSite: "strict", secure: prod, path: "/api/auth", maxAge: REFRESH_TTL_SECONDS,
  });
  reply.setCookie(CSRF_COOKIE, csrf, { httpOnly: false, sameSite: "strict", secure: prod, path: "/", maxAge: REFRESH_TTL_SECONDS });
}
function clearSessionCookies(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  reply.clearCookie(CSRF_COOKIE, { path: "/" });
}

const ctx = (req: FastifyRequest) => ({ ip: req.ip, ua: String(req.headers["user-agent"] ?? "").slice(0, 300) });

async function issueSession(req: FastifyRequest, reply: FastifyReply, userId: string, familyId?: string) {
  const refresh = newOpaqueToken();
  const csrf = newOpaqueToken();
  const { ip, ua } = ctx(req);
  await pool.query(
    `INSERT INTO gov_sessions (user_id, refresh_hash, family_id, expires_at, ip, user_agent)
     VALUES ($1, $2, COALESCE($3::uuid, gen_random_uuid()), now() + ($4 || ' seconds')::interval, $5, $6)`,
    [userId, sha256Hex(refresh), familyId ?? null, String(REFRESH_TTL_SECONDS), ip, ua],
  );
  setSessionCookies(reply, refresh, csrf);
  return csrf;
}

export function registerAuthRoutes(app: App) {
  const typed = app.withTypeProvider<import("fastify-type-provider-zod").ZodTypeProvider>();

  typed.post(
    "/api/auth/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: { body: z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(200) }) },
    },
    async (req, reply) => {
      // Defence in depth on top of SameSite: a browser login must come from the gov web origin.
      const origin = req.headers.origin;
      if (origin && origin !== env.GOV_WEB_ORIGIN) return reply.status(403).send({ error: "Origin not allowed", code: "ORIGIN" });

      const email = req.body.email.trim().toLowerCase();
      const { rows } = await pool.query(
        `SELECT id, password_hash, active, failed_attempts, locked_until FROM gov_users WHERE lower(email) = $1`,
        [email],
      );
      const u = rows[0];

      if (!u || !u.active) {
        await verifyPassword(await getDummyHash(), req.body.password);
        await appendAudit(pool, { action: "LOGIN_FAIL", target: email, payload: { reason: u ? "inactive" : "unknown", ip: req.ip } });
        return reply.status(401).send({ error: "Wrong email or password", code: "INVALID_CREDENTIALS" });
      }
      if (u.locked_until && new Date(u.locked_until) > new Date()) {
        const retry = Math.ceil((new Date(u.locked_until).getTime() - Date.now()) / 1000);
        await appendAudit(pool, { userId: u.id, action: "LOGIN_FAIL", target: email, payload: { reason: "locked", ip: req.ip } });
        return reply.status(423).header("Retry-After", String(retry)).send({ error: "Too many wrong attempts. Try again later.", code: "LOCKED", retryAfterSeconds: retry });
      }

      const ok = await verifyPassword(u.password_hash, req.body.password);
      if (!ok) {
        const lock = u.failed_attempts + 1 >= MAX_FAILS;
        await pool.query(
          `UPDATE gov_users SET failed_attempts = $2, locked_until = $3 WHERE id = $1`,
          [u.id, lock ? 0 : u.failed_attempts + 1, lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null],
        );
        await appendAudit(pool, { userId: u.id, action: "LOGIN_FAIL", target: email, payload: { reason: "bad_password", locked: lock, ip: req.ip } });
        return reply.status(401).send({ error: "Wrong email or password", code: "INVALID_CREDENTIALS" });
      }

      await pool.query(`UPDATE gov_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1`, [u.id]);
      const user = await loadUser(u.id);
      if (!user) return reply.status(401).send({ error: "Wrong email or password", code: "INVALID_CREDENTIALS" });
      const csrf = await issueSession(req, reply, user.id);
      await appendAudit(pool, { userId: user.id, action: "LOGIN", target: user.id, payload: { ip: req.ip } });
      return reply.send({ accessToken: await signAccessToken(user), expiresIn: ACCESS_TTL_SECONDS, csrfToken: csrf, user });
    },
  );

  // Rotating refresh token. Re-using an old (already rotated) token means it was stolen: kill the whole family.
  typed.post("/api/auth/refresh", { preHandler: [requireCsrf], config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return reply.status(401).send({ error: "Not signed in", code: "UNAUTHORIZED" });
    const { rows } = await pool.query(
      `SELECT id, user_id, family_id, revoked_at, expires_at FROM gov_sessions WHERE refresh_hash = $1`,
      [sha256Hex(token)],
    );
    const s = rows[0];
    if (!s) {
      clearSessionCookies(reply);
      return reply.status(401).send({ error: "Not signed in", code: "UNAUTHORIZED" });
    }
    if (s.revoked_at) {
      await pool.query(`UPDATE gov_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = $1`, [s.family_id]);
      await appendAudit(pool, { userId: s.user_id, action: "REFRESH_REUSE", target: s.user_id, payload: { ip: req.ip } });
      clearSessionCookies(reply);
      return reply.status(401).send({ error: "Session ended", code: "UNAUTHORIZED" });
    }
    if (new Date(s.expires_at) <= new Date()) {
      clearSessionCookies(reply);
      return reply.status(401).send({ error: "Session expired", code: "UNAUTHORIZED" });
    }
    const user = await loadUser(s.user_id);
    if (!user) {
      clearSessionCookies(reply);
      return reply.status(401).send({ error: "Not signed in", code: "UNAUTHORIZED" });
    }
    await pool.query(`UPDATE gov_sessions SET revoked_at = now() WHERE id = $1`, [s.id]);
    const csrf = await issueSession(req, reply, user.id, s.family_id);
    return reply.send({ accessToken: await signAccessToken(user), expiresIn: ACCESS_TTL_SECONDS, csrfToken: csrf, user });
  });

  typed.post("/api/auth/logout", { preHandler: [requireCsrf] }, async (req, reply) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      const { rows } = await pool.query(
        `UPDATE gov_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE refresh_hash = $1 RETURNING user_id, family_id`,
        [sha256Hex(token)],
      );
      if (rows[0]) {
        await pool.query(`UPDATE gov_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = $1`, [rows[0].family_id]);
        await appendAudit(pool, { userId: rows[0].user_id, action: "LOGOUT", target: rows[0].user_id });
      }
    }
    clearSessionCookies(reply);
    return reply.send({ ok: true });
  });

  typed.get("/api/me", { preHandler: [requireAuth] }, async (req) => ({ user: req.user }));
}
