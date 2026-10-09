// The "one close request per ticket per 24 hours" rule, in one place. The detail view (which decides whether the
// button is on) and the request itself (which enforces the rule) must always agree, so both call this.
import { pool } from "../../db/client.js";

export const CLOSE_REQUEST_COOLDOWN_MS = 24 * 3_600_000;

/** When the latest close request for this ticket was sent, as seen by gov: the synced ledger event OR a request
 *  gov sent a moment ago that has not come back through the sync yet. null = never. */
export async function lastCloseRequestAt(ticketId: string): Promise<Date | null> {
  const { rows } = await pool.query<{ at: Date | null }>(
    `SELECT GREATEST(
        (SELECT max(created_at) FROM complaint_events WHERE ticket_id = $1 AND type = 'CLOSE_REQUESTED_BY_GOV'),
        (SELECT max(created_at) FROM close_requests WHERE ticket_id = $1)
      ) AS at`,
    [ticketId],
  );
  return rows[0]?.at ? new Date(rows[0].at) : null;
}

export function cooldownState(last: Date | null, now = Date.now()): { inCooldown: boolean; until: Date | null; retryAfterSeconds: number } {
  if (!last) return { inCooldown: false, until: null, retryAfterSeconds: 0 };
  const until = new Date(last.getTime() + CLOSE_REQUEST_COOLDOWN_MS);
  const inCooldown = until.getTime() > now;
  return { inCooldown, until: inCooldown ? until : null, retryAfterSeconds: inCooldown ? Math.ceil((until.getTime() - now) / 1000) : 0 };
}
