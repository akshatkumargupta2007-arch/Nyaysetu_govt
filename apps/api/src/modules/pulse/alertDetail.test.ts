import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, type App } from "../../app.js";
import { pool } from "../../db/client.js";
import { upsertUser } from "../../db/seed.js";
import { signAccessToken } from "../../lib/tokens.js";
import { loadFixtures } from "../../test/fixtures.js";

let app: App; let alertId: number;
const tok: Record<string, string> = {};
const post = (u: string, who: string, body?: unknown) => app.inject({ method: "POST", url: u, payload: body as never, headers: { authorization: `Bearer ${tok[who]}`, "x-csrf-token": "c", cookie: "gov_csrf=c" } });
const get = (u: string, who: string) => app.inject({ method: "GET", url: u, headers: { authorization: `Bearer ${tok[who]}` } });

beforeAll(async () => {
  await loadFixtures(pool);
  await pool.query("TRUNCATE alerts CASCADE");
  await upsertUser(pool, { id: "a.nat", name: "Nat", email: "a.nat@test.local", role: "NATIONAL", password: "x", active: true });
  await upsertUser(pool, { id: "a.cg", name: "Cg", email: "a.cg@test.local", role: "STATE", scopeState: "CG", password: "x", active: true });
  await upsertUser(pool, { id: "a.ka", name: "Ka", email: "a.ka@test.local", role: "STATE", scopeState: "KA", password: "x", active: true });
  for (const [k, id, role] of [["nat", "a.nat", "NATIONAL"], ["cg", "a.cg", "STATE"], ["ka", "a.ka", "STATE"]] as const) tok[k] = await signAccessToken({ id, role });
  const r = await pool.query(`INSERT INTO alerts (kind, city_id, category_l1, window_start, observed, expected, zscore, explanation, synthetic) VALUES ('HOTSPOT','cg.bhilai','ROAD', now() - interval '24 hours', 12, 2, 4.1, '{"cell":"21.185,81.330"}'::jsonb, true) RETURNING id`);
  alertId = r.rows[0].id;
  app = await buildApp(); await app.ready();
});
afterAll(async () => { await pool.query("TRUNCATE alerts CASCADE"); await app.close(); await pool.end(); });

describe("alert detail and actions", () => {
  it("needs a login", async () => { expect((await app.inject({ method: "GET", url: `/api/pulse/alerts/${alertId}` })).statusCode).toBe(401); });
  it("shows the alert to an official in its state", async () => {
    const r = await get(`/api/pulse/alerts/${alertId}`, "cg");
    expect(r.statusCode).toBe(200);
    expect(r.json().alert.id).toBe(alertId);
    expect(Array.isArray(r.json().notes)).toBe(true);
  });
  it("hides it from another state with a 404", async () => {
    expect((await get(`/api/pulse/alerts/${alertId}`, "ka")).statusCode).toBe(404);
    expect((await post(`/api/pulse/alerts/${alertId}/ack`, "ka")).statusCode).toBe(404);
  });
  it("refuses actions without the CSRF token", async () => {
    const r = await app.inject({ method: "POST", url: `/api/pulse/alerts/${alertId}/ack`, headers: { authorization: `Bearer ${tok.cg}` } });
    expect(r.statusCode).toBe(403);
  });
  it("acknowledges, notes, dismisses and reopens, keeping a history", async () => {
    expect((await post(`/api/pulse/alerts/${alertId}/ack`, "cg")).json().status).toBe("acknowledged");
    expect((await post(`/api/pulse/alerts/${alertId}/note`, "cg", { note: "Team sent" })).statusCode).toBe(200);
    expect((await post(`/api/pulse/alerts/${alertId}/dismiss`, "cg")).json().status).toBe("dismissed");
    expect((await post(`/api/pulse/alerts/${alertId}/restore`, "cg")).json().status).toBe("open");
    const d = (await get(`/api/pulse/alerts/${alertId}`, "cg")).json();
    expect(d.notes.map((n: { action: string }) => n.action)).toEqual(expect.arrayContaining(["ack", "note", "dismiss", "reopen"]));
  });
  it("rejects an empty note", async () => { expect((await post(`/api/pulse/alerts/${alertId}/note`, "cg", { note: "  " })).statusCode).toBe(400); });
});
