import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../../db/client.js";
import { loadFixtures } from "../../test/fixtures.js";
import { buildQuery, checkSpec, Spec, summarise, VIEWS, type SpecT } from "./routes.js";

const base = (o: Partial<SpecT> = {}): SpecT => Spec.parse({ view: "reports_daily", metrics: ["received"], group_by: [], filters: {}, time: { from: "2026-10-01", to: "2026-10-07" }, ...o });
type U = Parameters<typeof buildQuery>[1];
const user = (o: Partial<U>) => ({ id: "x", name: "x", role: "NATIONAL", ...o }) as U;

beforeAll(async () => { await loadFixtures(pool); });
afterAll(async () => { await pool.end(); });

describe("Ask the City safety", () => {
  it("only knows the allow-listed views", () => { expect(Object.keys(VIEWS).sort()).toEqual(["proof_outcomes", "reports_daily", "resolution_daily", "sla_daily", "tickets_summary"]); });
  it("rejects a spec with an unknown view", () => { expect(() => Spec.parse({ ...base(), view: "users" })).toThrow(); });
  it("rejects unknown metrics, groups and filters", () => {
    expect(() => checkSpec(base({ metrics: ["password"] } as never))).toThrow(/unknown metric/);
    expect(() => checkSpec(base({ group_by: ["officer"] } as never))).toThrow(/unknown group/);
    expect(() => checkSpec(base({ filters: { "1=1;--": "x" } } as never))).toThrow(/unknown filter/);
  });
  it("rejects a time range that is reversed or too long", () => {
    expect(() => checkSpec(base({ time: { from: "2026-10-07", to: "2026-10-01" } }))).toThrow();
    expect(() => checkSpec(base({ time: { from: "2024-01-01", to: "2026-10-01" } }))).toThrow();
  });
  it("never puts user text into the SQL, only into parameters", async () => {
    const b = await buildQuery(base({ filters: { category: "x'; DROP TABLE users;--" } } as never), user({}));
    if ("denied" in b) throw new Error("denied"); expect(b.sql).not.toContain("DROP"); expect(b.params).toContain("x'; DROP TABLE users;--");
  });
  it("narrows a state official to their own cities", async () => {
    const b = await buildQuery(base(), user({ role: "STATE", scopeState: "CG" }));
    if ("denied" in b) throw new Error("denied"); expect(b.sql).toMatch(/city_id = ANY/);
    const nat = await buildQuery(base(), user({}));
    if ("denied" in nat) throw new Error("denied"); expect(nat.sql).not.toMatch(/city_id = ANY/);
  });
  it("summarises empty results plainly", () => { expect(summarise(base(), [])).toMatch(/no|No/); });
});
