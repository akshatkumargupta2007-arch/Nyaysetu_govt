import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, type App } from "../../app.js";
import { pool } from "../../db/client.js";
import { upsertUser } from "../../db/seed.js";
import { loadFixtures, ticketId } from "../../test/fixtures.js";

// The citizen stack is not running in these tests: its answers are faked. What is tested here is OUR side:
// who may ask, what is sent back, and what is written to the audit log.
vi.mock("../../lib/citizenMedia.js", async (orig) => ({ ...(await orig<typeof import("../../lib/citizenMedia.js")>()), listPhotos: vi.fn(), getPhoto: vi.fn() }));
import { getPhoto, listPhotos, MediaError } from "../../lib/citizenMedia.js";

const PW = "photo-test-password";
const MEDIA = "11111111-1111-4111-8111-111111111111";
const JPEG_B64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
let app: App;
const auth: Record<string, string> = {};

async function login(email: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", headers: { origin: "http://localhost:5174" }, payload: { email, password: PW } });
  expect(res.statusCode).toBe(200);
  return `Bearer ${res.json().accessToken}`;
}
const get = (url: string, who?: string) => app.inject({ method: "GET", url, headers: who ? { authorization: auth[who]! } : {} });

beforeAll(async () => {
  await loadFixtures(pool);
  await upsertUser(pool, { id: "t.nat", name: "National", email: "t.nat@test.local", role: "NATIONAL", password: PW, active: true });
  await upsertUser(pool, { id: "t.durg", name: "Durg", email: "t.durg@test.local", role: "DISTRICT", scopeDistrict: "CG.DURG", password: PW, active: true });
  app = await buildApp();
  await app.ready();
  auth.nat = await login("t.nat@test.local");
  auth.durg = await login("t.durg@test.local");
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
beforeEach(() => {
  vi.mocked(listPhotos).mockReset();
  vi.mocked(getPhoto).mockReset();
});

describe("citizen photos in the portal", () => {
  it("lists the photos of a complaint the official may see", async () => {
    vi.mocked(listPhotos).mockResolvedValue([{ id: MEDIA, kind: "before", at: "2026-10-10T03:30:47.000Z", available: true }]);
    const res = await get(`/api/complaints/${ticketId(1)}/photos`, "durg");
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([{ id: MEDIA, kind: "before", at: "2026-10-10T03:30:47.000Z", available: true }]);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(listPhotos).toHaveBeenCalledWith(ticketId(1));
  });

  it("answers 'not found' for a complaint outside the official's area, without asking the citizen app", async () => {
    const res = await get(`/api/complaints/${ticketId(9)}/photos`, "durg"); // a Bengaluru complaint
    expect(res.statusCode).toBe(404);
    expect(listPhotos).not.toHaveBeenCalled();
    const pic = await get(`/api/complaints/${ticketId(9)}/photos/${MEDIA}`, "durg");
    expect(pic.statusCode).toBe(404);
    expect(getPhoto).not.toHaveBeenCalled();
  });

  it("needs a signed-in official", async () => {
    expect((await get(`/api/complaints/${ticketId(1)}/photos`)).statusCode).toBe(401);
    expect((await get(`/api/complaints/${ticketId(1)}/photos/${MEDIA}`)).statusCode).toBe(401);
    expect(listPhotos).not.toHaveBeenCalled();
  });

  it("serves the picture with safe headers and writes one audit entry", async () => {
    vi.mocked(getPhoto).mockResolvedValue({ mime: "image/jpeg", data_base64: JPEG_B64 });
    const before = (await pool.query("SELECT count(*)::int AS n FROM gov_audit_log WHERE action = 'PHOTO_VIEW'")).rows[0].n;
    const res = await get(`/api/complaints/${ticketId(1)}/photos/${MEDIA}`, "nat");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.rawPayload.equals(Buffer.from(JPEG_B64, "base64"))).toBe(true);
    const rows = (await pool.query("SELECT user_id, target FROM gov_audit_log WHERE action = 'PHOTO_VIEW' ORDER BY id DESC LIMIT 1")).rows;
    expect(rows[0]).toEqual({ user_id: "t.nat", target: ticketId(1) });
    expect((await pool.query("SELECT count(*)::int AS n FROM gov_audit_log WHERE action = 'PHOTO_VIEW'")).rows[0].n).toBe(before + 1);
  });

  it("says so plainly when the photo was never stored, and writes nothing to the audit log", async () => {
    vi.mocked(getPhoto).mockRejectedValue(new MediaError(404, "NOT_STORED", "not stored"));
    const before = (await pool.query("SELECT count(*)::int AS n FROM gov_audit_log WHERE action = 'PHOTO_VIEW'")).rows[0].n;
    const res = await get(`/api/complaints/${ticketId(1)}/photos/${MEDIA}`, "nat");
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_STORED");
    expect((await pool.query("SELECT count(*)::int AS n FROM gov_audit_log WHERE action = 'PHOTO_VIEW'")).rows[0].n).toBe(before);
  });

  it("gives a clear error, not a crash, when the citizen app cannot be reached", async () => {
    vi.mocked(listPhotos).mockRejectedValue(new MediaError(502, "CITIZEN_UNREACHABLE", "down"));
    const res = await get(`/api/complaints/${ticketId(1)}/photos`, "nat");
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe("CITIZEN_UNREACHABLE");
  });
});
