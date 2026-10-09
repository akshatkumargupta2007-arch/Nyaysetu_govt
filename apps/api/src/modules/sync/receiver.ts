// GA5: applies a verified batch from the citizen stack. Idempotent and safe against out-of-order delivery:
// a ticket is only written when its last_event_seq is NEWER than what gov already has.
import type pg from "pg";
import type { Batch, Ticket } from "./schema.js";

class Reject extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

export type BatchResult = {
  acked: { ticket_id: string; seq: number }[];
  rejected: { ticket_id: string; reason: string }[];
  applied: number;
  skippedStale: number;
};

type EventRow = { seq: number; type: string; from_state: string | null; to_state: string | null; payload: Record<string, unknown> | null; created_at: Date; actor_type: string | null };

/** Reads the ordered event history and works out where the gov "close request" stands. */
export function deriveCloseRequest(events: EventRow[]) {
  let status: string | null = null;
  let requestedAt: Date | null = null;
  let requestedBy: string | null = null;
  let note: string | null = null;
  let respondedAt: Date | null = null;
  let reopenCount = 0;
  for (const e of events) {
    if (e.to_state === "REOPENED") reopenCount += 1;
    if (e.type === "CLOSE_REQUESTED_BY_GOV") {
      status = "requested";
      requestedAt = e.created_at;
      requestedBy = String(e.payload?.gov_user_name ?? e.payload?.gov_user_id ?? "official");
      note = typeof e.payload?.note === "string" ? e.payload.note : null;
      respondedAt = null;
    } else if (status === "requested") {
      if (e.type === "CITIZEN_CONFIRMED" || e.to_state === "CLOSED_CONFIRMED") {
        status = "confirmed";
        respondedAt = e.created_at;
      } else if (e.type === "CITIZEN_REJECTED" || e.to_state === "REOPENED") {
        status = "reopened";
        respondedAt = e.created_at;
      } else if (e.to_state === "CLOSED_UNCONFIRMED") {
        status = "unconfirmed";
      }
    }
  }
  return { status, requestedAt, requestedBy, note, respondedAt, reopenCount };
}

async function applyReference(db: pg.PoolClient, ref: NonNullable<Batch["reference"]>) {
  for (const c of ref.categories ?? []) {
    await db.query(
      `INSERT INTO category_l1 (code, names) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING`,
      [c.l1, JSON.stringify({ en: c.l1, hi: c.l1 })],
    );
    await db.query(
      `INSERT INTO categories (code, l1, names, icon) VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO UPDATE SET l1 = EXCLUDED.l1, names = EXCLUDED.names, icon = EXCLUDED.icon`,
      [c.code, c.l1, JSON.stringify(c.names), c.icon ?? null],
    );
  }
  for (const a of ref.agencies ?? []) {
    await db.query(
      `INSERT INTO departments (id, agency_name, department_name, kind) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET agency_name = EXCLUDED.agency_name, department_name = EXCLUDED.department_name, kind = EXCLUDED.kind`,
      [a.id, JSON.stringify(a.name), a.department ? JSON.stringify(a.department) : null, a.kind ?? null],
    );
  }
  for (const t of ref.tenants ?? []) {
    // Gov owns the city -> district -> state mapping; a tenant only refreshes the city's display name.
    if (t.name) await db.query(`UPDATE geo_cities SET name = $2 WHERE id = $1`, [t.id, JSON.stringify(t.name)]);
  }
  for (const b of ref.boundaries ?? []) {
    if (b.kind === "city") continue; // the whole-city outline is not an "area"
    const city = await db.query(`SELECT 1 FROM geo_cities WHERE id = $1`, [b.tenant_id]);
    if (!city.rowCount) continue; // unknown city: nothing to attach the area to
    await db.query(
      `INSERT INTO geo_areas (id, city_id, kind, name, approximate, geom)
       VALUES ($1,$2,$3,$4,$5, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($6),4326)))
       ON CONFLICT (id) DO UPDATE SET city_id = EXCLUDED.city_id, kind = EXCLUDED.kind, name = EXCLUDED.name,
         approximate = EXCLUDED.approximate, geom = EXCLUDED.geom`,
      [b.id, b.tenant_id, b.kind, JSON.stringify(b.name), b.approximate, JSON.stringify(b.geometry)],
    );
  }
}

