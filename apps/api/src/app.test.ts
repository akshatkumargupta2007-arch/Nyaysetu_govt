import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, type App } from "./app.js";
import { pool } from "./db/client.js";

let app: App;
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("gov-api skeleton (GA1)", () => {
  it("GET /healthz reports the database", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, db: "ok" });
  });

  it("sets strict security headers", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("only allows the gov web origin for CORS", async () => {
    const ok = await app.inject({ method: "GET", url: "/healthz", headers: { origin: "http://localhost:5174" } });
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5174");
    const bad = await app.inject({ method: "GET", url: "/healthz", headers: { origin: "https://evil.example" } });
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("unknown routes return a plain 404 without internals", async () => {
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Not found", code: "NOT_FOUND" });
  });
});
