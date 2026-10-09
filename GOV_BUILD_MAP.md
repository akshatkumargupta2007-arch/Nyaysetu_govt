# NYAYSETU GOV — Build Map
### Companion to `GOVERNMENT_BIBLE.md`. The Bible says WHAT; this map says in WHICH SMALL STEPS.

**Version 1 — 2026-10-08.**

---

## How to use this map (agent: read first)

1. Work ticket by ticket. Each ticket is **small (≈10–25 min)**, **self-contained**, and ends with a **commit**. If you're interrupted, at most one ticket is lost.
2. Keep `NyaySetu_Gov/PROGRESS.md` updated. After every ticket, append one line:
   `- [x] GA2 — gov DB schema — commit abc123 — notes`
   Before starting a session, **read PROGRESS.md and continue from the first unchecked ticket whose dependencies are done.**
3. Commit message format: `GA2: gov DB schema + migrations` (ticket ID first).
4. A ticket is done only when its **Done when** check passes. If it can't pass, mark `- [~] GA2 — partial — <what's missing>`, commit, and move to the next independent ticket.
5. Tracks are mostly independent. **Deps** lists the only hard prerequisites. If a dependency is blocked, pick a ticket from another track.
6. Track prefixes:
   - **G0** setup (both)
   - **GA** gov backend core · **GB** gov API features · **GC** gov web · **GD** heat map
   - **CA** citizen-copy backend · **CB** citizen-copy web
   - **GX** integration, tests, handoff
7. Never touch `A:\Nyaysetu_main\NyaySetu_Full`. Citizen changes only in `NyaySetu_Full_v2`. Gov code in `NyaySetu_Gov`.

---

## Dependency picture (simplified)

```
G01 ─┬─ G02 (keys)
     ├─ GA1 → GA2 → GA3 ─┬─ GA4 (auth) ─┬─ GB1..GB7 ─┐
     │                   │              └─ GC1..GC7 ─┼─ GD1..GD5
     │                   └─ GA5 (sync receive) ──────┤
     └─ G03 (citizen copy) → CA1 → CA2 → CA3 → CA4 ──┤
                                    CA5..CA8, CB1..CB4┤
                                                      └─ GX1..GX5