async function applyTicket(db: pg.PoolClient, t: Ticket): Promise<"applied" | "stale"> {
  const city = await db.query<{ district_id: string; state_code: string }>(
    `SELECT c.district_id, d.state_code FROM geo_cities c JOIN geo_districts d ON d.id = c.district_id WHERE c.id = $1`,
    [t.tenant_id],
  );
  if (!city.rowCount) throw new Reject(`unknown_tenant:${t.tenant_id}`);

  const existing = await db.query<{ source_event_seq: number }>(`SELECT source_event_seq FROM complaints WHERE ticket_id = $1`, [t.ticket_id]);
  if (existing.rowCount && existing.rows[0]!.source_event_seq >= t.last_event_seq) return "stale";

  const area = t.boundary_id ? await db.query(`SELECT 1 FROM geo_areas WHERE id = $1`, [t.boundary_id]) : null;
  const areaId = area && area.rowCount ? t.boundary_id! : null;

  // Missing reference rows get a placeholder so a ticket is never lost; the next reference sync fills the names.
  let departmentId: string | null = null;
  if (t.agency_id) {
    await db.query(
      `INSERT INTO departments (id, agency_name, department_name) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
      [t.agency_id, JSON.stringify(t.department ?? { en: t.agency_id, hi: t.agency_id }), t.department ? JSON.stringify(t.department) : null],
    );
    departmentId = t.agency_id;
  }
  await db.query(`INSERT INTO category_l1 (code, names) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING`, [t.category_l1, JSON.stringify({ en: t.category_l1, hi: t.category_l1 })]);
  await db.query(
    `INSERT INTO categories (code, l1, names) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING`,
    [t.category_code, t.category_l1, JSON.stringify({ en: t.category_code, hi: t.category_code })],
  );

  await db.query(
    `INSERT INTO complaints (ticket_id, public_code, state_code, district_id, city_id, area_id, department_id, category_code, category_l1,
       status, priority_band, escalation_level, report_count, summary_en, original_text, original_lang, geom, h3_r9,
       phone_masked, phone_cipher, sla_due_at, created_at, resolved_at, closed_at, source_event_seq, synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,ST_SetSRID(ST_MakePoint($17,$18),4326),$19,$20,$21,$22,$23,$24,$25,$26, now())
     ON CONFLICT (ticket_id) DO UPDATE SET
       public_code = EXCLUDED.public_code, state_code = EXCLUDED.state_code, district_id = EXCLUDED.district_id, city_id = EXCLUDED.city_id,
       area_id = EXCLUDED.area_id, department_id = EXCLUDED.department_id, category_code = EXCLUDED.category_code, category_l1 = EXCLUDED.category_l1,
       status = EXCLUDED.status, priority_band = EXCLUDED.priority_band, escalation_level = EXCLUDED.escalation_level, report_count = EXCLUDED.report_count,
       summary_en = EXCLUDED.summary_en, original_text = EXCLUDED.original_text, original_lang = EXCLUDED.original_lang, geom = EXCLUDED.geom, h3_r9 = EXCLUDED.h3_r9,
       phone_masked = EXCLUDED.phone_masked, phone_cipher = EXCLUDED.phone_cipher, sla_due_at = EXCLUDED.sla_due_at,
       resolved_at = EXCLUDED.resolved_at, closed_at = EXCLUDED.closed_at, source_event_seq = EXCLUDED.source_event_seq, synced_at = now()`,
    [t.ticket_id, t.public_code, city.rows[0]!.state_code, city.rows[0]!.district_id, t.tenant_id, areaId, departmentId, t.category_code, t.category_l1,
      t.state, t.priority_band, t.escalation_level, t.report_count, t.summary_officer_en, t.original_text ?? null, t.original_lang ?? null, t.lng, t.lat, t.h3_r9,
      t.phone_masked ?? null, t.phone_cipher ?? null, t.sla_due_at ?? null, t.created_at, t.resolved_at ?? null, t.closed_at ?? null, t.last_event_seq],
  );

  for (const e of t.events) {
    await db.query(
      `INSERT INTO complaint_events (ticket_id, seq, type, from_state, to_state, actor_type, payload, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (ticket_id, seq) DO NOTHING`,
      [t.ticket_id, e.seq, e.type, e.from_state ?? null, e.to_state ?? null, e.actor_type ?? null, e.payload ? JSON.stringify(e.payload) : null, e.created_at],
    );
  }
  for (const r of t.reporters ?? []) {
    await db.query(
      `INSERT INTO complaint_reporters (ticket_id, report_id, phone_masked, phone_cipher, phone_last4, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (ticket_id, report_id) DO UPDATE SET phone_masked = EXCLUDED.phone_masked, phone_cipher = EXCLUDED.phone_cipher, phone_last4 = EXCLUDED.phone_last4`,
      [t.ticket_id, r.report_id, r.phone_masked, r.phone_cipher, r.phone_cipher ? (r.phone_last4 ?? null) : null, r.created_at],
    );
  }

  const history = await db.query<EventRow>(
    `SELECT seq, type, from_state, to_state, payload, created_at, actor_type FROM complaint_events WHERE ticket_id = $1 ORDER BY seq`,
    [t.ticket_id],
  );
  const d = deriveCloseRequest(history.rows);
  await db.query(
    `UPDATE complaints SET close_request_status = $2, close_requested_at = $3, close_requested_by = $4, close_request_note = $5,
       citizen_responded_at = $6, reopen_count = $7 WHERE ticket_id = $1`,
    [t.ticket_id, d.status, d.requestedAt, d.requestedBy, d.note, d.respondedAt, d.reopenCount],
  );
  return "applied";
}

export async function applyBatch(pool: pg.Pool, batch: Batch): Promise<BatchResult> {
  const db = await pool.connect();
  const result: BatchResult = { acked: [], rejected: [], applied: 0, skippedStale: 0 };
  try {
    await db.query("BEGIN");
    if (batch.reference) await applyReference(db, batch.reference);
    for (const t of batch.tickets) {
      await db.query("SAVEPOINT one_ticket");
      try {
        const outcome = await applyTicket(db, t);
        await db.query("RELEASE SAVEPOINT one_ticket");
        if (outcome === "stale") result.skippedStale += 1;
        else result.applied += 1;
        result.acked.push({ ticket_id: t.ticket_id, seq: t.last_event_seq });
      } catch (err) {
        await db.query("ROLLBACK TO SAVEPOINT one_ticket");
        const reason = err instanceof Reject ? err.reason : "apply_failed";
        await db.query(`INSERT INTO sync_errors (ticket_id, reason, payload) VALUES ($1,$2,$3)`, [
          t.ticket_id, reason, JSON.stringify({ public_code: t.public_code, tenant_id: t.tenant_id, detail: err instanceof Reject ? undefined : String((err as Error).message).slice(0, 300) }),
        ]);
        result.rejected.push({ ticket_id: t.ticket_id, reason });
      }
    }
    await db.query(`UPDATE sync_state SET last_batch_at = now() WHERE id = 1`);
    await db.query("COMMIT");
    return result;
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    db.release();
  }
}
