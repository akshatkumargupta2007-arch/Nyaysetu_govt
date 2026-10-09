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
export const LOGIN_FAILED_MESSAGE = "Wrong email or password. After 5 wrong tries from the same device you must wait 15 minutes.";

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
      const ip = req.ip;
      // Every failure path answers the same 401 with the same message, so nobody can tell a real account from a
      // made-up one, or a locked one from a wrong password. The lockout is per (email, address): someone else
      // typing wrong passwords for this email from another address cannot lock the real person out.
      const refuse = async (reason: string, userId: string | null) => {
        await appendAudit(pool, { userId, action: "LOGIN_FAIL", target: email, payload: { reason, ip } });
        return reply.status(401).send({ error: LOGIN_FAILED_MESSAGE, code: "INVALID_CREDENTIALS" });
      };

      const lock = await pool.query<{ fails: number; locked_until: Date | null }>(`SELECT fails, locked_until FROM gov_login_failures WHERE email = $1 AND ip = $2`, [email, ip]);
      const locked = Boolean(lock.rows[0]?.locked_until && new Date(lock.rows[0].locked_until) > new Date());

      const { rows } = await pool.query(`SELECT id, password_hash, active FROM gov_users WHERE lower(email) = $1`, [email]);
      const u = rows[0];

      // Always spend the same time hashing, whether or not the account exists or is locked.
      const ok = u && u.active && !locked ? await verifyPassword(u.password_hash, req.body.password) : (await verifyPassword(await getDummyHash(), req.body.password), false);

      if (!ok) {
        if (!locked) {
          const fails = (lock.rows[0]?.fails ?? 0) + 1;
          const lockNow = fails >= MAX_FAILS;
          await pool.query(
            `INSERT INTO gov_login_failures (email, ip, fails, locked_until, updated_at) VALUES ($1,$2,$3,$4,now())
             ON CONFLICT (email, ip) DO UPDATE SET fails = EXCLUDED.fails, locked_until = EXCLUDED.locked_until, updated_at = now()`,
            [email, ip, lockNow ? 0 : fails, lockNow ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null],
          );
          return refuse(!u ? "unknown" : !u.active ? "inactive" : lockNow ? "bad_password_locked" : "bad_password", u?.id ?? null);
        }
        return refuse("locked", u?.id ?? null);
      }

      await pool.query(`DELETE FROM gov_login_failures WHERE email = $1 AND ip = $2`, [email, ip]);
      const user = await loadUser(u.id);
      if (!user) return refuse("inactive", u.id);
      const csrf = await issueSession(req, reply, user.id);
      await appendAudit(pool, { userId: user.id, action: "LOGIN", target: user.id, payload: { ip } });
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

  typed.get("/api/me", { preHandler: [requireAuth] }, async (req) => ({ user: req.user, realRole: req.user!.viewingAs?.realRole ?? req.user!.role }));
}
