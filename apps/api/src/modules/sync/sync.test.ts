import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { pool } from "../../db/client.js";
import { seedGeo } from "../../db/seed.js";
import { buildSyncApp, SYNC_PATH, type SyncApp } from "./routes.js";
import { bodySha256, signRequest } from "../../lib/signing.js";
import { openSealedPhone, sealPhone } from "../../lib/phone-seal.js";

const SYNC_PRIV = process.env.TEST_SYNC_SIGNING_PRIVATE_KEY!;
const SEAL_PUB = process.env.GOV_PHONE_SEAL_PUBLIC_KEY!;
const SEAL_PRIV = process.env.GOV_PHONE_SEAL_PRIVATE_KEY!;
let app: SyncApp;

const TID = "10000000-0000-4000-8000-000000000001";
const TID2 = "10000000-0000-4000-8000-000000000002";
const R1 = "20000000-0000-4000-8000-000000000001";
const iso = (h: number) => new Date(Date.UTC(2026, 9, 1, h)).toISOString();

const ev = (seq: number, type: string, to: string | null, from: string | null = null, payload?: Record<string, unknown>) => ({
  seq, type, from_state: from, to_state: to, actor_type: "SYSTEM", payload, created_at: iso(seq),
});

function ticket(over: Record<string, unknown> = {}) {
  return {
    ticket_id: TID, public_code: "BHI-26-777001", tenant_id: "cg.bhilai", boundary_id: "cg.bhilai.ward.14", agency_id: "cg.bhilai.bmc",
    department: { en: "Streetlights", hi: "स्ट्रीट लाइट" }, category_code: "STREETLIGHT_AREA_DARK", category_l1: "STREETLIGHTS",
    state: "ASSIGNED", priority_band: "High", escalation_level: 0, report_count: 1, summary_officer_en: "Streetlight out near the park",
    original_text: "बत्ती नहीं जल रही", original_lang: "hi", lat: 21.1818, lng: 81.3224, h3_r9: "89abc",
    phone_masked: "98XXXXXX21", phone_cipher: sealPhone(SEAL_PUB, "9876543221"),
    reporters: [{ report_id: R1, phone_masked: "98XXXXXX21", phone_last4: "3221", phone_cipher: sealPhone(SEAL_PUB, "9876543221"), created_at: iso(1) }],
    sla_due_at: iso(60), created_at: iso(1), resolved_at: null, closed_at: null,
    events: [ev(1, "REPORT_CREATED", "SUBMITTED"), ev(2, "STATE_CHANGED", "ASSIGNED", "SUBMITTED")], last_event_seq: 2,
    ...over,
  };
}

const send = (body: unknown, opts: { headers?: Record<string, string>; key?: string; raw?: string } = {}) => {
  const raw = opts.raw ?? JSON.stringify(body);
  const headers = { "content-type": "application/json", ...signRequest(opts.key ?? SYNC_PRIV, "POST", SYNC_PATH, raw), ...opts.headers };
  return app.inject({ method: "POST", url: SYNC_PATH, headers, payload: raw });
};
const row = async (id = TID) => (await pool.query("SELECT * FROM complaints WHERE ticket_id = $1", [id])).rows[0];

beforeAll(async () => {
  app = await buildSyncApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
beforeEach(async () => {
  await pool.query("TRUNCATE complaint_events, complaint_reporters, close_requests, complaints, geo_areas, sync_errors, sync_nonces CASCADE");
  await seedGeo(pool);
  await pool.query(`INSERT INTO geo_areas (id, city_id, kind, name, geom) VALUES ('cg.bhilai.ward.14','cg.bhilai','ward','{"en":"Ward 14"}',
    ST_GeomFromText('MULTIPOLYGON(((81.31 21.17,81.33 21.17,81.33 21.19,81.31 21.19,81.31 21.17)))',4326))`);
});

describe("GA5 signature, clock and replay (Bible test 5)", () => {
  it("accepts a correctly signed batch", async () => {
    const res = await send({ tickets: [ticket()] });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ applied: 1, acked: [{ ticket_id: TID, seq: 2 }], rejected: [] });
  });

  it("rejects a batch signed with the wrong key", async () => {
    const other = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
    const res = await send({ tickets: [ticket()] }, { key: other });
    expect(res.statusCode).toBe(401);
    expect(await row()).toBeUndefined();
  });

  it("rejects a body changed after it was signed", async () => {
    const body = JSON.stringify({ tickets: [ticket()] });
    const headers = { "content-type": "application/json", ...signRequest(SYNC_PRIV, "POST", SYNC_PATH, body) };
    const res = await app.inject({ method: "POST", url: SYNC_PATH, headers, payload: body.replace("High", "Low") });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a request with no signature headers", async () => {
    const res = await app.inject({ method: "POST", url: SYNC_PATH, headers: { "content-type": "application/json" }, payload: JSON.stringify({ tickets: [] }) });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a replay of a valid request (same nonce)", async () => {
    const raw = JSON.stringify({ tickets: [ticket()] });
    const headers = { "content-type": "application/json", ...signRequest(SYNC_PRIV, "POST", SYNC_PATH, raw) };
    expect((await app.inject({ method: "POST", url: SYNC_PATH, headers, payload: raw })).statusCode).toBe(200);
    const again = await app.inject({ method: "POST", url: SYNC_PATH, headers, payload: raw });
    expect(again.statusCode).toBe(401);
    expect(again.json().code).toBe("REPLAY");
  });

  it("rejects a stale timestamp (older than 60 s)", async () => {
    const raw = JSON.stringify({ tickets: [ticket()] });
    const headers = { "content-type": "application/json", ...signRequest(SYNC_PRIV, "POST", SYNC_PATH, raw, Date.now() - 5 * 60_000) };
    const res = await app.inject({ method: "POST", url: SYNC_PATH, headers, payload: raw });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("STALE");
  });

  it("the signature is bound to the path (a signature for another path is useless)", async () => {
    const raw = JSON.stringify({ tickets: [ticket()] });
    const headers = { "content-type": "application/json", ...signRequest(SYNC_PRIV, "POST", "/somewhere/else", raw) };
    expect((await app.inject({ method: "POST", url: SYNC_PATH, headers, payload: raw })).statusCode).toBe(401);
  });

  it("rejects malformed batches with 400 (after the signature is checked)", async () => {
    const res = await send({ tickets: [{ ticket_id: "not-a-uuid" }] });
    expect(res.statusCode).toBe(400);
    expect(bodySha256("x")).toHaveLength(64);
  });
});

