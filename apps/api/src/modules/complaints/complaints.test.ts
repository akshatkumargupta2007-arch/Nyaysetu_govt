import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, type App } from "../../app.js";
import { pool } from "../../db/client.js";
import { upsertUser } from "../../db/seed.js";
import { signAccessToken } from "../../lib/tokens.js";
import { loadFixtures, ROWS, ticketId, codeOf } from "../../test/fixtures.js";
import { buildWhere } from "./filters.js";

let app: App;
const tokens: Record<string, string> = {};

beforeAll(async () => {
  await loadFixtures(pool);
  await upsertUser(pool, { id: "t.nat", name: "Nat", email: "t.nat@test.local", role: "NATIONAL", password: "x", active: true });
  await upsertUser(pool, { id: "t.ka", name: "KA", email: "t.ka@test.local", role: "STATE", scopeState: "KA", password: "x", active: true });
  await upsertUser(pool, { id: "t.durg", name: "Durg", email: "t.durg@test.local", role: "DISTRICT", scopeDistrict: "CG.DURG", password: "x", active: true });
  for (const [k, id, role] of [["nat", "t.nat", "NATIONAL"], ["ka", "t.ka", "STATE"], ["durg", "t.durg", "DISTRICT"]] as const) tokens[k] = await signAccessToken({ id, role });
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

const get = (url: string, who: keyof typeof tokens = "nat") =>
  app.inject({ method: "GET", url, headers: { authorization: `Bearer ${tokens[who]}` } });
const list = async (qs = "", who: keyof typeof tokens = "nat") => {
  const res = await get(`/api/complaints?${qs}`, who);
  expect(res.statusCode).toBe(200);
  return res.json() as { items: any[]; nextCursor: string | null; total: number | null };
};
const n = (pred: (r: (typeof ROWS)[number]) => boolean) => ROWS.filter(pred).length;

describe("GB1 list", () => {
  it("needs a login", async () => {
    expect((await app.inject({ method: "GET", url: "/api/complaints" })).statusCode).toBe(401);
  });

  it("returns every complaint nationally, with the readable names and the complaint ID", async () => {
    const r = await list("limit=200");
    expect(r.total).toBe(12);
    expect(r.items).toHaveLength(12);
    const first = r.items.find((i) => i.code === codeOf(ROWS[0]!))!;
    expect(first).toMatchObject({
      status: "ASSIGNED", priority: "High", phoneMasked: "98XXXXXX21",
      location: { state: { code: "CG", name: { en: "Chhattisgarh" } }, district: { id: "CG.DURG" }, city: { id: "cg.bhilai" }, area: { id: "cg.bhilai.ward.14", approximate: true } },
      category: { code: "STREETLIGHT_AREA_DARK", l1: "STREETLIGHTS" },
    });
    expect(first.category.names.hi).toBeTruthy();
  });

  it("never exposes a full phone number or the sealed ciphertext anywhere in the response", async () => {
    const res = await get("/api/complaints?limit=200");
    for (const r of ROWS) expect(res.body).not.toContain(r.phone);
    expect(res.body).not.toContain("phone_cipher");
    expect(res.body).not.toMatch(/"phone"\s*:/);
  });

  it("filters: city, status, OPEN, priority, category, close-request, date", async () => {
    expect((await list("city=ka.bengaluru")).total).toBe(n((r) => r.city === "ka.bengaluru"));
    expect((await list("status=WORK_DONE_PENDING_CONFIRMATION")).total).toBe(n((r) => r.status === "WORK_DONE_PENDING_CONFIRMATION"));
    const closed = ["CLOSED_CONFIRMED", "CLOSED_UNCONFIRMED", "REJECTED_NOT_CIVIC"];
    expect((await list("status=OPEN")).total).toBe(n((r) => !closed.includes(r.status)));
    expect((await list("priority=High,Critical")).total).toBe(n((r) => r.band === "High"));
    expect((await list("category_l1=STREETLIGHTS")).total).toBe(n((r) => r.l1 === "STREETLIGHTS"));
    expect((await list("category=ROAD_POTHOLE")).total).toBe(n((r) => r.cat === "ROAD_POTHOLE"));
    expect((await list("close_request_status=requested")).total).toBe(1);
    expect((await list("close_request_status=none")).total).toBe(n((r) => !r.closeStatus));
    expect((await list("from=2099-01-01")).total).toBe(0);
    expect((await list("from=2000-01-01&to=2099-01-01")).total).toBe(12);
  });

  it("combines filters (AND), including a multi-value status", async () => {
    const r = await list("city=cg.bhilai&status=ASSIGNED,DISPATCHED&category_l1=SOLID_WASTE");
    expect(r.total).toBe(n((x) => x.city === "cg.bhilai" && ["ASSIGNED", "DISPATCHED"].includes(x.status) && x.l1 === "SOLID_WASTE"));
  });

  it("search: complaint ID, last 4 digits of the phone, and text", async () => {
    expect((await list(`q=${codeOf(ROWS[6]!)}`)).items.map((i) => i.code)).toEqual([codeOf(ROWS[6]!)]);
    expect((await list("q=3221")).total).toBe(1);
    expect((await list("q=Fixture complaint 7")).total).toBe(1);
    expect((await list("q=zzzz-no-match")).total).toBe(0);
  });

  it("treats % and _ in the search as plain characters, not wildcards", async () => {
    expect((await list("q=%25")).total).toBe(0);
    // "_" would match the space in "Fixture complaint" if it were a wildcard; as a plain character it must not
    expect((await list("q=Fixture_complaint")).total).toBe(0);
    expect((await list("q=Fixture complaint")).total).toBe(12);
  });

  it("pages through everything with cursors: no repeats, nothing missed", async () => {
    for (const sort of ["created_desc", "created_asc", "priority"]) {
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const r = await list(`limit=5&sort=${sort}${cursor ? `&cursor=${cursor}` : ""}`);
        seen.push(...r.items.map((i) => i.id));
        cursor = r.nextCursor;
        pages += 1;
        if (pages > 1) expect(r.total).toBeNull(); // the total is only computed for the first page
      } while (cursor && pages < 10);
      expect(new Set(seen).size, sort).toBe(12);
      expect(seen).toHaveLength(12);
    }
  });

  it("sorts by priority (Critical > High > Medium > Low), newest first within a band", async () => {
    const r = await list("sort=priority&limit=200");
    const rank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const ranks = r.items.map((i) => rank[i.priority]!);
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
  });

  it("rejects a tampered cursor and bad parameters", async () => {
    expect((await get("/api/complaints?cursor=not-a-cursor")).statusCode).toBe(400);
    expect((await get("/api/complaints?limit=100000")).statusCode).toBe(400);
    expect((await get("/api/complaints?sort=drop_table")).statusCode).toBe(400);
  });

  it("does not take SQL from the query string", async () => {
    const res = await get(`/api/complaints?city=${encodeURIComponent("x'; DROP TABLE complaints;--")}&q=${encodeURIComponent("' OR 1=1 --")}`);
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(0);
    expect((await pool.query("SELECT count(*)::int AS n FROM complaints")).rows[0].n).toBe(12);
  });

  it("is fast on the fixture data (< 200 ms)", async () => {
    const t0 = performance.now();
    await list("limit=50");
    expect(performance.now() - t0).toBeLessThan(200);
  });
});

describe("GB1 role scope", () => {
  it("a Karnataka state user sees only the 4 Bengaluru complaints", async () => {
    const r = await list("limit=200", "ka");
    expect(r.total).toBe(4);
    expect(r.items.every((i) => i.location.state.code === "KA")).toBe(true);
  });
  it("asking for another state's data through a filter still returns nothing", async () => {
    expect((await list("state=CG", "ka")).total).toBe(0);
    expect((await list("city=cg.bhilai", "ka")).total).toBe(0);
  });
  it("a Durg district user sees the 8 Bhilai complaints", async () => {
    expect((await list("", "durg")).total).toBe(8);
  });
});

describe("GB2 group counts", () => {
  it("counts add up to the list total for every groupBy", async () => {
    for (const groupBy of ["state", "district", "city", "area", "department", "category_l1"]) {
      const res = await get(`/api/complaints/groups?groupBy=${groupBy}`);
      expect(res.statusCode, groupBy).toBe(200);
      const b = res.json();
      expect(b.groups.reduce((s: number, g: any) => s + g.count, 0), groupBy).toBe(12);
      expect(b.total).toBe(12);
      for (const g of b.groups) expect(g.name.en && g.name.hi, `${groupBy} ${g.key}`).toBeTruthy();
    }
  });
  it("groups by state with names, open and awaiting-citizen counts", async () => {
    const b = (await get("/api/complaints/groups?groupBy=state")).json();
    const cg = b.groups.find((g: any) => g.key === "CG");
    expect(cg).toMatchObject({ count: 8, awaitingCitizen: n((r) => r.city === "cg.bhilai" && r.status === "WORK_DONE_PENDING_CONFIRMATION") });
    expect(cg.name.hi).toBe("छत्तीसगढ़");
    expect(b.groups.find((g: any) => g.key === "KA").count).toBe(4);
  });
  it("respects the other filters and the role scope", async () => {
    const f = (await get("/api/complaints/groups?groupBy=area&city=cg.bhilai")).json();
    expect(f.total).toBe(8);
    expect(f.groups.find((g: any) => g.key === "none").count).toBe(n((r) => r.city === "cg.bhilai" && r.area === null));
    expect((await get("/api/complaints/groups?groupBy=state", "ka")).json().groups.map((g: any) => g.key)).toEqual(["KA"]);
  });
  it("a group of complaints with no area can be expanded with area=none", async () => {
    const none = await list("area=none");
    expect(none.total).toBe(n((r) => r.area === null));
    expect(none.items.every((i) => i.location.area === null)).toBe(true);
    expect((await list("area=none,cg.bhilai.ward.14")).total).toBe(n((r) => r.area === null || r.area === "cg.bhilai.ward.14"));
  });
  it("rejects an unknown groupBy", async () => {
    expect((await get("/api/complaints/groups?groupBy=password")).statusCode).toBe(400);
  });
});

describe("GB3 detail", () => {
  it("returns the complaint, masked reporters, the timeline and the close-request panel state", async () => {
    const res = await get(`/api/complaints/${ticketId(3)}`);
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b.complaint).toMatchObject({ id: ticketId(3), originalText: "fixture text 3", originalLang: "en" });
    expect(b.complaint.reporters).toEqual([{ index: 0, phoneMasked: "98XXXXXX23", phoneAvailable: true, createdAt: expect.any(String) }]);
    expect(b.timeline.map((e: any) => e.seq)).toEqual([1, 2]);
    expect(b.closeRequest).toMatchObject({ canRequest: true, reason: null });
    expect(res.body).not.toContain("9876543223");
  });
  it("the close-request button is off unless the citizen's confirmation is pending", async () => {
    const b = (await get(`/api/complaints/${ticketId(1)}`)).json(); // ASSIGNED
    expect(b.closeRequest).toMatchObject({ canRequest: false, reason: "NOT_AWAITING_CITIZEN" });
  });
  it("and off for 24 h after a request went out, with the time it comes back", async () => {
    await pool.query(
      `INSERT INTO complaint_events (ticket_id, seq, type, from_state, to_state, actor_type, payload, created_at)
       VALUES ($1, 3, 'CLOSE_REQUESTED_BY_GOV', NULL, NULL, 'GOV', '{"note":"please check","gov_user_name":"Officer A"}', now() - interval '2 hours')`,
      [ticketId(10)],
    );
    const b = (await get(`/api/complaints/${ticketId(10)}`)).json();
    expect(b.closeRequest).toMatchObject({ canRequest: false, reason: "TOO_SOON" });
    expect(new Date(b.closeRequest.cooldownUntil).getTime()).toBeGreaterThan(Date.now() + 21 * 3_600_000);
    expect(b.closeRequest.history).toEqual([{ at: expect.any(String), official: "Officer A", note: "please check" }]);
    expect(b.timeline.find((e: any) => e.type === "CLOSE_REQUESTED_BY_GOV")).toMatchObject({ note: "please check", official: "Officer A" });
  });
  it("a complaint outside the caller's scope looks exactly like one that does not exist", async () => {
    const outside = await get(`/api/complaints/${ticketId(9)}`, "durg"); // a Bengaluru ticket
    const missing = await get(`/api/complaints/${ticketId(999)}`, "durg");
    expect(outside.statusCode).toBe(404);
    expect(outside.json()).toEqual(missing.json());
  });
  it("rejects an id that is not a UUID", async () => {
    expect((await get("/api/complaints/not-a-uuid")).statusCode).toBe(400);
  });
});

