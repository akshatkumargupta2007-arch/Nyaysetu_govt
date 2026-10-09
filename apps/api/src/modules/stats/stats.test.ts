import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, type App } from "../../app.js";
import { pool } from "../../db/client.js";
import { upsertUser } from "../../db/seed.js";
import { signAccessToken } from "../../lib/tokens.js";
import { loadFixtures } from "../../test/fixtures.js";

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
const kpis = async (qs = "", who = "nat") => {
  const res = await app.inject({ method: "GET", url: `/api/stats/kpis?${qs}`, headers: { authorization: `Bearer ${tok[who]}` } });
  expect(res.statusCode).toBe(200);
  return res.json().kpis;
};

// Hand-computed from test/fixtures.ts (see the header comment there):
//   12 complaints; statuses: ASSIGNED 2, DISPATCHED 2, WORK_DONE_PENDING 3, CLOSED_CONFIRMED 2, CLOSED_UNCONFIRMED 1, REOPENED 1, SUBMITTED 1
//   work done at least once (7): hours to finish 20 + 30 + 10 + 26 + 15 + 12 + 8 = 121  ->  121 / 7 = 17.3 h
//   SLA breached: 5 still open past the deadline + 1 finished late (row 6: 26 h against a 24 h SLA) = 6 of 12
describe("GB5 KPIs match the hand-computed fixture numbers", () => {
  it("nationally", async () => {
    expect(await kpis()).toEqual({
      received: 12, open: 9, awaitingCitizen: 3, resolved: 3, workDone: 7,
      avgResolutionHours: 17.3, slaBreachedPct: 50, reopenPct: 14.3, confirmedFixRate: 28.6, unconfirmedRate: 14.3,
    });
  });
  it("follows the filters (Bhilai only)", async () => {
    const k = await kpis("city=cg.bhilai");
    // Bhilai = rows 1-8. work done: rows 3,4,5,6,7 (20+30+10+26+15 = 101 h) -> 20.2 h
    expect(k).toMatchObject({ received: 8, open: 6, awaitingCitizen: 2, resolved: 2, workDone: 5, avgResolutionHours: 20.2 });
    // SLA breached: rows 1, 2, 8 are still open past the deadline + row 6 finished late (26 h vs 24 h) = 4 of 8
    expect(k.slaBreachedPct).toBe(50);
  });
  it("follows the role scope: a Karnataka user's numbers cover only Bengaluru", async () => {
    const k = await kpis("", "ka");
    expect(k).toMatchObject({ received: 4, open: 3, awaitingCitizen: 1, resolved: 1, workDone: 2, avgResolutionHours: 10, confirmedFixRate: 50, reopenPct: 0 });
  });
  it("a filter that matches nothing gives zeros and nulls, not errors", async () => {
    expect(await kpis("status=REJECTED_NOT_CIVIC")).toEqual({
      received: 0, open: 0, awaitingCitizen: 0, resolved: 0, workDone: 0,
      avgResolutionHours: null, slaBreachedPct: null, reopenPct: null, confirmedFixRate: null, unconfirmedRate: null,
    });
  });
  it("needs a login", async () => {
    expect((await app.inject({ method: "GET", url: "/api/stats/kpis" })).statusCode).toBe(401);
  });
});