describe("GA5 mapping and idempotency", () => {
  it("maps tenant -> city -> district -> state and the boundary -> area", async () => {
    await send({ tickets: [ticket()] });
    expect(await row()).toMatchObject({
      public_code: "BHI-26-777001", city_id: "cg.bhilai", district_id: "CG.DURG", state_code: "CG", area_id: "cg.bhilai.ward.14",
      department_id: "cg.bhilai.bmc", status: "ASSIGNED", source_event_seq: 2, category_l1: "STREETLIGHTS",
    });
    const ev = await pool.query("SELECT count(*)::int AS n FROM complaint_events WHERE ticket_id = $1", [TID]);
    expect(ev.rows[0].n).toBe(2);
  });

  it("stores the phone sealed: only the gov private key reads it, and it matches the mask", async () => {
    await send({ tickets: [ticket()] });
    const r = await row();
    expect(r.phone_masked).toBe("98XXXXXX21");
    expect(r.phone_cipher).not.toContain("9876543221");
    expect(openSealedPhone(SEAL_PRIV, r.phone_cipher)).toBe("9876543221");
    const rep = await pool.query("SELECT phone_last4 FROM complaint_reporters WHERE ticket_id = $1", [TID]);
    expect(rep.rows[0].phone_last4).toBe("3221");
  });

  it("a newer sequence updates the ticket", async () => {
    await send({ tickets: [ticket()] });
    await send({ tickets: [ticket({ state: "DISPATCHED", last_event_seq: 3, events: [ev(3, "STATE_CHANGED", "DISPATCHED", "ASSIGNED")] })] });
    expect((await row()).status).toBe("DISPATCHED");
    expect((await row()).source_event_seq).toBe(3);
  });

  it("an OLDER sequence arriving late is ignored (out of order)", async () => {
    await send({ tickets: [ticket({ state: "DISPATCHED", last_event_seq: 5, events: [ev(5, "STATE_CHANGED", "DISPATCHED", "ASSIGNED")] })] });
    const late = await send({ tickets: [ticket({ state: "ASSIGNED", last_event_seq: 2 })] });
    expect(late.json()).toMatchObject({ applied: 0, skippedStale: 1 });
    expect((await row()).status).toBe("DISPATCHED");
  });

  it("re-sending the same data changes nothing (idempotent)", async () => {
    const batch = { tickets: [ticket()] };
    await send(batch);
    const second = await send(batch);
    expect(second.json()).toMatchObject({ applied: 0, skippedStale: 1 });
    const n = await pool.query("SELECT count(*)::int AS n FROM complaints");
    expect(n.rows[0].n).toBe(1);
  });

  it("an unknown tenant is recorded in sync_errors and does not break the rest of the batch", async () => {
    const res = await send({ tickets: [ticket({ ticket_id: TID2, public_code: "XYZ-26-000001", tenant_id: "zz.nowhere" }), ticket()] });
    const body = res.json();
    expect(body.rejected).toEqual([{ ticket_id: TID2, reason: "unknown_tenant:zz.nowhere" }]);
    expect(body.acked.map((a: { ticket_id: string }) => a.ticket_id)).toEqual([TID]);
    expect((await pool.query("SELECT count(*)::int AS n FROM sync_errors")).rows[0].n).toBe(1);
    expect(await row(TID2)).toBeUndefined();
  });

  it("phone erasure (null cipher, 180 days after closure) propagates", async () => {
    await send({ tickets: [ticket()] });
    await send({ tickets: [ticket({ phone_masked: null, phone_cipher: null, reporters: [{ report_id: R1, phone_masked: null, phone_cipher: null, created_at: iso(1) }], last_event_seq: 9, events: [ev(9, "PHONE_ERASED", null)] })] });
    const r = await row();
    expect(r.phone_masked).toBeNull();
    expect(r.phone_cipher).toBeNull();
    expect((await pool.query("SELECT phone_cipher, phone_last4 FROM complaint_reporters WHERE ticket_id = $1", [TID])).rows[0]).toEqual({ phone_cipher: null, phone_last4: null });
  });

  it("reference data: categories, agencies and boundaries are upserted", async () => {
    const res = await send({
      reference: {
        categories: [{ code: "STREETLIGHT_AREA_DARK", l1: "STREETLIGHTS", names: { en: "Area is dark", hi: "इलाका अंधेरे में" } }],
        agencies: [{ id: "cg.bhilai.bmc", name: { en: "Bhilai Municipal Corporation", hi: "नगर निगम भिलाई" }, kind: "ULB" }],
        boundaries: [
          { id: "cg.bhilai.sector.9", tenant_id: "cg.bhilai", kind: "sector", name: { en: "Sector 9" }, approximate: true, geometry: { type: "MultiPolygon", coordinates: [[[[81.37, 21.2], [81.38, 21.2], [81.38, 21.22], [81.37, 21.22], [81.37, 21.2]]]] } },
          { id: "cg.bhilai.city", tenant_id: "cg.bhilai", kind: "city", name: { en: "Bhilai" }, approximate: true, geometry: { type: "MultiPolygon", coordinates: [[[[81, 21], [82, 21], [82, 22], [81, 22], [81, 21]]]] } },
        ],
      },
      tickets: [],
    });
    expect(res.statusCode).toBe(200);
    expect((await pool.query("SELECT approximate FROM geo_areas WHERE id = 'cg.bhilai.sector.9'")).rows[0]).toEqual({ approximate: true });
    expect((await pool.query("SELECT count(*)::int AS n FROM geo_areas WHERE id = 'cg.bhilai.city'")).rows[0].n).toBe(0); // the city outline is not an area
    expect((await pool.query("SELECT agency_name FROM departments WHERE id = 'cg.bhilai.bmc'")).rows[0].agency_name.en).toBe("Bhilai Municipal Corporation");
  });
});

