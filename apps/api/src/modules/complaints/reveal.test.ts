import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { buildApp, type App } from "../../app.js";
import { pool } from "../../db/client.js";
import { upsertUser } from "../../db/seed.js";
import { loadFixtures, ROWS, ticketId } from "../../test/fixtures.js";
import { testDatabaseUrl } from "../../test/test-db-url.js";
import { REVEALS_PER_HOUR } from "./reveal.js";

const PW = "reveal-test-password";
let app: App;
type Session = { auth: string; csrf: string };
const sessions: Record<string, Session> = {};

async function login(email: string): Promise<Session> {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", headers: { origin: "http://localhost:5174" }, payload: { email, password: PW } });
  expect(res.statusCode).toBe(200);
  return { auth: `Bearer ${res.json().accessToken}`, csrf: res.json().csrfToken };
}
const reveal = (id: string, who: keyof typeof sessions, body: unknown = {}, opts: { noCsrf?: boolean } = {}) => {
  const s = sessions[who]!;
  return app.inject({
    method: "POST", url: `/api/complaints/${id}/reveal-phone`, payload: body as object,
    headers: { authorization: s.auth, ...(opts.noCsrf ? {} : { cookie: `gov_csrf=${s.csrf}`, "x-csrf-token": s.csrf }) },
  });
};
const logRows = async () => (await pool.query("SELECT * FROM phone_reveal_log ORDER BY id")).rows;

beforeAll(async () => {
  await loadFixtures(pool);
  await upsertUser(pool, { id: "t.nat", name: "National", email: "t.nat@test.local", role: "NATIONAL", password: PW, active: true });
  await upsertUser(pool, { id: "t.durg", name: "Durg", email: "t.durg@test.local", role: "DISTRICT", scopeDistrict: "CG.DURG", password: PW, active: true });
  app = await buildApp();
  await app.ready();
  sessions.nat = await login("t.nat@test.local");
  sessions.durg = await login("t.durg@test.local");
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
beforeEach(async () => {
  // The test database owner may clear the log between tests; the application role cannot (checked below).
  await pool.query("TRUNCATE phone_reveal_log");
});

describe("GB4 reveal phone (Bible test 3)", () => {
  it("returns the real number, writes exactly one log row, and tells the browser not to cache it", async () => {
    const res = await reveal(ticketId(1), "nat", { reason: "calling to confirm the location" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ phone: `+91${ROWS[0]!.phone}`, tel: `tel:+91${ROWS[0]!.phone}`, reporterIndex: 0 });
    expect(res.headers["cache-control"]).toBe("no-store");
    const rows = await logRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: "t.nat", ticket_id: ticketId(1), reason: "calling to confirm the location" });
    expect(rows[0].public_code).toMatch(/^BHI-26-/);
    expect(rows[0].at).toBeInstanceOf(Date);
  });

  it("each reveal adds one row (two reveals = two rows)", async () => {
    await reveal(ticketId(1), "nat");
    await reveal(ticketId(2), "nat");
    expect(await logRows()).toHaveLength(2);
  });

  it("the audit log records the reveal but never the number", async () => {
    await reveal(ticketId(4), "nat");
    const a = await pool.query("SELECT action, target, payload FROM gov_audit_log WHERE action = 'REVEAL_PHONE' ORDER BY id DESC LIMIT 1");
    expect(a.rows[0]).toMatchObject({ action: "REVEAL_PHONE", target: expect.stringMatching(/^BHI-26-/) });
    expect(JSON.stringify(a.rows[0])).not.toContain(ROWS[3]!.phone);
    for (const r of await logRows()) expect(JSON.stringify(r)).not.toContain(ROWS[3]!.phone);
  });

  it("is refused without the CSRF token, and then nothing is logged or revealed", async () => {
    const res = await reveal(ticketId(1), "nat", {}, { noCsrf: true });
    expect(res.statusCode).toBe(403);
    expect(res.body).not.toContain(ROWS[0]!.phone);
    expect(await logRows()).toHaveLength(0);
  });

  it("needs a login", async () => {
    const res = await app.inject({ method: "POST", url: `/api/complaints/${ticketId(1)}/reveal-phone`, payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("an official outside the complaint's scope gets a plain 404 and nothing is logged", async () => {
    const res = await reveal(ticketId(9), "durg"); // a Bengaluru complaint, Durg user
    expect(res.statusCode).toBe(404);
    expect(await logRows()).toHaveLength(0);
    // ...while the same official can reveal one of their own
    expect((await reveal(ticketId(1), "durg")).statusCode).toBe(200);
  });

  it("an unknown reporter index is a 404 and logs nothing", async () => {
    expect((await reveal(ticketId(1), "nat", { reporterIndex: 5 })).statusCode).toBe(404);
    expect(await logRows()).toHaveLength(0);
  });

  it("a number erased after the retention period is gone (410), not an error", async () => {
    await pool.query("UPDATE complaint_reporters SET phone_cipher = NULL WHERE ticket_id = $1", [ticketId(5)]);
    const res = await reveal(ticketId(5), "nat");
    expect(res.statusCode).toBe(410);
    expect(res.json().code).toBe("PHONE_ERASED");
    expect(await logRows()).toHaveLength(0);
    await loadFixtures(pool); // restore for later tests
  });

  it(`stops at ${REVEALS_PER_HOUR} reveals per official per hour`, async () => {
    await pool.query(
      `INSERT INTO phone_reveal_log (user_id, ticket_id, public_code) SELECT 't.nat', $1, 'X' FROM generate_series(1, $2)`,
      [ticketId(1), REVEALS_PER_HOUR],
    );
    const res = await reveal(ticketId(2), "nat");
    expect(res.statusCode).toBe(429);
    expect(res.json().code).toBe("REVEAL_LIMIT");
    expect(res.body).not.toContain(ROWS[1]!.phone);
    expect(await logRows()).toHaveLength(REVEALS_PER_HOUR); // unchanged
    // another official is not affected by this one's limit
    expect((await reveal(ticketId(1), "durg")).statusCode).toBe(200);
  });
});

describe("GB4 the log cannot be edited by the application", () => {
  it("the gov_app role can add rows but UPDATE and DELETE are denied", async () => {
    const u = new URL(testDatabaseUrl());
    u.username = "gov_app";
    u.password = "test_app_pw_local_only";
    const app_ = new pg.Client({ connectionString: u.toString() });
    await app_.connect();
    try {
      await reveal(ticketId(1), "nat");
      expect((await app_.query("SELECT count(*)::int AS n FROM phone_reveal_log")).rows[0].n).toBe(1);
      await expect(app_.query("UPDATE phone_reveal_log SET user_id = 'someone-else'")).rejects.toThrow(/permission denied/);
      await expect(app_.query("DELETE FROM phone_reveal_log")).rejects.toThrow(/permission denied/);
      await expect(app_.query("TRUNCATE phone_reveal_log")).rejects.toThrow(/permission denied/);
      await expect(app_.query("UPDATE gov_audit_log SET action = 'x'")).rejects.toThrow(/permission denied/);
      await expect(app_.query("DELETE FROM gov_audit_log")).rejects.toThrow(/permission denied/);
    } finally {
      await app_.end();
    }
  });
});
