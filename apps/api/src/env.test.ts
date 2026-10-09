import { describe, expect, it } from "vitest";
import { productionProblems, type Env } from "./env.js";

const full: Env = {
  NODE_ENV: "production", PORT: 8081, SYNC_PORT: 8091, LOG_LEVEL: "info", DATABASE_URL: "postgres://gov_app:long-random@db.internal:5432/gov",
  GOV_WEB_ORIGIN: "https://gov.example.org", CITIZEN_INTERNAL_URL: "http://citizen-api:8090",
  GOV_JWT_PRIVATE_KEY: "a", GOV_JWT_PUBLIC_KEY: "a", SYNC_SIGNING_PUBLIC_KEY: "a", GOV_WRITEBACK_PRIVATE_KEY: "a",
  GOV_PHONE_SEAL_PRIVATE_KEY: "a", GOV_PHONE_SEAL_PUBLIC_KEY: "a", GOV_ADMIN_PASSWORD: "x",
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
});
