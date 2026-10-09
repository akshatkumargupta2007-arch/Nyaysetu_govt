// Deterministic demo dataset for tests: 12 complaints across Bhilai (CG) and Bengaluru (KA).
// Hand-checkable numbers (used by the KPI and group tests):
//   total 12 | Bhilai 8, Bengaluru 4 | closed (CONFIRMED/UNCONFIRMED) 3 | awaiting citizen 2 | reopened 1
import type pg from "pg";
import { seedGeo } from "../db/seed.js";
import { maskPhone, sealPhone } from "../lib/phone-seal.js";

export const BASE = new Date("2026-10-01T06:00:00Z");
const h = (hours: number) => new Date(BASE.getTime() + hours * 3_600_000);

export type FixtureRow = {
  n: number; city: "cg.bhilai" | "ka.bengaluru"; area: string | null; dept: string; cat: string; l1: string; status: string;
  band: string; ageH: number; lng: number; lat: number; phone: string; escalation?: number; reports?: number;
  closeStatus?: string | null; reopen?: number; resolvedAfterH?: number; closedAfterH?: number; slaH?: number;
};

export const ROWS: FixtureRow[] = [
  { n: 1, city: "cg.bhilai", area: "cg.bhilai.ward.14", dept: "cg.bhilai.bmc", cat: "STREETLIGHT_AREA_DARK", l1: "STREETLIGHTS", status: "ASSIGNED", band: "High", ageH: 1, lng: 81.3224, lat: 21.1818, phone: "9876543221", slaH: 48 },
  { n: 2, city: "cg.bhilai", area: "cg.bhilai.ward.14", dept: "cg.bhilai.bmc", cat: "SW_UNCOLLECTED", l1: "SOLID_WASTE", status: "DISPATCHED", band: "Medium", ageH: 2, lng: 81.3231, lat: 21.1822, phone: "9876543222", slaH: 24 },
  { n: 3, city: "cg.bhilai", area: "cg.bhilai.ward.14", dept: "cg.bhilai.bmc", cat: "WATER_NO_SUPPLY", l1: "WATER_SUPPLY", status: "WORK_DONE_PENDING_CONFIRMATION", band: "High", ageH: 3, lng: 81.3219, lat: 21.1811, phone: "9876543223", resolvedAfterH: 20, slaH: 48 },
  { n: 4, city: "cg.bhilai", area: "cg.bhilai.sector.9", dept: "cg.bhilai.bsp_town", cat: "ROAD_POTHOLE", l1: "ROADS_FOOTPATHS", status: "WORK_DONE_PENDING_CONFIRMATION", band: "Low", ageH: 4, lng: 81.3765, lat: 21.2113, phone: "9876543224", resolvedAfterH: 30, slaH: 96, closeStatus: "requested" },
  { n: 5, city: "cg.bhilai", area: "cg.bhilai.sector.9", dept: "cg.bhilai.bsp_town", cat: "STREETLIGHT_AREA_DARK", l1: "STREETLIGHTS", status: "CLOSED_CONFIRMED", band: "Medium", ageH: 5, lng: 81.3772, lat: 21.2109, phone: "9876543225", resolvedAfterH: 10, closedAfterH: 12, slaH: 48, closeStatus: "confirmed" },
  { n: 6, city: "cg.bhilai", area: "cg.bhilai.ward.14", dept: "cg.bhilai.bmc", cat: "SW_UNCOLLECTED", l1: "SOLID_WASTE", status: "CLOSED_UNCONFIRMED", band: "Low", ageH: 6, lng: 81.3228, lat: 21.1819, phone: "9876543226", resolvedAfterH: 26, closedAfterH: 200, slaH: 24, closeStatus: "unconfirmed" },
  { n: 7, city: "cg.bhilai", area: null, dept: "cg.bhilai.bmc", cat: "WATER_NO_SUPPLY", l1: "WATER_SUPPLY", status: "REOPENED", band: "High", ageH: 7, lng: 81.34, lat: 21.19, phone: "9876543227", escalation: 1, reopen: 1, resolvedAfterH: 15, slaH: 48, closeStatus: "reopened" },
  { n: 8, city: "cg.bhilai", area: "cg.bhilai.ward.14", dept: "cg.bhilai.bmc", cat: "ROAD_POTHOLE", l1: "ROADS_FOOTPATHS", status: "SUBMITTED", band: "Medium", ageH: 8, lng: 81.3225, lat: 21.1815, phone: "9876543228", reports: 3, slaH: 96 },
  { n: 9, city: "ka.bengaluru", area: null, dept: "ka.bengaluru.bbmp", cat: "ROAD_POTHOLE", l1: "ROADS_FOOTPATHS", status: "ASSIGNED", band: "High", ageH: 9, lng: 77.5946, lat: 12.9716, phone: "9876543229", slaH: 96 },
  { n: 10, city: "ka.bengaluru", area: null, dept: "ka.bengaluru.bbmp", cat: "SW_UNCOLLECTED", l1: "SOLID_WASTE", status: "WORK_DONE_PENDING_CONFIRMATION", band: "Medium", ageH: 10, lng: 77.6, lat: 12.98, phone: "9876543230", resolvedAfterH: 12, slaH: 24 },
  { n: 11, city: "ka.bengaluru", area: null, dept: "ka.bengaluru.bbmp", cat: "STREETLIGHT_AREA_DARK", l1: "STREETLIGHTS", status: "CLOSED_CONFIRMED", band: "Low", ageH: 11, lng: 77.59, lat: 12.96, phone: "9876543231", resolvedAfterH: 8, closedAfterH: 9, slaH: 48, closeStatus: "confirmed" },
  { n: 12, city: "ka.bengaluru", area: null, dept: "ka.bengaluru.bbmp", cat: "WATER_NO_SUPPLY", l1: "WATER_SUPPLY", status: "DISPATCHED", band: "High", ageH: 12, lng: 77.61, lat: 12.95, phone: "9876543232", slaH: 24 },
];

