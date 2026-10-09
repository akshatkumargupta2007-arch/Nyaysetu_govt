import { describe, expect, it } from "vitest";
import { adminSeedProblems, MIN_ADMIN_PASSWORD_LENGTH } from "./seed.js";

const strong = "a-long-random-admin-password";

describe("administrator seed rules", () => {
  it("allows the demo address and a generated password outside production", () => {
    expect(adminSeedProblems({ production: false, email: "admin@nyaysetu.local", password: strong })).toEqual([]);
  });
  it("refuses a short password anywhere", () => {
    const p = adminSeedProblems({ production: false, email: "admin@nyaysetu.local", password: "x".repeat(MIN_ADMIN_PASSWORD_LENGTH - 1) });
    expect(p.join(" ")).toContain("at least");
  });
  it("in production refuses the demo address, a missing address and a missing password", () => {
    expect(adminSeedProblems({ production: true, email: "admin@nyaysetu.local", password: strong }).join(" ")).toContain("real address");
    expect(adminSeedProblems({ production: true, email: "", password: strong }).join(" ")).toContain("real address");
    expect(adminSeedProblems({ production: true, email: "head@gov.example.org", password: "" }).join(" ")).toContain("at least");
  });
  it("in production accepts a real address with a strong password", () => {
    expect(adminSeedProblems({ production: true, email: "head@gov.example.org", password: strong })).toEqual([]);
  });
});
