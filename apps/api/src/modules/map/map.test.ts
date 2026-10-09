import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, type App } from "../../app.js";
import { pool } from "../../db/client.js";
import { upsertUser } from "../../db/seed.js";
import { signAccessToken } from "../../lib/tokens.js";
import { loadFixtures, ROWS } from "../../test/fixtures.js";

let app: App;
const tok: Record<string, string> = {};
beforeAll(async () => {
  await loadFixtures(pool);
  await upsertUser(pool, { id: "t.nat", name: "N", email: "t.nat@test.local", role: "NATIONAL", password: "x", active: true });
  await upsertUser(pool, { id: "t.ka", name: "K", email: "t.ka@test.local", role: "STATE", scopeState: "KA", password: "x", active: true });
  tok.nat = await signAccessToken({ id: "t.nat", role: "NATIONAL" });
  tok.ka = await signAccessToken({ id: "t.ka", role: "STATE" });
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
const get = (url: string, who = "nat") => app.inject({ method: "GET", url, headers: { authorization: `Bearer ${tok[who]}` } });

describe("GD1 map data", () => {
  it("every endpoint needs a login", async () => {
    for (const u of ["/api/geo/india", "/api/map/states", "/api/map/cities", "/api/map/areas?cityId=cg.bhilai", "/api/map/points?bbox=70,8,90,30"]) {
      expect((await app.inject({ method: "GET", url: u })).statusCode, u).toBe(401);
    }
  });

  it("serves the India outline with a cache validator, and 304 when the browser already has it", async () => {
    const res = await get("/api/geo/india");
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("immutable");
    const topo = res.json();
    expect(topo.type).toBe("Topology");
    expect(Object.keys(topo.objects)).toContain("states");
    const again = await app.inject({ method: "GET", url: "/api/geo/india", headers: { authorization: `Bearer ${tok.nat}`, "if-none-match": res.headers.etag as string } });
    expect(again.statusCode).toBe(304);
  });

  it("states: all 36 appear, zeros included, and only Chhattisgarh and Karnataka are hot", async () => {
    const b = (await get("/api/map/states")).json();
    expect(b.states).toHaveLength(36);
    const hot = b.states.filter((s: any) => s.count > 0).map((s: any) => [s.code, s.count]);
    expect(hot).toEqual([["CG", 8], ["KA", 4]]);
    expect(b.max).toBe(8);
    expect(b.states.find((s: any) => s.code === "CG").name.hi).toBe("छत्तीसगढ़");
  });

  it("cities: Bhilai and Bengaluru with their counts and centres", async () => {
    const b = (await get("/api/map/cities")).json();
    expect(b.cities.map((c: any) => [c.id, c.count])).toEqual([["cg.bhilai", 8], ["ka.bengaluru", 4]]);
    const bhilai = b.cities.find((c: any) => c.id === "cg.bhilai");
    expect(bhilai.lat).toBeCloseTo(21.19, 1);
    expect(bhilai.lng).toBeCloseTo(81.35, 1);
  });

  it("filters change the map: only open streetlight complaints", async () => {
    const b = (await get("/api/map/states?category_l1=STREETLIGHTS&status=OPEN")).json();
    const closed = ["CLOSED_CONFIRMED", "CLOSED_UNCONFIRMED", "REJECTED_NOT_CIVIC"];
    const expected = ROWS.filter((r) => r.l1 === "STREETLIGHTS" && !closed.includes(r.status)).length;
    expect(b.states.reduce((n: number, s: any) => n + s.count, 0)).toBe(expected);
  });

  it("role scope: a Karnataka user sees zero for Chhattisgarh", async () => {
    const b = (await get("/api/map/states", "ka")).json();
    expect(b.states).toHaveLength(36);
    expect(b.states.find((s: any) => s.code === "CG").count).toBe(0);
    expect(b.states.find((s: any) => s.code === "KA").count).toBe(4);
    expect((await get("/api/map/cities", "ka")).json().cities.find((c: any) => c.id === "cg.bhilai").count).toBe(0);
  });

  it("areas: ward and sector outlines as GeoJSON with counts, flagged approximate", async () => {
    const b = (await get("/api/map/areas?cityId=cg.bhilai")).json();
    expect(b.type).toBe("FeatureCollection");
    expect(b.features.map((f: any) => f.id).sort()).toEqual(["cg.bhilai.sector.9", "cg.bhilai.ward.14"]);
    const ward = b.features.find((f: any) => f.id === "cg.bhilai.ward.14");
    expect(ward.geometry.type).toBe("MultiPolygon");
    expect(ward.properties).toMatchObject({ kind: "ward", approximate: true, count: ROWS.filter((r) => r.area === "cg.bhilai.ward.14").length });
    expect((await get("/api/map/areas?cityId=ka.bengaluru")).json().features).toEqual([]);
    expect((await get("/api/map/areas")).statusCode).toBe(400); // a city is required
  });

  it("points: only complaints inside the rectangle; the whole country returns all 12", async () => {
    const all = (await get("/api/map/points?bbox=60,5,100,40")).json();
    expect(all.points).toHaveLength(12);
    expect(all.truncated).toBe(false);
    const bhilaiBox = (await get("/api/map/points?bbox=81,21,82,22")).json();
    expect(bhilaiBox.points).toHaveLength(8);
    expect(bhilaiBox.points.every((p: any) => p.lat > 21 && p.lat < 22)).toBe(true);
    expect(bhilaiBox.points[0]).toMatchObject({ id: expect.any(String), code: expect.stringMatching(/^BHI-/), l1: expect.any(String) });
    expect((await get("/api/map/points?bbox=0,0,1,1")).json().points).toEqual([]);
  });

  it("points respect the role scope and the filters", async () => {
    expect((await get("/api/map/points?bbox=60,5,100,40", "ka")).json().points).toHaveLength(4);
    expect((await get("/api/map/points?bbox=60,5,100,40&status=WORK_DONE_PENDING_CONFIRMATION")).json().points).toHaveLength(3);
  });

  it("rejects a malformed or impossible rectangle", async () => {
    for (const bbox of ["abc", "1,2,3", "90,10,80,20", "-200,0,10,10", "0,50,10,40"]) {
      expect((await get(`/api/map/points?bbox=${bbox}`)).statusCode, bbox).toBe(400);
    }
  });

  it("never exposes phone numbers", async () => {
    const res = await get("/api/map/points?bbox=60,5,100,40");
    for (const r of ROWS) expect(res.body).not.toContain(r.phone);
    expect(res.body).not.toContain("phone");
  });
});
