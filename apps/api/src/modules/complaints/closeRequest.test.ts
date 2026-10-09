import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, type App } from "../../app.js";
import { pool } from "../../db/client.js";
import { upsertUser } from "../../db/seed.js";
import { verifySignedRequest } from "../../lib/signing.js";
import { loadFixtures, ticketId } from "../../test/fixtures.js";
import { CITIZEN_CLOSE_PATH, idempotencyKey } from "./closeRequest.js";

const PW = "close-request-test-pw";
const WB_PUB = process.env.TEST_WRITEBACK_PUBLIC_KEY!;
let app: App;
const sessions: Record<string, { auth: string; csrf: string }> = {};

async function login(email: string) {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", headers: { origin: "http://localhost:5174" }, payload: { email, password: PW } });
  expect(res.statusCode).toBe(200);
  return { auth: `Bearer ${res.json().accessToken}`, csrf: res.json().csrfToken as string };
}
const request = (id: string, who: string, body: unknown = {}, csrf = true) => {
  const s = sessions[who]!;
  return app.inject({
    method: "POST", url: `/api/complaints/${id}/close-request`, payload: body as object,
    headers: { authorization: s.auth, ...(csrf ? { cookie: `gov_csrf=${s.csrf}`, "x-csrf-token": s.csrf } : {}) },
  });
};

type Call = { url: string; headers: Record<string, string>; raw: string };
function stubCitizen(reply: () => { status: number; json: object } | Error = () => ({ status: 200, json: { ok: true, seq: 9 } })) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: { headers: Record<string, string>; body: string }) => {
    calls.push({ url, headers: init.headers, raw: init.body });
    const r = reply();
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.json), { status: r.status, headers: { "content-type": "application/json" } });
  });
  return calls;
}

