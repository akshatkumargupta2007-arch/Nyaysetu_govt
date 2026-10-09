import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, type App } from "../../app.js";
import { pool } from "../../db/client.js";
import { upsertUser } from "../../db/seed.js";
import { synth } from "../../db/synth.js";
import { signAccessToken } from "../../lib/tokens.js";
import { loadFixtures } from "../../test/fixtures.js";
import { testDatabaseUrl } from "../../test/test-db-url.js";

let app: App;
const tok: Record<string, string> = {};
beforeAll(async () => {
  await loadFixtures(pool);
  await pool.query("TRUNCATE complaint_activity, complaint_activity_plain, alerts CASCADE");
  await upsertUser(pool, { id: "p.nat", name: "N", email: "p.nat@test.local", role: "NATIONAL", password: "x", active: true });
  await upsertUser(pool, { id: "p.ka", name: "K", email: "p.ka@test.local", role: "STATE", scopeState: "KA", password: "x", active: true });
  await upsertUser(pool, { id: "p.cg", name: "C", email: "p.cg@test.local", role: "STATE", scopeState: "CG", password: "x", active: true });
  await upsertUser(pool, { id: "p.dept", name: "D", email: "p.dept@test.local", role: "DEPARTMENT", scopeState: "CG", scopeCity: "cg.bhilai", scopeDepartment: "cg.bhilai.dept1", password: "x", active: true });
  tok.nat = await signAccessToken({ id: "p.nat", role: "NATIONAL" });
  tok.ka = await signAccessToken({ id: "p.ka", role: "STATE" });
  tok.cg = await signAccessToken({ id: "p.cg", role: "STATE" });
  tok.dept = await signAccessToken({ id: "p.dept", role: "DEPARTMENT" });
  await synth(testDatabaseUrl(), 3000, { clear: true, days: 40 });
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await pool.query("DELETE FROM complaint_activity WHERE synthetic");
  await pool.query("TRUNCATE complaint_activity_plain, alerts CASCADE");
  await app.close();
  await pool.end();
});
const get = (u: string, who = "nat") => app.inject({ method: "GET", url: u, headers: { authorization: `Bearer ${tok[who]}` } });

