import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { buildApp, type App } from "../../app.js";
import { pool } from "../../db/client.js";
import { upsertUser } from "../../db/seed.js";
import { privateKeyFromB64 } from "../../lib/keys.js";
import { signAccessToken, JWT_AUDIENCE, JWT_ISSUER } from "../../lib/tokens.js";
import { verifyAuditChain } from "../../lib/audit.js";

const PW = "correct horse battery staple";
const ORIGIN = "http://localhost:5174";
let app: App;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
beforeEach(async () => {
  await pool.query("DELETE FROM gov_sessions");
  await pool.query("UPDATE gov_users SET failed_attempts = 0, locked_until = NULL");
  await upsertUser(pool, { id: "t.admin", name: "Test Admin", email: "t.admin@test.local", role: "NATIONAL", password: PW, active: true });
  await upsertUser(pool, { id: "t.off", name: "Switched Off", email: "t.off@test.local", role: "STATE", scopeState: "CG", password: PW, active: false });
});

const login = (email: string, password: string) =>
  app.inject({ method: "POST", url: "/api/auth/login", headers: { origin: ORIGIN }, payload: { email, password } });
const cookieHeader = (res: { cookies: { name: string; value: string }[] }) => res.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
const me = (token: string) => app.inject({ method: "GET", url: "/api/me", headers: { authorization: `Bearer ${token}` } });

describe("GA4 login", () => {
  it("logs in with the right password and returns a working EdDSA token", async () => {
    const res = await login("t.admin@test.local", PW);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toMatchObject({ id: "t.admin", role: "NATIONAL" });
    expect(body.user.password_hash).toBeUndefined();
    const header = JSON.parse(Buffer.from(body.accessToken.split(".")[0], "base64url").toString());
    expect(header.alg).toBe("EdDSA");
    expect((await me(body.accessToken)).statusCode).toBe(200);
  });

  it("sets an httpOnly SameSite=Strict refresh cookie scoped to /api/auth", async () => {
    const res = await login("t.admin@test.local", PW);
    const refresh = res.cookies.find((c) => c.name === "gov_refresh")!;
    expect(refresh.httpOnly).toBe(true);
    expect(String(refresh.sameSite).toLowerCase()).toBe("strict");
    expect(refresh.path).toBe("/api/auth");
  });

  it("rejects a wrong password, an unknown email and an inactive account with the same message", async () => {
    const a = await login("t.admin@test.local", "nope");
    const b = await login("nobody@test.local", "nope");
    const c = await login("t.off@test.local", PW);
    for (const r of [a, b, c]) expect(r.statusCode).toBe(401);
    expect(a.json()).toEqual(b.json());
    expect(b.json()).toEqual(c.json());
  });

  it("refuses a login from another browser origin", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", headers: { origin: "https://evil.example" }, payload: { email: "t.admin@test.local", password: PW } });
    expect(res.statusCode).toBe(403);
  });

  it("locks the account after 5 wrong passwords, even for the right one (Bible test 6)", async () => {
    for (let i = 0; i < 5; i++) expect((await login("t.admin@test.local", "wrong")).statusCode).toBe(401);
    const locked = await login("t.admin@test.local", PW);
    expect(locked.statusCode).toBe(423);
    expect(locked.json().code).toBe("LOCKED");
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(800);
  });

  it("rate-limits the login route per address (10 a minute)", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const r = await app.inject({ method: "POST", url: "/api/auth/login", headers: { origin: ORIGIN, "x-test-rate-limit": "1" }, payload: { email: "nobody@test.local", password: "x" } });
      last = r.statusCode;
    }
    expect(last).toBe(429);
  });

  it("writes LOGIN and LOGIN_FAIL rows and the audit chain stays intact", async () => {
    await login("t.admin@test.local", PW);
    await login("t.admin@test.local", "wrong");
    const { rows } = await pool.query("SELECT action FROM gov_audit_log ORDER BY id DESC LIMIT 2");
    expect(rows.map((r) => r.action)).toEqual(["LOGIN_FAIL", "LOGIN"]);
    expect(await verifyAuditChain(pool)).toBeNull();
  });
});