beforeAll(async () => {
  await upsertUser(pool, { id: "t.nat", name: "Officer Nat", email: "t.nat@test.local", role: "NATIONAL", password: PW, active: true });
  await upsertUser(pool, { id: "t.ka", name: "Officer KA", email: "t.ka@test.local", role: "STATE", scopeState: "KA", password: PW, active: true });
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
beforeEach(async () => {
  await loadFixtures(pool);
  await pool.query("TRUNCATE close_requests");
  sessions.nat = await login("t.nat@test.local");
  sessions.ka = await login("t.ka@test.local");
});
afterEach(() => vi.unstubAllGlobals());

const row = async (n: number) => (await pool.query("SELECT close_request_status, close_requested_by, close_request_note FROM complaints WHERE ticket_id = $1", [ticketId(n)])).rows[0];
// fixture 3 = WORK_DONE_PENDING_CONFIRMATION, no request yet; fixture 4 = already marked 'requested' but with no recent ledger event
describe("GB6 close request: the rules (Bible test 4)", () => {
  it("is refused unless the ticket is WORK_DONE_PENDING_CONFIRMATION, and the citizen is never contacted", async () => {
    const calls = stubCitizen();
    for (const n of [1, 2, 5, 6, 7, 8]) {
      const res = await request(ticketId(n), "nat");
      expect(res.statusCode, `fixture ${n}`).toBe(409);
      expect(res.json().code).toBe("WRONG_STATE");
    }
    expect(calls).toHaveLength(0);
  });

  it("success: a correctly signed call goes to the citizen stack and the complaint shows 'requested'", async () => {
    const calls = stubCitizen();
    const res = await request(ticketId(3), "nat", { note: "Work is finished, please check" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, closeRequest: { status: "requested", note: "Work is finished, please check" } });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toMatch(new RegExp(`${CITIZEN_CLOSE_PATH}$`));
    // the signature is exactly what the citizen bridge verifies with the gov write-back PUBLIC key
    expect(verifySignedRequest(WB_PUB, "POST", CITIZEN_CLOSE_PATH, calls[0]!.headers, calls[0]!.raw)).toMatchObject({ ok: true });
    expect(JSON.parse(calls[0]!.raw)).toEqual({
      ticket_id: ticketId(3), gov_user_id: "t.nat", gov_user_name: "Officer Nat", note: "Work is finished, please check",
      idempotency_key: idempotencyKey(ticketId(3), "t.nat"),
    });
    expect(await row(3)).toEqual({ close_request_status: "requested", close_requested_by: "Officer Nat", close_request_note: "Work is finished, please check" });
    const audit = await pool.query("SELECT action, target FROM gov_audit_log WHERE action = 'CLOSE_REQUEST' ORDER BY id DESC LIMIT 1");
    expect(audit.rows[0]).toMatchObject({ action: "CLOSE_REQUEST", target: expect.stringMatching(/^BHI-26-/) });
  });

  it("a note is optional", async () => {
    stubCitizen();
    expect((await request(ticketId(3), "nat")).statusCode).toBe(200);
    expect((await row(3)).close_request_note).toBeNull();
  });

  it("a second request within 24 hours is refused with the time it will be allowed again, and the citizen is not contacted twice", async () => {
    const calls = stubCitizen();
    expect((await request(ticketId(3), "nat")).statusCode).toBe(200);
    const second = await request(ticketId(3), "nat");
    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe("TOO_SOON");
    expect(Number(second.headers["retry-after"])).toBeGreaterThan(80_000);
    expect(calls).toHaveLength(1);
  });

  it("allowed again once 24 hours have passed", async () => {
    stubCitizen();
    await request(ticketId(3), "nat");
    await pool.query("UPDATE close_requests SET created_at = now() - interval '25 hours'");
    expect((await request(ticketId(3), "nat")).statusCode).toBe(200);
  });

  it("the idempotency key is stable within an hour and differs by ticket, official or hour", () => {
    const t = new Date("2026-10-08T10:15:00Z");
    const k = idempotencyKey(ticketId(3), "u1", t);
    expect(idempotencyKey(ticketId(3), "u1", new Date("2026-10-08T10:59:59Z"))).toBe(k);
    expect(idempotencyKey(ticketId(3), "u1", new Date("2026-10-08T11:00:00Z"))).not.toBe(k);
    expect(idempotencyKey(ticketId(3), "u2", t)).not.toBe(k);
    expect(idempotencyKey(ticketId(4), "u1", t)).not.toBe(k);
  });
});

describe("GB6 close request: failure and safety", () => {
  it("if the citizen app is down, the official is told, nothing is recorded, and they can try again", async () => {
    stubCitizen(() => new Error("connect ECONNREFUSED"));
    const res = await request(ticketId(3), "nat");
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe("CITIZEN_UNREACHABLE");
    expect((await row(3)).close_request_status).toBeNull();
    stubCitizen();
    expect((await request(ticketId(3), "nat")).statusCode).toBe(200);
  });

  it("if the citizen app says the state moved on, that is passed through and nothing is recorded", async () => {
    stubCitizen(() => ({ status: 409, json: { code: "WRONG_STATE" } }));
    const res = await request(ticketId(3), "nat");
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("WRONG_STATE");
    expect((await row(3)).close_request_status).toBeNull();
  });

  it("a signature failure at the citizen side is reported as a refusal, not as success", async () => {
    stubCitizen(() => ({ status: 401, json: { code: "BAD_SIGNATURE" } }));
    const res = await request(ticketId(3), "nat");
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe("CITIZEN_REFUSED");
    expect((await row(3)).close_request_status).toBeNull();
  });

  it("an official outside the complaint's scope gets 404 and the citizen is never contacted", async () => {
    const calls = stubCitizen();
    const res = await request(ticketId(3), "ka"); // a Bhilai ticket, Karnataka user
    expect(res.statusCode).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("needs a login and the CSRF token", async () => {
    const calls = stubCitizen();
    expect((await app.inject({ method: "POST", url: `/api/complaints/${ticketId(3)}/close-request`, payload: {} })).statusCode).toBe(401);
    expect((await request(ticketId(3), "nat", {}, false)).statusCode).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("rejects a note longer than 300 characters", async () => {
    const calls = stubCitizen();
    expect((await request(ticketId(3), "nat", { note: "x".repeat(301) })).statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("the gov portal has no way to close a ticket: only the close-request route exists for this action", async () => {
    const routes = app.printRoutes({ commonPrefix: false });
    expect(routes).toContain("close-request");
    expect(routes).not.toMatch(/\/(close|resolve|confirm|reopen)(?![\w-])/); // "/close-request" is fine, "/close" is not
  });
});
