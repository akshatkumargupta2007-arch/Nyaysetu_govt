import { describe, expect, it } from "vitest";
import { parseTrustProxy, productionProblems, type Env } from "./env.js";

const full: Env = {
  NODE_ENV: "production", PORT: 8081, SYNC_PORT: 8091, LOG_LEVEL: "info", DATABASE_URL: "postgres://gov_app:long-random@db.internal:5432/gov",
  GOV_WEB_ORIGIN: "https://gov.example.org", CITIZEN_INTERNAL_URL: "http://citizen-api:8090",
  GOV_JWT_PRIVATE_KEY: "a", GOV_JWT_PUBLIC_KEY: "a", SYNC_SIGNING_PUBLIC_KEY: "a", GOV_WRITEBACK_PRIVATE_KEY: "a",
  GOV_PHONE_SEAL_PRIVATE_KEY: "a", GOV_PHONE_SEAL_PUBLIC_KEY: "a", GOV_ADMIN_PASSWORD: "x", GOV_ADMIN_EMAIL: "", TRUST_PROXY: "1",
};

describe("production startup checks", () => {
  it("a complete production config has no problems", () => {
    expect(productionProblems(full)).toEqual([]);
  });
  it("is silent outside production (development and tests use defaults)", () => {
    expect(productionProblems({ ...full, NODE_ENV: "development", GOV_JWT_PRIVATE_KEY: "", GOV_WEB_ORIGIN: "http://localhost:5174" })).toEqual([]);
  });
  it("names every missing key", () => {
    const p = productionProblems({ ...full, GOV_JWT_PRIVATE_KEY: "", GOV_PHONE_SEAL_PRIVATE_KEY: "" });
    expect(p).toHaveLength(2);
    expect(p.join(" ")).toContain("GOV_JWT_PRIVATE_KEY");
    expect(p.join(" ")).toContain("GOV_PHONE_SEAL_PRIVATE_KEY");
  });
  it("refuses the default database password and a non-https web address", () => {
    expect(productionProblems({ ...full, DATABASE_URL: "postgres://postgres:dev@db:5432/gov" })[0]).toContain("default development database password");
    expect(productionProblems({ ...full, GOV_WEB_ORIGIN: "http://gov.example.org" })[0]).toContain("https://");
  });
  it("insists on the restricted gov_app database role, so the audit log really cannot be edited", () => {
    const p = productionProblems({ ...full, DATABASE_URL: "postgres://postgres:a-long-random-password@db.internal:5432/gov" });
    expect(p).toHaveLength(1);
    expect(p[0]).toContain("gov_app");
  });
  it("insists that TRUST_PROXY is set, and never accepts `true`", () => {
    expect(productionProblems({ ...full, TRUST_PROXY: "" })[0]).toContain("TRUST_PROXY must be set");
    expect(productionProblems({ ...full, TRUST_PROXY: "true" })[0]).toContain("forged");
    expect(productionProblems({ ...full, TRUST_PROXY: "0" })).toEqual([]); // exposed directly: allowed, but chosen on purpose
  });
});

describe("parseTrustProxy", () => {
  it("means no proxy by default, a hop count for a number, an IP list otherwise", () => {
    expect(parseTrustProxy("")).toBe(false);
    expect(parseTrustProxy("0")).toBe(false);
    expect(parseTrustProxy("2")).toBe(2);
    expect(parseTrustProxy("10.0.0.0/8, 172.16.0.1")).toEqual(["10.0.0.0/8", "172.16.0.1"]);
  });
  it("refuses to trust every address", () => {
    for (const v of ["true", "all", "*"]) expect(() => parseTrustProxy(v)).toThrow(/forged/);
  });
});
