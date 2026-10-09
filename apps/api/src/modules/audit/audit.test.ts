import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp, type App } from "../../app.js";
import { pool } from "../../db/client.js";
import { upsertUser } from "../../db/seed.js";
import { signAccessToken } from "../../lib/tokens.js";
import { appendAudit } from "../../lib/audit.js";
import { loadFixtures, ROWS, ticketId } from "../../test/fixtures.js";
import { csvCell, EXPORTS_PER_HOUR } from "./routes.js";

let app: App;
const tok: Record<string, string> = {};
beforeAll(async () => {
  await loadFixtures(pool);
  await upsertUser(pool, { id: "t.nat", name: "Nat Officer", email: "t.nat@test.local", role: "NATIONAL", password: "x", active: true });
  await upsertUser(pool, { id: "t.ka", name: "KA Officer", email: "t.ka@test.local", role: "STATE", scopeState: "KA", password: "x", active: true });
  tok.nat = await signAccessToken({ id: "t.nat", role: "NATIONAL" });
  tok.ka = await signAccessToken({ id: "t.ka", role: "STATE" });
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
beforeEach(async () => {
  await pool.query("DELETE FROM gov_audit_log WHERE action = 'EXPORT'").catch(() => {}); // test DB owner may clear it; the app role cannot
});
const get = (url: string, who = "nat") => app.inject({ method: "GET", url, headers: { authorization: `Bearer ${tok[who]}` } });

describe("GB7 CSV export", () => {
  it("is a UTF-8 spreadsheet with a byte-order mark so Excel shows Hindi correctly", async () => {
    const res = await get("/api/export.csv");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv; charset=utf-8");
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="nyaysetu-complaints-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(res.body.charCodeAt(0)).toBe(0xfeff);
    expect(res.body).toContain("सड़क पर गड्ढा"); // the Hindi category name survives
    const lines = res.body.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toContain("complaint_id,mobile_masked");
    expect(lines).toHaveLength(1 + ROWS.length);
  });

  it("carries masked phone numbers only, never a real one", async () => {
    const res = await get("/api/export.csv");
    for (const r of ROWS) expect(res.body).not.toContain(r.phone);
    expect(res.body).toContain("98XXXXXX21");
    expect(res.body).not.toContain("phone_cipher");
  });

  it("follows the filters and the role scope", async () => {
    const lines = (await get("/api/export.csv?city=ka.bengaluru")).body.trim().split("\r\n");
    expect(lines).toHaveLength(1 + ROWS.filter((r) => r.city === "ka.bengaluru").length);
    const ka = (await get("/api/export.csv", "ka")).body.trim().split("\r\n");
    expect(ka).toHaveLength(1 + 4);
    expect((await get("/api/export.csv?state=CG", "ka")).body.trim().split("\r\n")).toHaveLength(1); // header only
  });

  it("neutralises spreadsheet formulas typed by a citizen", async () => {
    await pool.query("UPDATE complaints SET summary_en = $2 WHERE ticket_id = $1", [ticketId(1), '=HYPERLINK("http://evil.example","click")']);
    const res = await get("/api/export.csv");
    expect(res.body).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
    expect(res.body).not.toMatch(/,=HYPERLINK/);
    await loadFixtures(pool);
  });

  it("csvCell quotes, escapes and defuses", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    for (const bad of ["=1+1", "+1", "-1", "@cmd", "\tx"]) expect(csvCell(bad).replace(/^"/, "").startsWith("'"), bad).toBe(true);
    expect(csvCell(null)).toBe("");
    expect(csvCell(12)).toBe("12");
  });

  it(`stops after ${EXPORTS_PER_HOUR} exports an hour, and records each one`, async () => {
    for (let i = 0; i < EXPORTS_PER_HOUR; i++) expect((await get("/api/export.csv")).statusCode).toBe(200);
    const blocked = await get("/api/export.csv");
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().code).toBe("EXPORT_LIMIT");
    const n = await pool.query("SELECT count(*)::int AS n FROM gov_audit_log WHERE action = 'EXPORT' AND user_id = 't.nat'");
    expect(n.rows[0].n).toBe(EXPORTS_PER_HOUR);
    expect((await get("/api/export.csv", "ka")).statusCode).toBe(200); // another official is not affected
  });

  it("needs a login", async () => {
    expect((await app.inject({ method: "GET", url: "/api/export.csv" })).statusCode).toBe(401);
  });
});

describe("GB7 audit views", () => {
  it("only a NATIONAL official can see them", async () => {
    for (const u of ["/api/audit/reveals", "/api/audit/log", "/api/audit/verify"]) {
      expect((await get(u, "ka")).statusCode, u).toBe(403);
      expect((await app.inject({ method: "GET", url: u })).statusCode, u).toBe(401);
      expect((await get(u, "nat")).statusCode, u).toBe(200);
    }
  });

  it("lists who revealed which number, newest first, with the official's name", async () => {
    await pool.query("TRUNCATE phone_reveal_log");
    await pool.query(`INSERT INTO phone_reveal_log (user_id, ticket_id, public_code, reason, ip) VALUES ('t.ka', $1, 'BHI-26-001003', 'first', '1.1.1.1'), ('t.nat', $1, 'BHI-26-001004', 'second', '2.2.2.2')`, [ticketId(3)]);
    const b = (await get("/api/audit/reveals")).json();
    expect(b.items.map((i: any) => [i.userName, i.code, i.reason])).toEqual([["Nat Officer", "BHI-26-001004", "second"], ["KA Officer", "BHI-26-001003", "first"]]);
    expect(JSON.stringify(b)).not.toMatch(/\b9876543\d{3}\b/); // no phone numbers in the audit view
  });

  it("pages through the action log with a cursor", async () => {
    for (let i = 0; i < 5; i++) await appendAudit(pool, { userId: "t.nat", action: "TEST_ACTION", target: `row-${i}` });
    const first = (await get("/api/audit/log?limit=2")).json();
    expect(first.items).toHaveLength(2);
    expect(first.next).toBeTruthy();
    const second = (await get(`/api/audit/log?limit=2&before=${first.next}`)).json();
    expect(second.items[0].id).toBeLessThan(first.next);
    expect(new Set([...first.items, ...second.items].map((i: any) => i.id)).size).toBe(4);
  });

  it("verifies the hash chain, and notices if a row was tampered with", async () => {
    expect((await get("/api/audit/verify")).json()).toEqual({ intact: true, brokenAtId: null });
    const { rows } = await pool.query("SELECT id FROM gov_audit_log ORDER BY id DESC LIMIT 1");
    await pool.query("UPDATE gov_audit_log SET target = 'tampered' WHERE id = $1", [rows[0].id]); // the owner can; the application role cannot
    const bad = (await get("/api/audit/verify")).json();
    expect(bad.intact).toBe(false);
    expect(bad.brokenAtId).toBe(Number(rows[0].id));
    await pool.query("TRUNCATE gov_audit_log"); // reset: a broken chain would affect later tests
  });
});