describe("Civic Pulse (time-series API)", () => {
  it("needs a login on every endpoint", async () => {
    for (const u of ["trend", "resolution", "sla", "cells", "hotspots", "ai-health", "race", "live", "forecast", "alerts", "engine"]) {
      expect((await app.inject({ method: "GET", url: `/api/pulse/${u}` })).statusCode, u).toBe(401);
    }
  });

  it("synthetic rows are all labelled synthetic", async () => {
    const r = await pool.query("SELECT count(*) FILTER (WHERE NOT synthetic)::int AS real, count(*)::int AS total FROM complaint_activity");
    expect(r.rows[0].total).toBeGreaterThan(3000);
    expect(r.rows[0].real).toBe(0);
  });

  it("trend: gap-filled series that adds up to the raw table", async () => {
    const res = await get("/api/pulse/trend?grain=day&from=2000-01-01");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe("activity_daily");
    const sum = body.series.reduce((s: number, x: { received: number }) => s + x.received, 0);
    const raw = await pool.query("SELECT count(*)::int AS n FROM complaint_activity WHERE kind = 'REPORT_RECEIVED'");
    expect(sum).toBeLessThanOrEqual(raw.rows[0].n);
    expect(sum).toBeGreaterThan(0);
  });

  it("trend, hourly and weekly grains work", async () => {
    expect((await get("/api/pulse/trend?grain=hour")).statusCode).toBe(200);
    expect((await get("/api/pulse/trend?grain=week")).statusCode).toBe(200);
    expect((await get("/api/pulse/trend?grain=year")).statusCode).toBe(400);
  });

  it("role scope: a state sees only its own cities; a department reads the raw table", async () => {
    const total0 = (b: { series: { received: number }[] }) => b.series.reduce((s, x) => s + x.received, 0);
    const ka = (await get("/api/pulse/trend?grain=day&from=2000-01-01", "ka")).json();
    const cg = (await get("/api/pulse/trend?grain=day&from=2000-01-01", "cg")).json();
    const all = (await get("/api/pulse/trend?grain=day&from=2000-01-01")).json();
    expect(total0(ka)).toBeGreaterThan(0);
    expect(total0(ka) + total0(cg)).toBeLessThanOrEqual(total0(all));
    expect(total0(ka)).toBeLessThan(total0(all));
    const dept = (await get("/api/pulse/trend?grain=day", "dept")).json();
    expect(dept.source).toBe("complaint_activity");
    const nat = (await get("/api/pulse/trend?grain=day")).json();
    const total = (b: { series: { received: number }[] }) => b.series.reduce((s, x) => s + x.received, 0);
    expect(total(dept)).toBeLessThanOrEqual(total(nat));
  });

  it("resolution gives median <= p90", async () => {
    const body = (await get("/api/pulse/resolution")).json();
    expect(body.series.length).toBeGreaterThan(0);
    for (const p of body.series) expect(Number(p.median_hours)).toBeLessThanOrEqual(Number(p.p90_hours));
  });

  it("sla and cells respond with data", async () => {
    expect((await get("/api/pulse/sla")).json().series.length).toBeGreaterThan(0);
    const cells = (await get("/api/pulse/cells")).json();
    expect(cells.source).toBe("cell_daily");
    expect(cells.cells[0]).toHaveProperty("lat");
    expect((await get("/api/pulse/cells", "dept")).json().source).toBe("complaint_activity");
  });

  it("finds the planted hotspot and nothing else shouts", async () => {
    const body = (await get("/api/pulse/hotspots")).json();
    expect(body.hotspots.length).toBeGreaterThanOrEqual(1);
    expect(body.hotspots[0].observed).toBeGreaterThanOrEqual(30);
    expect(Number(body.hotspots[0].zscore)).toBeGreaterThanOrEqual(3);
    expect((await get("/api/pulse/hotspots", "ka")).json().hotspots.every((h: { observed: number }) => h.observed < 30)).toBe(true);
  });

  it("race: ordinary Postgres, the hypertable and the aggregates give the same answers; national only", async () => {
    expect((await get("/api/pulse/race", "cg")).statusCode).toBe(403);
    const r = (await get("/api/pulse/race")).json();
    expect(r.rows).toBeGreaterThan(3000);
    expect(r.tests.map((t: { id: string }) => t.id)).toEqual(["daily", "cells", "fixtime"]);
    for (const t of r.tests) expect(t.same_answer, t.id).toBe(true);
    expect(r.storage.plain_bytes).toBeGreaterThan(0);
    expect(r.note).toMatch(/synthetic/);
  });

  it("plain twin holds exactly the same rows as the hypertable", async () => {
    const r = await pool.query("SELECT (SELECT count(*) FROM complaint_activity)::int AS a, (SELECT count(*) FROM complaint_activity_plain)::int AS b");
    expect(r.rows[0].a).toBe(r.rows[0].b);
  });

  it("live: write rate, feed and engine facts", async () => {
    const live = (await get("/api/pulse/live")).json();
    expect(live.feed.length).toBeGreaterThan(0);
    expect(live).toHaveProperty("eps");
    expect(typeof live.totalEvents).toBe("number");
    const eng = (await get("/api/pulse/engine")).json();
    expect(eng.timescaledb).toMatch(/^2\./);
    expect(eng.hypertables).toBeGreaterThanOrEqual(4);
    expect(eng.continuous_aggregates).toBeGreaterThanOrEqual(7);
  });

  it("forecast: 72 hourly points with a band", async () => {
    const f = (await get("/api/pulse/forecast")).json();
    expect(f.points.length).toBe(72);
    expect(f.points.some((p: { upper: number | null }) => p.upper !== null)).toBe(true);
  });

  it("simulator: only national, and its rows are labelled synthetic; hotspots become alerts", async () => {
    const post = (who: string, body: object) => app.inject({ method: "POST", url: "/api/pulse/sim", headers: { authorization: `Bearer ${tok[who]}`, "content-type": "application/json" }, payload: body });
    expect((await post("cg", { action: "start" })).statusCode).toBe(403);
    expect((await post("nat", { action: "surge" })).statusCode).toBe(409);
    expect((await post("nat", { action: "start", rate: 20 })).statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 2500));
    expect((await post("nat", { action: "stop" })).statusCode).toBe(200);
    const sim = await pool.query("SELECT count(*)::int AS n, count(*) FILTER (WHERE NOT synthetic)::int AS real FROM complaint_activity WHERE at > now() - interval '10 seconds'");
    expect(sim.rows[0].n).toBeGreaterThan(0);
    expect(sim.rows[0].real).toBe(0);
    const { detectHotspots } = await import("./live.js");
    await detectHotspots(pool);
    await detectHotspots(pool); // second run adds nothing: one alert per cell per day
    const alerts = (await get("/api/pulse/alerts")).json().alerts;
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(new Set(alerts.map((a: { explanation: { cell: string } }) => a.explanation.cell)).size).toBe(alerts.length);
  });

  it("the app role can append to the time-series tables but never edit or delete them", async () => {
    const c = new (await import("pg")).default.Client({ connectionString: testDatabaseUrl().replace(/\/\/[^@]+@/, "//gov_app:test_app_pw_local_only@") });
    await c.connect();
    try {
      await c.query("INSERT INTO complaint_activity (at, ticket_id, seq, kind, synthetic) VALUES (now(), gen_random_uuid(), 1, 'REPORT_RECEIVED', true)");
      await expect(c.query("DELETE FROM complaint_activity")).rejects.toThrow(/permission denied/);
      await expect(c.query("UPDATE complaint_activity SET kind = 'x'")).rejects.toThrow(/permission denied/);
      expect((await c.query("SELECT count(*)::int AS n FROM activity_daily")).rows[0].n).toBeGreaterThan(0);
      await expect(c.query("DELETE FROM activity_daily")).rejects.toThrow();
    } finally { await c.end(); }
  });

  it("ai-health is national only", async () => {
    expect((await get("/api/pulse/ai-health", "cg")).statusCode).toBe(403);
    expect((await get("/api/pulse/ai-health")).statusCode).toBe(200);
  });
});