export const ticketId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const codeOf = (r: FixtureRow) => `${r.city === "cg.bhilai" ? "BHI" : "BLR"}-26-${String(1000 + r.n).padStart(6, "0")}`;

/** A small square (about 1.1 km) around a point, as a MultiPolygon in WKT. */
const box = (lng: number, lat: number, d = 0.006) =>
  `MULTIPOLYGON(((${lng - d} ${lat - d}, ${lng + d} ${lat - d}, ${lng + d} ${lat + d}, ${lng - d} ${lat + d}, ${lng - d} ${lat - d})))`;

export async function loadFixtures(db: pg.Pool): Promise<void> {
  await seedGeo(db);
  await db.query("TRUNCATE complaint_events, complaint_reporters, close_requests, complaints, geo_areas, categories, departments CASCADE");
  for (const [id, city, kind, en, hi, lng, lat, approx] of [
    ["cg.bhilai.ward.14", "cg.bhilai", "ward", "Ward 14 (Supela)", "वार्ड 14 (सुपेला)", 81.3224, 21.1818, true],
    ["cg.bhilai.sector.9", "cg.bhilai", "sector", "Sector 9 (BSP Township)", "सेक्टर 9 (बीएसपी टाउनशिप)", 81.3768, 21.211, true],
  ] as const) {
    await db.query(
      `INSERT INTO geo_areas (id, city_id, kind, name, approximate, geom) VALUES ($1,$2,$3,$4,$5,ST_GeomFromText($6,4326))`,
      [id, city, kind, JSON.stringify({ en, hi }), approx, box(lng, lat)],
    );
  }
  for (const [id, en, hi] of [
    ["cg.bhilai.bmc", "Bhilai Municipal Corporation", "नगर निगम भिलाई"],
    ["cg.bhilai.bsp_town", "Bhilai Steel Plant: Town Services", "भिलाई इस्पात संयंत्र: नगर सेवा"],
    ["ka.bengaluru.bbmp", "Bengaluru civic body (placeholder)", "बेंगलुरु नागरिक निकाय (नमूना)"],
  ]) {
    await db.query(`INSERT INTO departments (id, agency_name, kind) VALUES ($1,$2,'ULB')`, [id, JSON.stringify({ en, hi })]);
  }
  for (const [code, l1, en, hi] of [
    ["STREETLIGHT_AREA_DARK", "STREETLIGHTS", "Area is dark", "इलाका अंधेरे में"],
    ["SW_UNCOLLECTED", "SOLID_WASTE", "Garbage uncollected", "कचरा नहीं उठा"],
    ["WATER_NO_SUPPLY", "WATER_SUPPLY", "No water supply", "पानी नहीं आ रहा"],
    ["ROAD_POTHOLE", "ROADS_FOOTPATHS", "Pothole", "सड़क पर गड्ढा"],
  ]) {
    await db.query(`INSERT INTO categories (code, l1, names) VALUES ($1,$2,$3)`, [code, l1, JSON.stringify({ en, hi })]);
  }

  const sealKey = process.env.GOV_PHONE_SEAL_PUBLIC_KEY!;
  for (const r of ROWS) {
    const created = h(r.ageH * -1 - 100);
    const stateCode = r.city === "cg.bhilai" ? "CG" : "KA";
    const district = r.city === "cg.bhilai" ? "CG.DURG" : "KA.BENGALURU_URBAN";
    const resolved = r.resolvedAfterH != null ? new Date(created.getTime() + r.resolvedAfterH * 3_600_000) : null;
    const closed = r.closedAfterH != null ? new Date(created.getTime() + r.closedAfterH * 3_600_000) : null;
    const tid = ticketId(r.n);
    await db.query(
      `INSERT INTO complaints (ticket_id, public_code, state_code, district_id, city_id, area_id, department_id, category_code, category_l1,
         status, priority_band, escalation_level, report_count, summary_en, original_text, original_lang, geom, h3_r9, phone_masked, phone_cipher,
         sla_due_at, created_at, resolved_at, closed_at, close_request_status, close_requested_at, close_requested_by, reopen_count, source_event_seq)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,ST_SetSRID(ST_MakePoint($17,$18),4326),$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)`,
      [tid, codeOf(r), stateCode, district, r.city, r.area, r.dept, r.cat, r.l1, r.status, r.band, r.escalation ?? 0, r.reports ?? 1,
        `Fixture complaint ${r.n} (${r.cat})`, `fixture text ${r.n}`, "en", r.lng, r.lat, `h3-${r.n}`, maskPhone(r.phone), sealPhone(sealKey, r.phone),
        new Date(created.getTime() + (r.slaH ?? 48) * 3_600_000), created, resolved, closed, r.closeStatus ?? null,
        r.closeStatus ? new Date(created.getTime() + 40 * 3_600_000) : null, r.closeStatus ? "t.admin" : null, r.reopen ?? 0, 5],
    );
    await db.query(
      `INSERT INTO complaint_reporters (ticket_id, report_id, phone_masked, phone_cipher, phone_last4, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [tid, tid, maskPhone(r.phone), sealPhone(sealKey, r.phone), r.phone.slice(-4), created],
    );
    await db.query(
      `INSERT INTO complaint_events (ticket_id, seq, type, from_state, to_state, actor_type, created_at) VALUES ($1,1,'REPORT_RECEIVED',NULL,'SUBMITTED','CITIZEN',$2),($1,2,'STATE_CHANGED','SUBMITTED',$3,'SYSTEM',$2)`,
      [tid, created, r.status],
    );
  }
}
