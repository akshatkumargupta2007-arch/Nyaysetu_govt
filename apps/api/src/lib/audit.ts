// Append-only, hash-linked audit log (like the citizen event ledger). Every row's hash covers the previous
// row's hash, so removing or editing a row breaks the chain. The application database role cannot UPDATE
// or DELETE this table either.
import { createHash } from "node:crypto";
import type pg from "pg";

export const GENESIS_HASH = "0".repeat(64);
const ADVISORY_LOCK_KEY = 7_770_001; // serialises writers so the chain has no forks

/** JSON with sorted keys, so the hash does not depend on key order (jsonb reorders keys). */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function rowHash(prev: string, r: { userId: string | null; action: string; target: string | null; payload: unknown; at: Date }): string {
  return createHash("sha256")
    .update(`${prev}|${r.userId ?? ""}|${r.action}|${r.target ?? ""}|${canonical(r.payload ?? {})}|${r.at.toISOString()}`)
    .digest("hex");
}

export type AuditEntry = { userId?: string | null; action: string; target?: string | null; payload?: Record<string, unknown> };

export async function appendAudit(pool: pg.Pool, e: AuditEntry): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK_KEY]);
    const last = await client.query<{ hash: string }>("SELECT hash FROM gov_audit_log ORDER BY id DESC LIMIT 1");
    const prev = last.rows[0]?.hash ?? GENESIS_HASH;
    const at = new Date(Math.floor(Date.now() / 1000) * 1000); // second precision survives a DB round trip
    const payload = e.payload ?? {};
    const hash = rowHash(prev, { userId: e.userId ?? null, action: e.action, target: e.target ?? null, payload, at });
    await client.query(
      `INSERT INTO gov_audit_log (user_id, action, target, payload, at, prev_hash, hash) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [e.userId ?? null, e.action, e.target ?? null, JSON.stringify(payload), at, prev, hash],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Walks the whole chain. Returns the id of the first broken row, or null when intact. */
export async function verifyAuditChain(pool: pg.Pool): Promise<number | null> {
  const { rows } = await pool.query<{ id: number; user_id: string | null; action: string; target: string | null; payload: unknown; at: Date; prev_hash: string; hash: string }>(
    "SELECT id, user_id, action, target, payload, at, prev_hash, hash FROM gov_audit_log ORDER BY id",
  );
  let prev = GENESIS_HASH;
  for (const r of rows) {
    if (r.prev_hash !== prev) return Number(r.id);
    if (rowHash(prev, { userId: r.user_id, action: r.action, target: r.target, payload: r.payload, at: r.at }) !== r.hash) return Number(r.id);
    prev = r.hash;
  }
  return null;
}
