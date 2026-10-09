import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../db/client.js";
import { runCleanup } from "./cleanup.js";
import { upsertUser } from "../db/seed.js";
import { appendAudit } from "./audit.js";

beforeAll(async () => {
  await upsertUser(pool, { id: "t.clean", name: "Clean", email: "t.clean@test.local", role: "NATIONAL", password: "x", active: true });
});
afterAll(async () => {
  await pool.end();
});

describe("housekeeping", () => {
  it("removes old sessions, login counters, sync errors and nonces, and keeps recent ones", async () => {
    await pool.query("DELETE FROM gov_sessions; DELETE FROM gov_login_failures; DELETE FROM sync_errors; DELETE FROM sync_nonces");
    const sess = (id: string, expires: string, revoked: string | null) =>
      pool.query(`INSERT INTO gov_sessions (user_id, refresh_hash, expires_at, revoked_at) VALUES ('t.clean', $1, now() + $2::interval, ${revoked ? "now() + $3::interval" : "NULL"})`, revoked ? [id, expires, revoked] : [id, expires]);
    await sess("old-expired", "-10 days", null);
    await sess("old-revoked", "1 day", "-9 days");
    await sess("recent-revoked", "1 day", "-1 day"); // kept: reuse detection needs it for a while
    await sess("active", "5 hours", null);
    await pool.query(`INSERT INTO gov_login_failures (email, ip, fails, updated_at) VALUES ('old@x', '1.1.1.1', 2, now() - interval '3 days'), ('new@x', '1.1.1.2', 2, now())`);
    await pool.query(`INSERT INTO gov_login_failures (email, ip, fails, locked_until, updated_at) VALUES ('still-locked@x', '1.1.1.3', 0, now() + interval '5 minutes', now() - interval '3 days')`);
    await pool.query(`INSERT INTO sync_errors (reason, at) VALUES ('old', now() - interval '40 days'), ('new', now())`);
    await pool.query(`INSERT INTO sync_nonces (nonce, at) VALUES ('old-nonce', now() - interval '2 hours'), ('new-nonce', now())`);

    const r = await runCleanup(pool);
    expect(r).toEqual({ sessions: 2, loginFailures: 1, syncErrors: 1, nonces: 1 });
    expect((await pool.query("SELECT refresh_hash FROM gov_sessions ORDER BY 1")).rows.map((x) => x.refresh_hash)).toEqual(["active", "recent-revoked"]);
    expect((await pool.query("SELECT email FROM gov_login_failures ORDER BY 1")).rows.map((x) => x.email)).toEqual(["new@x", "still-locked@x"]);
  });

  it("never touches the audit log or the reveal log", async () => {
    await appendAudit(pool, { userId: "t.clean", action: "TEST_KEEP", target: "x" });
    const before = (await pool.query("SELECT count(*)::int AS n FROM gov_audit_log")).rows[0].n;
    await runCleanup(pool);
    expect((await pool.query("SELECT count(*)::int AS n FROM gov_audit_log")).rows[0].n).toBe(before);
  });
});
