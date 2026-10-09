// Housekeeping for tables that would otherwise grow forever. Never touches the accountability tables
// (gov_audit_log, phone_reveal_log): those are append-only on purpose.
import type pg from "pg";

export type CleanupResult = { sessions: number; loginFailures: number; syncErrors: number; nonces: number };

export async function runCleanup(pool: pg.Pool): Promise<CleanupResult> {
  const n = async (sql: string) => (await pool.query(sql)).rowCount ?? 0;
  return {
    // refresh-token rows that expired or were revoked more than a week ago (kept a while for reuse detection)
    sessions: await n(`DELETE FROM gov_sessions WHERE COALESCE(revoked_at, expires_at) < now() - interval '7 days'`),
    // login-failure counters for addresses that stopped trying more than a day ago
    loginFailures: await n(`DELETE FROM gov_login_failures WHERE updated_at < now() - interval '1 day' AND (locked_until IS NULL OR locked_until < now())`),
    syncErrors: await n(`DELETE FROM sync_errors WHERE at < now() - interval '30 days'`),
    nonces: await n(`DELETE FROM sync_nonces WHERE at < now() - interval '1 hour'`),
  };
}

/** Runs once at start and then every hour. Failures are logged and never stop the server. */
export function startCleanup(pool: pg.Pool, log: (msg: string) => void = console.log): void {
  const tick = () => runCleanup(pool).then((r) => log(`cleanup: ${JSON.stringify(r)}`), (err) => log(`cleanup failed: ${(err as Error).message}`));
  void tick();
  setInterval(tick, 3_600_000).unref();
}