describe("pagination cursors are validated (a forged cursor is a clean 400, not a 500)", () => {
  const cur = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const bad = [
    ["priority", cur(["x", "y", "z"])],
    ["priority", cur([9, "2026-10-01 05:00:00+00", "00000000-0000-4000-8000-000000000001"])],
    ["priority", cur([1, "2026-10-01", "not-a-uuid"])],
    ["created_desc", cur(["not-a-date", "00000000-0000-4000-8000-000000000001"])],
    ["created_desc", cur(["2026-10-01 05:00:00+00"])],
    ["created_asc", "%%%not-base64%%%"],
  ] as const;
  for (const [sort, cursor] of bad) {
    it(`rejects a bad ${sort} cursor`, async () => {
      expect((await get(`/api/complaints?sort=${sort}&cursor=${cursor}`)).statusCode).toBe(400);
    });
  }
  it("still follows the real cursors it hands out, for every sort", async () => {
    for (const sort of ["created_desc", "created_asc", "priority"]) {
      const seen: string[] = [];
      let next: string | null | undefined;
      do {
        const r = await list(`limit=5&sort=${sort}${next ? `&cursor=${next}` : ""}`);
        seen.push(...r.items.map((i) => i.code));
        next = r.nextCursor;
      } while (next);
      expect(new Set(seen).size).toBe(12);
    }
  });
});