describe("GA4 token validation (Bible test 1)", () => {
  const dev = new TextEncoder().encode("dev-secret-change-me");
  const ok = (extra: Record<string, unknown> = {}) => ({ ...extra });

  it("accepts nothing without a token", async () => {
    expect((await app.inject({ method: "GET", url: "/api/me" })).statusCode).toBe(401);
  });

  it("rejects a citizen token (HS256, kind: citizen)", async () => {
    const t = await new SignJWT(ok({ kind: "citizen", id: "t.admin" })).setProtectedHeader({ alg: "HS256" }).setSubject("t.admin").setExpirationTime("1h").sign(dev);
    expect((await me(t)).statusCode).toBe(401);
  });

  it("rejects a citizen-app officer token (HS256, kind: officer)", async () => {
    const t = await new SignJWT(ok({ kind: "officer", id: "t.admin" })).setProtectedHeader({ alg: "HS256" }).setSubject("t.admin").setExpirationTime("24h").sign(dev);
    expect((await me(t)).statusCode).toBe(401);
  });

  it("rejects an HS256 token signed with the citizen dev secret even with matching claims", async () => {
    const t = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("t.admin").setIssuer(JWT_ISSUER).setAudience(JWT_AUDIENCE).setExpirationTime("1h").sign(dev);
    expect((await me(t)).statusCode).toBe(401);
  });

  it("rejects the wrong audience and the wrong issuer", async () => {
    const key = privateKeyFromB64(process.env.GOV_JWT_PRIVATE_KEY!);
    const mk = (iss: string, aud: string) => new SignJWT({}).setProtectedHeader({ alg: "EdDSA" }).setSubject("t.admin").setIssuer(iss).setAudience(aud).setExpirationTime("1h").sign(key);
    expect((await me(await mk(JWT_ISSUER, "officer"))).statusCode).toBe(401);
    expect((await me(await mk("someone-else", JWT_AUDIENCE))).statusCode).toBe(401);
    expect((await me(await mk(JWT_ISSUER, JWT_AUDIENCE))).statusCode).toBe(200); // control: the same key with right claims works
  });

  it("rejects an unsigned (alg: none) token", async () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const t = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "t.admin", iss: JWT_ISSUER, aud: JWT_AUDIENCE, exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
    expect((await me(t)).statusCode).toBe(401);
  });

  it("rejects an expired token and a token carrying a kind claim", async () => {
    expect((await me(await signAccessToken({ id: "t.admin", role: "NATIONAL" }, -60))).statusCode).toBe(401);
    const key = privateKeyFromB64(process.env.GOV_JWT_PRIVATE_KEY!);
    const withKind = await new SignJWT({ kind: "citizen" }).setProtectedHeader({ alg: "EdDSA" }).setSubject("t.admin").setIssuer(JWT_ISSUER).setAudience(JWT_AUDIENCE).setExpirationTime("1h").sign(key);
    expect((await me(withKind)).statusCode).toBe(401);
  });

  it("stops working as soon as the account is switched off", async () => {
    const t = await signAccessToken({ id: "t.off", role: "STATE" });
    expect((await me(t)).statusCode).toBe(401);
  });
});

describe("GA4 refresh, logout and CSRF", () => {
  async function session() {
    const res = await login("t.admin@test.local", PW);
    return { res, cookies: cookieHeader(res), csrf: res.json().csrfToken as string };
  }

  it("refresh needs the CSRF header to match the cookie", async () => {
    const s = await session();
    const noHeader = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: s.cookies } });
    expect(noHeader.statusCode).toBe(403);
    const wrong = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: s.cookies, "x-csrf-token": "not-it" } });
    expect(wrong.statusCode).toBe(403);
    const good = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: s.cookies, "x-csrf-token": s.csrf } });
    expect(good.statusCode).toBe(200);
    expect(good.json().accessToken).toBeTruthy();
  });

  it("rotates the refresh token, and re-using the old one kills the whole session family", async () => {
    const s = await session();
    const r1 = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: s.cookies, "x-csrf-token": s.csrf } });
    expect(r1.statusCode).toBe(200);
    const fresh = { cookies: cookieHeader(r1), csrf: r1.json().csrfToken as string };
    // the OLD cookie again = theft signal
    const reuse = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: s.cookies, "x-csrf-token": s.csrf } });
    expect(reuse.statusCode).toBe(401);
    // ...and the legitimate newest token is now dead too
    const after = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: fresh.cookies, "x-csrf-token": fresh.csrf } });
    expect(after.statusCode).toBe(401);
    const { rows } = await pool.query("SELECT action FROM gov_audit_log WHERE action = 'REFRESH_REUSE'");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("logout revokes the session so refresh no longer works", async () => {
    const s = await session();
    const out = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie: s.cookies, "x-csrf-token": s.csrf } });
    expect(out.statusCode).toBe(200);
    const again = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: s.cookies, "x-csrf-token": s.csrf } });
    expect(again.statusCode).toBe(401);
  });

  it("stores only a hash of the refresh token", async () => {
    const s = await session();
    const token = s.res.cookies.find((c) => c.name === "gov_refresh")!.value;
    const { rows } = await pool.query("SELECT refresh_hash FROM gov_sessions");
    expect(rows.some((r) => r.refresh_hash === token)).toBe(false);
  });
});
