import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("../../lib/citizenRpc.js", async (orig) => {
  const m = await orig<typeof import("../../lib/citizenRpc.js")>();
  return { ...m, citizenRpc: vi.fn(async (op: string) => { if (op === "court_view") return { contract: { criteria: [] } }; if (op === "ai_health") return { ok: true }; if (op === "eval_run") return { n: 1, at: new Date().toISOString() }; return {}; }) };
});
import { buildApp, type App } from "../../app.js";
import { pool } from "../../db/client.js";
import { upsertUser } from "../../db/seed.js";
import { signAccessToken } from "../../lib/tokens.js";
import { loadFixtures } from "../../test/fixtures.js";

let app: App; let bhilai: string; let bengaluru: string;
const tok: Record<string, string> = {};
const H = (who: string) => ({ authorization: `Bearer ${tok[who]}`, "x-csrf-token": "c", cookie: "gov_csrf=c" });
const get = (u: string, who: string) => app.inject({ method: "GET", url: u, headers: H(who) });
const post = (u: string, who: string, body: unknown = {}) => app.inject({ method: "POST", url: u, payload: body as never, headers: H(who) });

beforeAll(async () => {
  await loadFixtures(pool);
  await upsertUser(pool, { id: "c.nat", name: "N", email: "c.nat@test.local", role: "NATIONAL", password: "x", active: true });
  await upsertUser(pool, { id: "c.cg", name: "C", email: "c.cg@test.local", role: "STATE", scopeState: "CG", password: "x", active: true });
  tok.nat = await signAccessToken({ id: "c.nat", role: "NATIONAL" });
  tok.cg = await signAccessToken({ id: "c.cg", role: "STATE" });
  bhilai = (await pool.query(`SELECT ticket_id FROM complaints WHERE city_id = 'cg.bhilai' LIMIT 1`)).rows[0].ticket_id;
  bengaluru = (await pool.query(`SELECT ticket_id FROM complaints WHERE state_code = 'KA' LIMIT 1`)).rows[0].ticket_id;
  app = await buildApp(); await app.ready();
});
afterAll(async () => { await app.close(); await pool.end(); });

describe("Closure Court routes", () => {
  it("need a login", async () => {
    for (const u of ["/api/court/queue", `/api/court/${bhilai}`, "/api/court/scorecard", "/api/health/ai"]) expect((await app.inject({ method: "GET", url: u })).statusCode, u).toBe(401);
  });
  it("show a complaint inside the official's area, and hide one outside it", async () => {
    expect((await get(`/api/court/${bhilai}`, "cg")).statusCode).toBe(200);
    expect((await get(`/api/court/${bengaluru}`, "cg")).statusCode).toBe(404);
    expect((await get(`/api/court/media/${bengaluru}`, "cg")).statusCode).toBe(404);
  });
  it("lists a queue that stays inside the area", async () => {
    const r = await get("/api/court/queue", "cg"); expect(r.statusCode).toBe(200);
    for (const row of r.json().items ?? r.json().rows ?? []) expect(row.id).not.toBe(bengaluru);
  });
  it("lets only National submit demo proof, and checks the body", async () => {
    expect((await post(`/api/court/${bhilai}/proof`, "cg", { files: [{ name: "a.jpg", mime: "image/jpeg", base64: "AAAAAAAAAA==" }] })).statusCode).toBe(403);
    expect((await post(`/api/court/${bhilai}/proof`, "nat", { files: [] })).statusCode).toBe(400);
  });
  it("lets only National run the scorecard and health check", async () => {
    expect((await post("/api/court/scorecard/run", "cg")).statusCode).toBe(403);
    expect((await get("/api/health/ai", "cg")).statusCode).toBe(403);
    expect((await post("/api/court/scorecard/run", "nat")).statusCode).toBe(200);
    expect((await get("/api/court/scorecard", "cg")).json().result.n).toBe(1);
  });
  it("refuses a state-changing call without the CSRF token", async () => {
    expect((await app.inject({ method: "POST", url: "/api/court/scorecard/run", headers: { authorization: `Bearer ${tok.nat}` } })).statusCode).toBe(403);
  });
});