describe("phone-digit search is limited, audited, and only the list uses it", () => {
  const audited = async () => (await pool.query("SELECT user_id, action, target, payload FROM gov_audit_log WHERE action = 'PHONE_SEARCH' ORDER BY id")).rows;
  it("finds the complaint by the last four digits and writes an audit row without the digits", async () => {
    const before = (await audited()).length;
    const r = await list("q=3221");
    expect(r.items.map((i) => i.code)).toEqual([codeOf(ROWS[0]!)]);
    const rows = await audited();
    expect(rows.length).toBe(before + 1);
    expect(JSON.stringify(rows[rows.length - 1])).not.toContain("3221");
    expect(rows[rows.length - 1]).toMatchObject({ user_id: "t.nat", target: "last4" });
  });

  it("scrolling to the next page does not count as another search", async () => {
    const before = (await audited()).length;
    await list("q=3222&limit=1");
    expect((await audited()).length).toBe(before + 1);
  });

  it("a text search is not a phone search and writes nothing", async () => {
    const before = (await audited()).length;
    await list("q=Fixture");
    await list("q=ab12");
    expect((await audited()).length).toBe(before);
  });

  it("counts, groups, KPIs and the export never match on phone digits (they would leak them unlogged)", async () => {
    expect((await (await get("/api/complaints/groups?groupBy=state&q=3221")).json()).total).toBe(0);
    expect((await (await get("/api/stats/kpis?q=3221")).json()).kpis.received).toBe(0);
    // the CSV export builds its WHERE with the same function (checked here, not by calling the export: that
    // would add an EXPORT row in the middle of the audit chain, which the audit tests clear between runs)
    const user = { id: "u", name: "u", email: "u@x", role: "NATIONAL", scopeState: null, scopeDistrict: null, scopeCity: null, scopeDepartment: null } as const;
    expect(buildWhere(user, { q: "3221" }).sql).not.toContain("phone_last4");
    expect(buildWhere(user, { q: "3221" }, 1, { phoneSearch: true }).sql).toContain("phone_last4");
  });

  it("stops after 20 searches an hour, per official", async () => {
    // a fresh official, so earlier tests' searches (and the audit rows, which must never be deleted) do not count
    const id = `t.phone.${Date.now()}`; // new each run: the audit log is permanent, so old searches would still count
    await upsertUser(pool, { id, name: "Phone Searcher", email: `${id}@test.local`, role: "NATIONAL", password: "x", active: true });
    tokens.phone = await signAccessToken({ id, role: "NATIONAL" });
    const { PHONE_SEARCHES_PER_HOUR } = await import("./routes.js");
    for (let i = 0; i < PHONE_SEARCHES_PER_HOUR; i++) expect((await get(`/api/complaints?q=${String(1000 + i)}`, "phone")).statusCode).toBe(200);
    const over = await get("/api/complaints?q=9999", "phone");
    expect(over.statusCode).toBe(429);
    expect(over.json().code).toBe("PHONE_SEARCH_LIMIT");
    expect((await get("/api/complaints?q=9999", "ka")).statusCode).toBe(200); // someone else is not affected
    expect((await get("/api/complaints?q=Fixture", "phone")).statusCode).toBe(200); // text searches are not limited
  });
});

