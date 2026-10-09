import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../db/client.js";
import { loadFixtures, ROWS, ticketId } from "../test/fixtures.js";
import { assertTicketInScope, scopeWhere } from "./rbac.js";
import type { AuthUser } from "./auth/guard.js";

const user = (over: Partial<AuthUser>): AuthUser => ({
  id: "u", name: "U", email: "u@x", role: "NATIONAL", scopeState: null, scopeDistrict: null, scopeCity: null, scopeDepartment: null, ...over,
});

async function visible(u: AuthUser): Promise<number[]> {
  const s = scopeWhere(u, 1);
  const { rows } = await pool.query(`SELECT public_code FROM complaints c WHERE ${s.sql} ORDER BY public_code`, s.params);
  return rows.map((r) => Number(String(r.public_code).slice(-3)) - 0);
}

beforeAll(() => loadFixtures(pool));
afterAll(() => pool.end());

describe("GA6 scopeWhere", () => {
  it("NATIONAL sees all 12", async () => {
    expect((await visible(user({ role: "NATIONAL" }))).length).toBe(ROWS.length);
  });
  it("STATE CG sees the 8 Bhilai rows, STATE KA the 4 Bengaluru rows", async () => {
    expect((await visible(user({ role: "STATE", scopeState: "CG" }))).length).toBe(8);
    expect((await visible(user({ role: "STATE", scopeState: "KA" }))).length).toBe(4);
  });
  it("DISTRICT Durg sees only Bhilai, never Bengaluru", async () => {
    expect((await visible(user({ role: "DISTRICT", scopeDistrict: "CG.DURG" }))).length).toBe(8);
    expect((await visible(user({ role: "DISTRICT", scopeDistrict: "KA.BENGALURU_URBAN" }))).length).toBe(4);
  });
  it("CITY Bhilai sees 8", async () => {
    expect((await visible(user({ role: "CITY", scopeCity: "cg.bhilai" }))).length).toBe(8);
  });
  it("DEPARTMENT sees only its own rows (BMC = 5 of 8 Bhilai, BSP = 2... see fixtures)", async () => {
    const bmc = ROWS.filter((r) => r.dept === "cg.bhilai.bmc").length;
    const bsp = ROWS.filter((r) => r.dept === "cg.bhilai.bsp_town").length;
    expect((await visible(user({ role: "DEPARTMENT", scopeDepartment: "cg.bhilai.bmc" }))).length).toBe(bmc);
    expect((await visible(user({ role: "DEPARTMENT", scopeDepartment: "cg.bhilai.bsp_town" }))).length).toBe(bsp);
  });
  it("a department user pinned to the wrong city sees nothing", async () => {
    expect((await visible(user({ role: "DEPARTMENT", scopeDepartment: "cg.bhilai.bmc", scopeCity: "ka.bengaluru" }))).length).toBe(0);
  });
  it("fails closed when a scoped role has no scope value", async () => {
    for (const role of ["STATE", "DISTRICT", "CITY", "DEPARTMENT"] as const) {
      expect((await visible(user({ role }))).length).toBe(0);
    }
  });
  it("placeholders compose with other filters", async () => {
    const u = user({ role: "STATE", scopeState: "CG" });
    const s = scopeWhere(u, 2);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM complaints c WHERE c.status = $1 AND ${s.sql}`, ["WORK_DONE_PENDING_CONFIRMATION", ...s.params]);
    expect(rows[0].n).toBe(ROWS.filter((r) => r.city === "cg.bhilai" && r.status === "WORK_DONE_PENDING_CONFIRMATION").length);
  });
});

describe("GA6 assertTicketInScope", () => {
  it("true inside the scope, false outside, false for a ticket that does not exist", async () => {
    const district = user({ role: "DISTRICT", scopeDistrict: "CG.DURG" });
    expect(await assertTicketInScope(district, ticketId(1))).toBe(true);
    expect(await assertTicketInScope(district, ticketId(9))).toBe(false); // a Bengaluru ticket
    expect(await assertTicketInScope(district, ticketId(999))).toBe(false);
  });
});