describe("GA5 close-request status is derived from the event history", () => {
  const base = [ev(1, "REPORT_CREATED", "SUBMITTED"), ev(2, "STATE_CHANGED", "WORK_DONE_PENDING_CONFIRMATION", "DISPATCHED")];
  const request = ev(3, "CLOSE_REQUESTED_BY_GOV", null, null, { note: "Work finished", gov_user_name: "Officer A" });

  it("requested", async () => {
    await send({ tickets: [ticket({ state: "WORK_DONE_PENDING_CONFIRMATION", events: [...base, request], last_event_seq: 3 })] });
    expect(await row()).toMatchObject({ close_request_status: "requested", close_requested_by: "Officer A", close_request_note: "Work finished" });
  });
  it("confirmed by the citizen", async () => {
    await send({ tickets: [ticket({ state: "CLOSED_CONFIRMED", events: [...base, request, ev(4, "CITIZEN_CONFIRMED", null), ev(5, "STATE_CHANGED", "CLOSED_CONFIRMED", "WORK_DONE_PENDING_CONFIRMATION")], last_event_seq: 5 })] });
    expect(await row()).toMatchObject({ close_request_status: "confirmed", reopen_count: 0 });
  });
  it("reopened by the citizen (same ticket, reopen_count 1)", async () => {
    await send({ tickets: [ticket({ state: "REOPENED", escalation_level: 1, events: [...base, request, ev(4, "CITIZEN_REJECTED", null), ev(5, "STATE_CHANGED", "REOPENED", "WORK_DONE_PENDING_CONFIRMATION")], last_event_seq: 5 })] });
    expect(await row()).toMatchObject({ close_request_status: "reopened", reopen_count: 1, escalation_level: 1 });
  });
  it("unconfirmed after the 7-day timeout", async () => {
    await send({ tickets: [ticket({ state: "CLOSED_UNCONFIRMED", events: [...base, request, ev(4, "STATE_CHANGED", "CLOSED_UNCONFIRMED", "WORK_DONE_PENDING_CONFIRMATION")], last_event_seq: 4 })] });
    expect((await row()).close_request_status).toBe("unconfirmed");
  });
  it("a citizen confirming with no gov request leaves it null", async () => {
    await send({ tickets: [ticket({ state: "CLOSED_CONFIRMED", events: [...base, ev(4, "CITIZEN_CONFIRMED", null), ev(5, "STATE_CHANGED", "CLOSED_CONFIRMED", "WORK_DONE_PENDING_CONFIRMATION")], last_event_seq: 5 })] });
    expect((await row()).close_request_status).toBeNull();
  });
});