```
Rule of thumb: **GA*, CA*, GC1–GC2 can progress in parallel**; the web only needs mocked JSON (GC0) until GB tickets land.

---

## G0 — Setup

### G01 — Scaffold `NyaySetu_Gov`
- **Do:** create `NyaySetu_Gov/` with npm workspaces `apps/api`, `apps/web`; `infra/db/Dockerfile` (`FROM postgis/postgis:17-3.5`, init SQL: postgis, pg_trgm); `data/geo/`; `scripts/`; `.gitignore` (`.env`, `node_modules`, `dist`); `PROGRESS.md`; `git init`.
- **Deps:** none.
- **Done when:** `git log` shows first commit; folder tree matches.

### G02 — Key generation script
- **Do:** `scripts/gen-keys.mjs` (Node `crypto.generateKeyPairSync('ed25519')` ×3 + `x25519` for phone sealing). Writes `NyaySetu_Gov/.env` (gov private keys + citizen-facing public keys) and prints a block to paste into `NyaySetu_Full_v2/.env` (or writes it if the folder exists). Also generates `GOV_ADMIN_PASSWORD`. `.env.example` for both with names only.
- **Deps:** G01.
- **Done when:** running it twice is safe (doesn't overwrite unless `--force`); both `.env` files contain all keys from Bible §8.

### G03 — Citizen copy
- **Do:** copy `NyaySetu_Full` → `NyaySetu_Full_v2` (exclude `node_modules`, `dist`, `.git` can be copied). `git init` there if absent; first commit "baseline copy". `npm install`; run existing tests once and record results in PROGRESS.md (baseline, so later failures are attributable).
- **Deps:** none.
- **Done when:** copy runs `docker compose up` (or `npm run dev`) the same as the original; baseline test result recorded.

---

## GA — Gov backend core

### GA1 — gov-api skeleton
- **Do:** Fastify 5 + TS + Zod type provider, `env.ts` (Zod), pino with redaction (`*.phone`, `*.phone_cipher`, `req.headers.authorization`, `req.headers.cookie`), `/healthz`, helmet, CORS (gov-web origin only), rate-limit plugin, error handler without stack leaks. Dockerfile.dev + Dockerfile.
- **Deps:** G01.
- **Done when:** `curl :8081/healthz` → `{ok:true}` with DB check.

### GA2 — gov DB schema + migrations
- **Do:** Drizzle schema + raw SQL migration for every table in Bible §5 (incl. `complaint_reporters`, `sync_errors`). DB roles: `gov_app` with no UPDATE/DELETE on `phone_reveal_log`, `gov_audit_log`.
- **Deps:** GA1.
- **Done when:** `npm run gov:migrate` on an empty DB succeeds twice (idempotent); `\dt` lists all tables; `UPDATE phone_reveal_log` as `gov_app` fails.

### GA3 — geo + reference seed
- **Do:** `data/geo/states.json` (all 36 states/UTs, hi/en), `districts.json` (min: Durg, Bengaluru Urban), `cities.json` (`cg.bhilai`, `ka.bengaluru` with centroids), `india_states.topojson` (official boundary per Bible §5.1, simplified < 1 MB). `npm run gov:seed` loads them + demo admin + one user per role (Bible §8 Seed). Mark unverified codes `"verified": false`.
- **Deps:** GA2.
- **Done when:** seed runs idempotently; `SELECT count(*) FROM geo_states` = 36; admin can be fetched.

### GA4 — Auth
- **Do:** argon2id (fallback bcrypt 12) passwords; `/api/auth/login|refresh|logout`, `/api/me`; EdDSA access token 15 min (`iss nyaysetu-gov`, `aud gov-web`), refresh token in httpOnly SameSite=Strict cookie stored hashed in `gov_sessions`, rotation; lockout 5 fails/15 min; CSRF double-submit on mutating routes; `requireAuth` rejecting tokens with a `kind` claim / wrong alg; audit rows for LOGIN / LOGIN_FAIL (hash-linked).
- **Deps:** GA2, G02.
- **Done when:** Vitest: Bible §12 tests 1 and 6 pass.

### GA5 — Sync receiver
- **Do:** second Fastify listener on internal port 8091: `POST /internal/sync/batch`. Ed25519 signature verify (`method|path|ts|nonce|sha256(body)`), ±60 s, nonce table, upsert logic per Bible §6.2 (seq-guarded, tenant→city→district→state mapping, close_request_status derivation, reporters, events). Reference payloads (boundaries/agencies/categories) upsert too. Unknown refs → `sync_errors`.
- **Deps:** GA2, G02.
- **Done when:** Vitest: Bible §12 test 5 passes using a locally signed fixture payload (no citizen stack needed).

### GA6 — RBAC helper
- **Do:** `scopeWhere(user)` → SQL fragment + params for NATIONAL/STATE/DISTRICT/CITY/DEPARTMENT; `assertTicketInScope(user, ticketId)`.
- **Deps:** GA2.
- **Done when:** unit tests for each role against fixture rows.

---

## GB — Gov API features
(All: Zod schemas, `requireAuth`, `scopeWhere`, IST-aware dates.)

### GB1 — List complaints
- `GET /api/complaints` with all filters, `q` search (ID trigram / last-4 phone / text), cursor pagination, sort. Returns masked phones only.
- **Deps:** GA4, GA6. **Done when:** curl with filters returns correct rows from fixture data; p95 < 200 ms on fixtures.

### GB2 — Group counts
- `GET /api/complaints/groups?groupBy=state|district|city|area|department` + same filters → `[{key, name{hi,en}, count}]`; nested path when drilling (e.g. `groupBy=area&city=cg.bhilai`).
- **Deps:** GB1. **Done when:** counts sum to the list total for each groupBy.

### GB3 — Detail
- `GET /api/complaints/:id`: fields, timeline, reporters (masked), close-request history.
- **Deps:** GA4, GA6. **Done when:** fixture ticket detail matches; out-of-scope → 404.

### GB4 — Phone reveal
- `POST /api/complaints/:id/reveal-phone {reporterIndex?, reason?}` → decrypt sealed box, insert `phone_reveal_log`, audit row, rate limit 30/h/officer.
- **Deps:** GB3. **Done when:** Bible §12 test 3 passes.

### GB5 — KPIs
- `GET /api/stats/kpis` (Bible §8 list) with filters.
- **Deps:** GB1. **Done when:** numbers match hand-computed fixture values (unit test).

### GB6 — Close request (gov side)
- `POST /api/complaints/:id/close-request {note?}` per Bible §7.1; signed call to citizen `CITIZEN_INTERNAL_URL/internal/gov/close-request`; optimistic column update; audit.
- **Deps:** GB3, G02. **Done when:** Bible §12 test 4 passes with the citizen call mocked.

### GB7 — Export + audit endpoints
- `GET /api/export.csv` (masked phones, 5/h, audit row); `GET /api/audit/reveals`, `GET /api/audit/log` (NATIONAL only).
- **Deps:** GB1. **Done when:** CSV opens in Excel with Hindi intact (UTF-8 BOM); audit rows written.

---

## GC — Gov web
(React 18 + Vite, plain JS, React Router 6, CSS modules + tokens from Bible §9.5.)

### GC0 — Mock API layer
- `src/api/client.js` with `fetch` wrapper (credentials, CSRF header, 401 → refresh → retry once); `VITE_USE_MOCKS=true` serves JSON from `src/mocks/*` so web tickets don't block on GB.
- **Deps:** G01. **Done when:** app boots with mocks.

### GC1 — Shell + i18n
- Layout (header, language toggle हिं/EN persisted with try/catch, user menu, footer disclaimer), `t()` with `hi.json`/`en.json` incl. Bible §9.2 terms, fonts (Noto Sans Devanagari + Inter), Indian number formatting helper.
- **Deps:** GC0. **Done when:** toggling language switches every visible string.

### GC2 — Login page
- Form, errors, lockout message, redirect.
- **Deps:** GC1 (+ GA4 for real use). **Done when:** works against mock and real API.

### GC3 — Filters bar + Group-by dropdown
- Group by (National/State/District/City/Department), cascading State→District→City→Area, Department, Category L1/L2, Status, Priority, date range, search. Filters in URL query string (shareable, survives refresh).
- **Deps:** GC1. **Done when:** changing any filter updates URL and triggers one request.

### GC4 — Complaints table (flat + grouped)
- Flat when National; collapsible groups with counts otherwise (lazy-load rows per group). Columns per Bible §9.1. Sticky header, sort, "Load more". Status chips with colours. Keyboard accessible.
- **Deps:** GC3 (+ GB1, GB2). **Done when:** all 5 group-by options render correctly from mock + real data.

### GC5 — KPI strip
- **Deps:** GC1 (+ GB5). **Done when:** values render and follow filters.

### GC6 — Detail drawer + phone reveal
- Full detail, timeline, reporters with masked numbers, "Show number" → confirm modal ("This view will be logged") → number + `tel:` link.
- **Deps:** GC4 (+ GB3, GB4). **Done when:** reveal shows number and a reveal-log row appears.

### GC7 — Close-request panel
- Button enabled only for WORK_DONE_PENDING_CONFIRMATION + not requested in 24 h; modal with optional note; badges (Awaiting citizen / Citizen confirmed / Citizen reopened / Unconfirmed after 7 days); reopen history.
- **Deps:** GC6 (+ GB6). **Done when:** happy path + disabled states verified.

### GC8 — Audit page (optional, cut first)
- **Deps:** GC1 (+ GB7).

---

## GD — Heat map
(react-leaflet + leaflet.heat + leaflet.markercluster; one `MapPanel` component sharing filters with the table.)

### GD1 — Map API endpoints
- `GET /api/map/states`, `/cities`, `/areas?city=`, `/points?bbox=&zoom=`, `/api/geo/india` (immutable cache headers). All honour filters + scope.
- **Deps:** GA6, GA3. **Done when:** curl returns counts; Bhilai & Bengaluru non-zero, others zero.

### GD2 — India base + state choropleth + city circles (zoom ≤ 6)
- No tile layer at national zoom; India TopoJSON drawn grey; states shaded by count (log scale, zero = neutral); city circles radius ∝ √count. Legend + "Locations approximate (±25 m) / स्थान अनुमानित हैं (±25 मी.)".
- **Deps:** GC1, GD1. **Done when:** only Bhilai and Bengaluru look "hot".

### GD3 — City heat layer (zoom 7–10) + OSM tiles fade-in at ≥10
- **Deps:** GD2. **Done when:** zooming into Chhattisgarh shows heat around Bhilai.

### GD4 — Ward/sector choropleth (zoom 11–14)
- Approximate polygons dashed with tooltip "approximate boundary".
- **Deps:** GD3. **Done when:** Bhilai wards visible with counts.

### GD5 — Points + clusters (zoom ≥ 15), click → detail; map⇄table linking
- **Deps:** GD4, GC6. **Done when:** clicking a point opens the detail drawer; clicking a ward sets the Area filter.

---

## CA — Citizen copy, backend (`NyaySetu_Full_v2/apps/api`)
Minimal diffs. After each ticket run existing `npm test`.

### CA1 — Ledger append + GOV actor + event type
- `GOV` actor type; `CLOSE_REQUESTED_BY_GOV` event; `appendEvent(tx, ticketId, type, actor, payload)` reusing the existing hash-link code; does not touch `tickets.state`.
- **Deps:** G03. **Done when:** unit test: append keeps `verify-chain` ok and state unchanged.

### CA2 — Migration `0007_gov_bridge.sql`
- Tables: `gov_nonces(nonce pk, at)`, `gov_sync_cursor(ticket_id pk, acked_seq)`. Grants for `app_rw`.
- **Deps:** G03. **Done when:** migrate succeeds on fresh + existing DB.

### CA3 — Internal listener + write-back endpoint
- Second Fastify instance on port 8090 (not published) with `POST /internal/gov/close-request` per Bible §7.2 (signature, ts, nonce, FOR UPDATE, state check, 24 h limit, `appendEvent`, notify, enqueue sync). Public 8080 must 404 it.
- **Deps:** CA1, CA2, G02. **Done when:** Bible §12 tests 7, 8, 9 pass.

### CA4 — gov-sync job
- pg-boss cron 30 s + enqueue after `transition()` / `appendEvent()` commits; builds payload (Bible §6.2) incl. phone re-seal to `GOV_PHONE_SEAL_PUBLIC_KEY` + mask; signs with `SYNC_SIGNING_PRIVATE_KEY`; advances cursor only on ack; backoff retries; first-run backfill of reference data.
- **Deps:** CA2, G02. **Done when:** with gov stack up, all seeded tickets appear in gov `complaints` (checks also GA5).

### CA5 — Per-citizen live stream
- `GET /me/stream` SSE (auth like existing report stream), ping 15 s, no-cache headers; in-process emitter keyed by citizen id (LISTEN/NOTIFY if quick). Emit on close request and on state changes of the citizen's tickets.
- **Deps:** G03. **Done when:** curl stream receives an event when CA3 is hit.

### CA6 — `/me/reports` pending_close_request
- Add `pending_close_request: {requested_at, note, official_name} | null`.
- **Deps:** CA1. **Done when:** API returns it for a ticket with an unanswered request; null after feedback.

### CA7 — Feedback "No" carries note + media, reopens same ticket
- Verify existing `POST /reports/:id/feedback`; accept `{fixed:false, note, media_id?}`; ensures REOPENED + escalation +1 on the same ticket; attaches media as `kind:'reopen'`.
- **Deps:** G03. **Done when:** Bible §12 test 10 passes.

### CA8 — Cron: 7-day CLOSED_UNCONFIRMED + 180-day phone erasure
- Verify/add hourly 7-day timeout. Add daily erasure job (citizens whose tickets are all closed ≥ 180 days → null phone fields; log the re-registration consequence). Sync pushes erasure (phone_cipher null) to gov.
- **Deps:** G03 (+ CA4 for propagation). **Done when:** fake-clock tests pass.

### CA9 — Officer auth hardening (cut if short on time)
- `OFFICER_JWT_SECRET` + `aud` claims; bcrypt passcodes with rehash-on-login fallback.
- **Deps:** G03. **Done when:** existing officer tests pass; citizen token rejected on officer routes and vice versa.

---

## CB — Citizen copy, web (`NyaySetu_Full_v2/apps/web`, both `phone/` and `desktop/`)

### CB1 — Live subscription
- `lib/meStream.js`: EventSource to `/me/stream`, auto-reconnect, on (re)connect re-fetch `/me/reports`.
- **Deps:** CA5 (can be written against CA5's contract before it lands). **Done when:** MyProblems updates without refresh.

### CB2 — MyProblems verify banner
- Banner + "पुष्टि करें / Verify resolution" button + optional official note (texts in Bible §7.4).
- **Deps:** CA6, CB1. **Done when:** banner appears within ~2 s of a gov close request.

### CB3 — Verify flow + Re-report screen
- Yes → existing Fixed flow / feedback endpoint. No → new `ReReport` screen reusing Speak/Photo/text components & CSS ("क्या दिक्कत बाकी है? बताइए"), submits to CA7.
- **Deps:** CB2, CA7. **Done when:** "No" with text + photo reopens the same complaint ID.

### CB4 — Privacy text
- Update `Privacy.jsx` (phone + desktop) and the phone-number notice with Bible §9.4 text.
- **Deps:** G03. **Done when:** both languages show the new polite line.

---

## GX — Integration, tests, handoff

### GX1 — Combined compose
- `NyaySetu_Gov/docker-compose.full.yml` with networks from Bible §11 (`sync_net` internal; no cross DB networks). `npm run up:all`.
- **Deps:** GA1, G03. **Done when:** both stacks up; `docker network inspect` confirms isolation; 8090/8091 unreachable from host.

### GX2 — Fixture/demo ticket helper
- Script to move one seeded Bhilai ticket to WORK_DONE_PENDING_CONFIRMATION via the citizen's existing demo/officer/field endpoints (no direct SQL state writes).
- **Deps:** GX1. **Done when:** ticket shows "Work done – awaiting citizen" in gov portal.

### GX3 — e2e script
- `scripts/e2e.mjs` per Bible §12 end-to-end.
- **Deps:** GX2, CA3–CA7, GB6, GA5. **Done when:** passes twice in a row.

### GX4 — Security checks
- Run all §12 tests; `npm audit --omit=dev` both; grep repo for secrets; verify pino redaction by triggering a reveal and checking logs.
- **Deps:** most of GA/GB/CA. **Done when:** results recorded in HANDOFF.md.

### GX5 — HANDOFF.md
- What works, run commands (`gen-keys → up:all → migrate → seed → backfill`), demo login, test results, stubs, cut items, decisions log, open ⚠️ VERIFY items.
- **Deps:** none (write a draft early; finalize last). **Done when:** a fresh reader can run both stacks from it.

---

## Suggested order for a 1–2 hour unattended run

1. G01, G02, G03 → GA1, GA2, GA3
2. GA4, GA6, GA5
3. CA1, CA2, CA3, CA4 → GX1 (sync visibly working = biggest milestone)
4. GB1, GB2, GB3, GB4 → GC0–GC4, GC6
5. GD1, GD2 (India map with two hot cities)
6. CA5, CA6, CA7, GB6, CB1–CB3, GC7 (close-request loop)
7. GX5 draft at any point; then GD3–GD5, GB5/GC5, CA8, CB4, GX2–GX4, CA9, GB7/GC8

**Cut order if time is short:** GC8 → GB7 → CA9 → GD4 → GD3 → GB5/GC5. **Never cut:** G02, GA4, GA5, CA3, CA4, GB4, GB6, CB2, CB3.
