# NYAYSETU GOV — The Government Portal Bible
### Companion to `NYAYSETU_BIBLE.md` (citizen side). Read that first for the domain; this file is the spec for the government-facing portal.

**Version 1 — 2026-10-08.** Written from: the citizen Bible, a read of the current `NyaySetu_Full` codebase (`apps/api`, `apps/web`), and the owner's (Arush's) decisions in chat. The six Gemini Deep Research reports (if attached) refine *how*; this file is the source of truth for *what*. Where a report conflicts with a **Locked decision** below, the decision wins.

---

## 0. Instructions for the agent (Claude Code) — read first

1. **You are working unattended for 1–2 hours.** Do not stop to ask questions. Take the most reasonable reading, record the choice in **Appendix B (Decision Log)**, and continue.
2. **Never modify the original citizen folder** `A:\Nyaysetu_main\NyaySetu_Full`. Copy it to `A:\Nyaysetu_main\NyaySetu_Full_v2` and make citizen-side changes **only in the copy**. (If the owner's kickoff prompt says otherwise, follow the prompt.)
3. Build the government portal in a **new folder** `A:\Nyaysetu_main\NyaySetu_Gov`.
4. **No deployment.** Local only: `docker compose up` must run everything (citizen stack + gov stack). No Railway, no Cloudflare, no real SMS.
5. **No deletes** outside your own build artefacts. No `git push`. Local commits are fine.
6. Use Docker (installed on the owner's machine). If a step needs a real API key (Gemini, ElevenLabs, Cloudinary), don't block: the gov portal doesn't need them; for the citizen copy use existing `.env` or stub/fallback paths.
7. Work in this order (Part 13). After each phase, run its "done when" check. Commit after each phase.
8. At the end, write `NyaySetu_Gov/HANDOFF.md`: what works, how to run it, what's stubbed, what's left, every decision you took alone.

---

## 1. What we are building (plain English)

NyaySetu's citizen app lets people speak a civic complaint; the engine categorises, routes and tracks it, and **only the citizen can confirm it's fixed.**

The **Government Portal** is a separate, officials-only website where government employees:
- see **every complaint nationwide**, with its **complaint ID**, **registered mobile number** (masked, reveal-on-click), category, department, status and location;
- **segregate** complaints by **National / State / District / City / Department** (and filter by category, status, date);
- see an **India heat map** whose heat is proportional to complaint count, zoomable down to wards/sectors and individual complaints;
- **call** the complainant (phone reveal is logged);
- send a **"close request"** once field work is done, which asks the citizen to verify the fix in their app.

The government portal **cannot close a ticket**. Only the citizen can (core NyaySetu thesis: *Closed is not fixed*).

---

## 2. Locked decisions (do not re-argue)

| # | Decision |
|---|---|
| D1 | **Fully separate stack:** own API server, own Postgres DB, own auth/keys, own web app, own port/domain. No shared JWT secret, no shared DB role, no shared Docker network with the citizen stack except the explicitly defined sync + write-back channels. |
| D2 | No citizen token (or citizen-app officer token) must ever be accepted by the gov API. |
| D3 | Languages: **Hindi + English only**, toggle in header. **No voice** features. |
| D4 | Location hierarchy: **State → District → City → Area** (Area = ward/sector from `boundaries`). |
| D5 | **Mobile number shown for ALL complaints, any status** (not only resolved). Shown **masked** (`98XXXXXX21`); **click to reveal**; every reveal written to `phone_reveal_log` (officer, time, ticket, IP/UA). |
| D6 | Phone data erased from **both** DBs **180 days after ticket closure** (`CLOSED_CONFIRMED` / `CLOSED_UNCONFIRMED` / `REJECTED_NOT_CIVIC`). |
| D7 | **Close request allowed ONLY when ticket state = `WORK_DONE_PENDING_CONFIRMATION`** (field proof already uploaded). Gov side appends event `CLOSE_REQUESTED_BY_GOV`; it never changes state. Max **1 request per ticket per 24 h**. Officer note optional. |
| D8 | Citizen sees a **"Verify karein / Verify resolution"** button on that complaint in **My Problems** (past complaints page), **in real time** (no refresh). |
| D9 | Citizen **"Haan, theek ho gaya"** → existing `CITIZEN_CONFIRMED` → `CLOSED_CONFIRMED`. |
| D10 | Citizen **"Nahi, abhi bhi hai"** → a **re-report screen with the same design as the original report flow** (photo box, voice box, text box). Submission **reopens the SAME ticket** (same complaint ID) → `REOPENED` + escalate one level; new photo/voice-transcript/text attached to that ticket. |
| D11 | No citizen reply for **7 days** → `CLOSED_UNCONFIRMED` (existing Bible rule). |
| D12 | Roles designed: **National, State, District, City, Department**. **Demo = one admin login**, but the main screen has a **group-by dropdown** (National / State / District / City / Department) that segregates the nationwide table. RBAC scoping code exists but demo admin has national scope. |
| D13 | Heat map: whole India shown; **only Bhilai and Bengaluru heated** (only real seed data). **No synthetic multi-state data.** Zoomable to wards and individual (clustered) complaint points. Label: **"Locations approximate (±25 m)"**; Bhilai ward polygons labelled approximate. |
| D14 | Citizen privacy text updated, polite, non-threatening (Part 9.4). |
| D15 | Citizen-side changes done **alongside** the gov portal (in the copy), because close-request must be live end-to-end. |
| D16 | Not deployed now. Owner will test citizen↔gov sync together with you later, then deploy. |
| D17 | This is a prototype: **no Ashoka emblem, no tricolour branding, no "Government of India" claims.** Neutral civic look. Footer: "Prototype — not an official government website." |

---

## 3. What the current citizen codebase looks like (facts, as read on 2026-10-08)

- Monorepo, npm workspaces: `apps/api` (Node 22, Fastify 5, TypeScript, Drizzle ORM, Zod, pg-boss, `@fastify/jwt`, `@fastify/rate-limit`, `bcrypt`, `h3-js`, `sharp`), `apps/web` (React **18**, Vite 5, **plain JS**, react-router-dom 6; split into `src/phone/*` and `src/desktop/*` screens: Home, Speak, Photo, Where, Send, Sent, Status, MyProblems, Fixed, NeedsFix, Voice, Privacy, Phone, Code, Language, NotSent, PhotoRejected). Note: the citizen Bible says React 19 + TS; **the code is React 18 plain JS**. Follow the code.
- DB: Postgres 17 + PostGIS + pgvector, custom image `infra/db`. Migrations: `apps/api/drizzle/*` + raw SQL `apps/api/sql/0001..0006`. Schema in `apps/api/src/db/schema.ts`.
- Key tables: `tenants(id, name{hi,en}, state_code, lgd_code, config)`, `agencies`, `boundaries(id, tenant_id, kind, name{hi,en}, specificity, owner_agency_id, approximate, geom MultiPolygon)`, `categories(code, l1, names{hi,en}, icon, …)`, `routing_rules`, `sla_policies`, `citizens(id, phone_hash HMAC, phone_enc AES-256-GCM base64 text, lang)`, `officers(id, tenant_id, agency_id, role, level, name, passcode_hash)`, `tickets(id, public_code, tenant_id, category_code, boundary_id, agency_id, department{hi,en}, state, escalation_level, priority_*, report_count, geom, h3_r9, summary_officer_en, sla_due_at, created_at, resolved_at, closed_at, last_event_seq)`, `reports(id, ticket_id, citizen_id, lang, original_text, summary_citizen, …, feedback)`, `media`, `events` (append-only, hash-linked; app role has no UPDATE/DELETE), `team_positions`.
- All ticket state changes go through `apps/api/src/modules/lifecycle/transition.ts` (`ALLOWED` table). Events + side effects (pg-boss) in one transaction.
- Auth: citizens = phone + OTP → JWT `{kind:"citizen"}` 30d. Officers = passcode → JWT `{kind:"officer"}` 24h. **Both signed with the same `JWT_SECRET`.**
- Live updates: SSE per report (`/reports/:id/stream`), ping every 15 s.
- Env read in `apps/api/src/env.ts` (Zod validated).

**Known issues (fix only in the copy, and only those listed in Part 9):**
1. Officer login hashes passcodes with **unsalted SHA-256** (`officers/routes.ts`) though `bcrypt` is a dependency.
2. One `JWT_SECRET` for citizen and officer tokens.
3. `phone_enc`: Bible says `bytea`, schema uses `text` (base64). Keep `text`; just be aware.
4. Tickets have no district/city columns; derive via a mapping table (gov side), not by changing citizen tables.
5. Seed data covers only `cg.bhilai` and `ka.bengaluru`.

---

## 4. Architecture

```
┌──────────────── CITIZEN STACK (NyaySetu_Full_v2) ────────────────┐
│ citizen-web (React PWA) ──► citizen-api (Fastify) ──► citizen-db  │
│                                  ▲   │                            │
│        internal write-back       │   │ outbox / sync job          │
│   POST /internal/gov/close-request│   │ (pg-boss, every 30 s +     │
│   (private network, signed        │   │  on-event)                 │
│    service token, HMAC/EdDSA)     │   ▼                            │
└──────────────────────────────────┼───┼────────────────────────────┘
                                   │   │  PUSH ONLY (citizen → gov):
                                   │   │  POST gov-api /internal/sync/batch
                                   │   │  signed with SYNC key
┌──────────────── GOV STACK (NyaySetu_Gov) ────────────────────────┐
│ gov-web (React 18 + Vite) ──► gov-api (Fastify) ──► gov-db        │
│  admin login, table, map         │  own JWT keys (EdDSA), RBAC    │
│                                  └─ calls citizen write-back only │
│                                     for close requests            │
└───────────────────────────────────────────────────────────────────┘
```

### 4.1 Why push, not pull, not shared DB
- **Citizen → Gov is a push** of denormalised rows. The gov stack never gets a credential to the citizen DB. If the gov server is compromised, it can't read citizen tables.
- **Gov → Citizen** has exactly one door: `/internal/gov/close-request`. It can only append `CLOSE_REQUESTED_BY_GOV` for a ticket in `WORK_DONE_PENDING_CONFIRMATION`. Nothing else.
- Both internal endpoints are **not exposed on public ports**. In compose they live on a dedicated `bridge` network `sync_net` that only `citizen-api` and `gov-api` join; databases are on separate networks (`citizen_db_net`, `gov_db_net`).
- Both directions are authenticated with **separate asymmetric keys** (Ed25519 signatures over `method|path|timestamp|nonce|sha256(body)`), ±60 s clock window, nonce replay cache (DB table, 10 min TTL), plus idempotency keys.

### 4.2 Phone number path (security-critical)
- Citizen side decrypts `phone_enc` **inside the citizen-api sync job only**, immediately re-encrypts with the **gov public key** (X25519 sealed box via `libsodium-wrappers`, or RSA-OAEP via Node `crypto` if libsodium is unavailable) and sends the ciphertext. **`PHONE_ENC_KEY` never leaves the citizen stack.**
- Gov DB stores `phone_cipher` (only gov-api's private key can open it) + `phone_masked` (e.g. `98XXXXXX21`, computed citizen-side) + `phone_last4`.
- Gov UI shows `phone_masked`. `POST /api/complaints/:id/reveal-phone` → gov-api decrypts, writes `phone_reveal_log`, returns the number + a `tel:` link. Rate limit: 30 reveals / officer / hour.
- Erasure job (both sides) at closure + 180 days nulls phone columns. Gov side keeps the reveal log rows (they hold officer + ticket, not the number).

---

## 5. Gov database schema (gov-db, Postgres 17 + PostGIS)

Use Drizzle in gov-api, raw SQL for PostGIS bits. DB image: reuse `postgis/postgis:17-3.5` (no pgvector needed).

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── geography dimensions ───────────────────────────
CREATE TABLE geo_states (
  code text PRIMARY KEY,            -- 'CG', 'KA'
  lgd_code int,
  name jsonb NOT NULL               -- {"hi":"छत्तीसगढ़","en":"Chhattisgarh"}
);
CREATE TABLE geo_districts (
  id text PRIMARY KEY,              -- 'CG.DURG', 'KA.BENGALURU_URBAN'
  state_code text NOT NULL REFERENCES geo_states,
  lgd_code int,
  name jsonb NOT NULL
);
CREATE TABLE geo_cities (
  id text PRIMARY KEY,              -- = citizen tenant id: 'cg.bhilai', 'ka.bengaluru'
  district_id text NOT NULL REFERENCES geo_districts,
  name jsonb NOT NULL,
  centroid geometry(Point,4326) NOT NULL
);
CREATE TABLE geo_areas (
  id text PRIMARY KEY,              -- = citizen boundary id: 'cg.bhilai.ward.14'
  city_id text NOT NULL REFERENCES geo_cities,
  kind text NOT NULL,               -- ward | sector | corridor | cantonment
  name jsonb NOT NULL,
  approximate boolean NOT NULL DEFAULT false,
  geom geometry(MultiPolygon,4326) NOT NULL
);
CREATE INDEX ON geo_areas USING gist (geom);

CREATE TABLE departments (
  id text PRIMARY KEY,              -- citizen agency id (+ dept key)
  agency_name jsonb NOT NULL,
  department_name jsonb,
  kind text
);
CREATE TABLE categories (
  code text PRIMARY KEY, l1 text NOT NULL, names jsonb NOT NULL, icon text
);
CREATE TABLE category_l1 (code text PRIMARY KEY, names jsonb NOT NULL);  -- ELECTRICITY, WATER, ...

-- ── the fact table ─────────────────────────────────
CREATE TABLE complaints (
  ticket_id uuid PRIMARY KEY,               -- citizen tickets.id
  public_code text UNIQUE NOT NULL,         -- complaint ID shown to officials
  state_code text NOT NULL REFERENCES geo_states,
  district_id text NOT NULL REFERENCES geo_districts,
  city_id text NOT NULL REFERENCES geo_cities,
  area_id text REFERENCES geo_areas,        -- null if no polygon matched
  department_id text REFERENCES departments,
  category_code text NOT NULL REFERENCES categories,
  category_l1 text NOT NULL,
  status text NOT NULL,                     -- citizen ticket state, verbatim
  priority_band text NOT NULL,
  escalation_level int NOT NULL DEFAULT 0,
  report_count int NOT NULL DEFAULT 1,
  summary_en text NOT NULL,                 -- summary_officer_en
  original_text text,                       -- first report verbatim
  original_lang text,
  geom geometry(Point,4326) NOT NULL,
  h3_r9 text NOT NULL,
  phone_masked text,                        -- '98XXXXXX21' (first registering citizen)
  phone_cipher text,                        -- sealed to gov key; null after erasure
  sla_due_at timestamptz,
  created_at timestamptz NOT NULL,
  resolved_at timestamptz,
  closed_at timestamptz,
  -- close-request tracking
  close_request_status text,                -- null | requested | confirmed | reopened | unconfirmed
  close_requested_at timestamptz,
  close_requested_by text,
  close_request_note text,
  citizen_responded_at timestamptz,
  reopen_count int NOT NULL DEFAULT 0,
  source_event_seq int NOT NULL,            -- last citizen event seq applied (idempotency)
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON complaints (state_code, district_id, city_id, area_id);
CREATE INDEX ON complaints (department_id);
CREATE INDEX ON complaints (category_l1, status);
CREATE INDEX ON complaints (created_at DESC);
CREATE INDEX ON complaints USING gist (geom);
CREATE INDEX ON complaints (h3_r9);
CREATE INDEX ON complaints USING gin (public_code gin_trgm_ops);

-- per-ticket timeline copy (read-only display)
CREATE TABLE complaint_events (
  ticket_id uuid REFERENCES complaints ON DELETE CASCADE,
  seq int, type text, from_state text, to_state text,
  actor_type text, created_at timestamptz,
  PRIMARY KEY (ticket_id, seq)
);

-- ── gov people & security ──────────────────────────
CREATE TABLE gov_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,              -- argon2id (or bcrypt cost 12 fallback)
  role text NOT NULL,                       -- NATIONAL | STATE | DISTRICT | CITY | DEPARTMENT
  scope_state text, scope_district text, scope_city text, scope_department text,
  totp_secret text,                         -- optional, demo may skip
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE gov_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES gov_users,
  refresh_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip text, user_agent text, created_at timestamptz DEFAULT now()
);
CREATE TABLE phone_reveal_log (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES gov_users,
  ticket_id uuid NOT NULL,
  public_code text NOT NULL,
  reason text,                              -- optional free text
  ip text, user_agent text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE gov_audit_log (                -- append-only, hash-linked like citizen events
  id bigserial PRIMARY KEY,
  user_id text, action text NOT NULL,       -- LOGIN, LOGIN_FAIL, REVEAL_PHONE, CLOSE_REQUEST, EXPORT, ...
  target text, payload jsonb NOT NULL DEFAULT '{}',
  at timestamptz NOT NULL DEFAULT now(),
  prev_hash text NOT NULL, hash text NOT NULL
);
CREATE TABLE sync_nonces (nonce text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sync_state (id int PRIMARY KEY DEFAULT 1, last_batch_at timestamptz, last_seq_by_ticket jsonb);
```

App DB role for gov-api: `SELECT, INSERT` on `phone_reveal_log` and `gov_audit_log` only (no UPDATE/DELETE), normal rights elsewhere.

**Rollups:** plain `GROUP BY` with the indexes above is enough at demo scale. Add a materialized view `mv_counts(state, district, city, area, department, category_l1, status, day, n)` refreshed every 2 min **only if** queries exceed 200 ms.

### 5.1 Geography seed (gov side, `NyaySetu_Gov/data/geo/`)
- `states.json`: at least all 36 states/UTs with names hi/en + LGD codes (from LGD; if unverified, mark `"lgd_verified": false`).
- `districts.json`: at minimum **Durg (CG)** for Bhilai and **Bengaluru Urban (KA)** for Bengaluru. ⚠️ VERIFY Bhilai's current district (Durg) and LGD codes.
- `cities.json`: `cg.bhilai` → `CG.DURG`, `ka.bengaluru` → `KA.BENGALURU_URBAN`, with centroids.
- `areas`: copied from citizen `boundaries` during the first sync (geom included).
- `india_states.topojson` for the base map. **Must show India's official external boundary** (all of J&K incl. PoK/Gilgit-Baltistan, Ladakh incl. Aksai Chin, Arunachal Pradesh) per Survey of India. Source: Survey of India / DataMeet "India official boundary" files. ⚠️ VERIFY the file before using; if unsure, use the Survey-of-India-compliant DataMeet state map and note it in the decision log. Simplify with mapshaper to < 1 MB.

---

## 6. Sync protocol (citizen → gov)

### 6.1 Trigger
- In the citizen copy, add a pg-boss job `gov-sync`:
  - **cron every 30 s**: select tickets whose `last_event_seq` > the seq last acknowledged by gov (store in citizen table `gov_sync_cursor(ticket_id, acked_seq)`), up to 200 per batch;
  - **plus** an immediate enqueue after `transition()` commits (use the existing side-effect enqueue in the same transaction; add one job type). This makes close-request responses show in the gov portal within seconds.
- First run = full backfill, also pushes `tenants`, `boundaries`, `agencies/departments`, `categories`.

### 6.2 Payload (per ticket)
```json
{
  "ticket_id": "…", "public_code": "BHI-26-001041",
  "tenant_id": "cg.bhilai", "boundary_id": "cg.bhilai.ward.14",
  "agency_id": "cg.bhilai.bmc", "department": {"hi":"…","en":"…"},
  "category_code": "STREETLIGHT_AREA_DARK", "category_l1": "STREETLIGHTS",
  "state": "WORK_DONE_PENDING_CONFIRMATION", "priority_band": "High",
  "escalation_level": 0, "report_count": 3,
  "summary_officer_en": "…", "original_text": "…", "original_lang": "hi",
  "lat": 21.2, "lng": 81.38, "h3_r9": "…",
  "phone_masked": "98XXXXXX21", "phone_cipher": "base64…",
  "sla_due_at": "…", "created_at": "…", "resolved_at": null, "closed_at": null,
  "events": [{"seq":7,"type":"STATE_CHANGED","from_state":"…","to_state":"…","actor_type":"FIELD","created_at":"…"}],
  "last_event_seq": 7
}
```
- Gov `POST /internal/sync/batch` verifies signature, nonce, timestamp; upserts each ticket **only if `last_event_seq` > stored `source_event_seq`** (idempotent, out-of-order safe); maps `tenant_id → city → district → state`; returns `{acked: [{ticket_id, seq}]}`.
- Derive `close_request_status` gov-side from events: `CLOSE_REQUESTED_BY_GOV` → `requested`; then `CITIZEN_CONFIRMED` → `confirmed`; `CITIZEN_REJECTED`/`REOPENED` → `reopened` (+`reopen_count`); system `CLOSED_UNCONFIRMED` → `unconfirmed`.
- Phone: the **first registering citizen** of the ticket (earliest report). Detail view lists all reporters' masked numbers (`reporters[]`), each separately revealable. (Add a `complaint_reporters(ticket_id, report_id, phone_masked, phone_cipher, created_at)` table.)

### 6.3 Failure handling
- Gov down → citizen job retries with backoff (pg-boss retryLimit 10, retryBackoff true). Cursor only advances on ack.
- Unknown tenant/boundary on gov side → insert into `sync_errors` table, skip, don't crash.

---

## 7. Close-request protocol (gov → citizen)

### 7.1 Gov API
`POST /api/complaints/:ticketId/close-request` body `{note?: string ≤ 300}`
1. Auth + RBAC: user scope must include the ticket.
2. Check gov-side `status = WORK_DONE_PENDING_CONFIRMATION` and no request in last 24 h (else 409 with reason).
3. Call citizen `POST /internal/gov/close-request` (signed, idempotency key = `sha256(ticketId|userId|date-hour)`).
4. On 200: update `close_request_*` columns optimistically, write `gov_audit_log` `CLOSE_REQUEST`.

### 7.2 Citizen internal endpoint (in the copy)
`POST /internal/gov/close-request` `{ticket_id, gov_user_id, gov_user_name, note?, idempotency_key}`
- Only reachable on `sync_net` (bind a **second Fastify listener on an internal port**, e.g. 8090, not published to host; public 8080 must 404 this path).
- Verify Ed25519 signature with `GOV_WRITEBACK_PUBLIC_KEY`, timestamp, nonce.
- Lock ticket (`SELECT … FOR UPDATE`), require `state = WORK_DONE_PENDING_CONFIRMATION`, check 24 h limit via events.
- Append event `CLOSE_REQUESTED_BY_GOV` (actor_type `GOV`, actor_id `gov:<id>`, payload `{note, gov_user_name}`) using the ledger's hash-link helper. **Does not change state.** (Add `GOV` to actor types; add the event type to the event list; `transition()`'s `ALLOWED` is untouched because state doesn't change. Use or add a ledger `appendEvent()` helper that does not transition.)
- Push to every reporter's live channel (7.3). Enqueue `gov-sync` for this ticket.

### 7.3 Real-time to the citizen (in the copy)
- Add a **per-citizen SSE stream**: `GET /me/stream` (citizen JWT via `?token=` query or cookie since EventSource can't set headers — follow how the existing `/reports/:id/stream` authenticates and match it). Emits `{type:"close_request", reportId, ticketCode, note}` and existing state changes. `: ping` every 15 s, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
- In-process fan-out: a simple `EventEmitter` keyed by citizen id is fine for one API instance (note in decision log: multi-instance needs Postgres `LISTEN/NOTIFY`; implement with `LISTEN/NOTIFY` if quick).
- On (re)connect the client also re-fetches `/me/reports`, so a missed event is never lost. `/me/reports` must return `pending_close_request: {requested_at, note} | null` per report (derived from the latest `CLOSE_REQUESTED_BY_GOV` event with no later citizen feedback).

### 7.4 Citizen UI (in the copy, both `src/phone` and `src/desktop`)
- **MyProblems.jsx:** card with `pending_close_request` shows a highlighted banner + primary button:
  - hi: **"सरकारी अधिकारी ने बताया है कि काम हो गया है। कृपया पुष्टि करें।"** · button **"पुष्टि करें"**
  - en: **"An official says the work is done. Please verify."** · button **"Verify resolution"**
  - Optional officer note shown below in quotes.
- Tap → existing closure screen pattern (Fixed / NeedsFix screens): **"✅ हाँ, ठीक हो गई"** / **"❌ नहीं, अभी भी है"**. Reuse the existing feedback endpoint (`POST /reports/:id/feedback`) for "Yes".
- **"No" → Re-report screen** = same visual design as the original report flow (Speak + Photo + text box, same CSS), titled **"क्या दिक्कत बाकी है? बताइए"** / **"What's still wrong? Tell us"**. Submit → `POST /reports/:id/feedback {fixed:false, note: <text or transcript>, media_id?}` → existing reopen + escalate path (`REOPENED`, escalation +1, same ticket). If the existing feedback endpoint can't carry a voice transcript/photo, extend it minimally (accept `note` + `media_id`), don't create a new ticket.
- Haptics + audio cues per existing patterns. The voice box uses the existing `/voice/transcribe`.
- Fixed audio clips: if pre-generated mp3s don't exist for the new lines, show text only (no new TTS calls required).

### 7.5 Seven-day timeout
Existing rule: `WORK_DONE_PENDING_CONFIRMATION` → `CLOSED_UNCONFIRMED` after 7 days with no reply. **Verify it exists in the lifecycle worker**; if not, add a pg-boss cron (hourly). The 7 days count from entering `WORK_DONE_PENDING_CONFIRMATION` (not from the close request). Log the choice.

---

## 8. Gov API (gov-api, Fastify 5 + TS + Zod + Drizzle)

Public port 8081. All JSON. Zod-validated. Errors never leak stack traces.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | `{email, password}` → access token (15 min, EdDSA, `iss:"nyaysetu-gov"`, `aud:"gov-web"`) + refresh in httpOnly `SameSite=Strict` cookie. Lockout after 5 fails / 15 min. |
| POST | `/api/auth/refresh` | rotate refresh |
| POST | `/api/auth/logout` | revoke |
| GET | `/api/me` | user + role + scope |
| GET | `/api/complaints` | filters: `state, district, city, area, department, category_l1, category, status, priority, close_request_status, from, to, q` (ID / last-4 of phone / text trigram); `groupBy` in `none|state|district|city|area|department`; cursor pagination; sort |
| GET | `/api/complaints/groups` | counts per group for the chosen `groupBy` + same filters |
| GET | `/api/complaints/:id` | detail: all fields, timeline, reporters (masked), close-request history |
| POST | `/api/complaints/:id/reveal-phone` | `{reporterIndex?, reason?}` → number; logs |
| POST | `/api/complaints/:id/close-request` | Part 7.1 |
| GET | `/api/stats/kpis` | received, open, resolved, avg resolution h, SLA breach %, reopen %, awaiting citizen, confirmed-fix rate, unconfirmed rate (same filters) |
| GET | `/api/map/states` | counts per state (all 36; zeros allowed) |
| GET | `/api/map/cities` | counts + centroid per city |
| GET | `/api/map/areas?city=` | area polygons (GeoJSON) + counts |
| GET | `/api/map/points?bbox=&zoom=` | individual points (id, code, category_l1, status, lat, lng) inside bbox, max 2000; clustering done client-side |
| GET | `/api/geo/india` | static simplified India states TopoJSON (cached, immutable) |
| GET | `/api/export.csv` | same filters; masked phones only; logs EXPORT; 5 / hour |
| POST | `/internal/sync/batch` | **internal listener only** (port 8091 on `sync_net`) |
| GET | `/healthz` | DB check |

**Security middleware:** `@fastify/helmet` (strict CSP), `@fastify/cors` (only gov-web origin), `@fastify/rate-limit`, `@fastify/cookie`, CSRF double-submit token on mutating routes, JWT verify with `issuer`, `audience`, `algorithms:["EdDSA"]` and **reject any token with `kind` claim** (citizen/officer tokens have it). Every route except login/healthz requires auth. RBAC helper `scopeWhere(user)` appended to every complaints/map/stats query.

**Keys** (generate in `scripts/gen-keys.mjs`, write to `.env` files, never commit):
- `GOV_JWT_PRIVATE_KEY / PUBLIC_KEY` (Ed25519) — gov only.
- `SYNC_SIGNING_PRIVATE_KEY` (citizen) / `SYNC_SIGNING_PUBLIC_KEY` (gov).
- `GOV_WRITEBACK_PRIVATE_KEY` (gov) / `GOV_WRITEBACK_PUBLIC_KEY` (citizen).
- `GOV_PHONE_SEAL_PUBLIC_KEY` (citizen) / `GOV_PHONE_SEAL_PRIVATE_KEY` (gov).

**Seed:** one demo admin `admin@nyaysetu.local` / password from `.env` `GOV_ADMIN_PASSWORD` (print a generated one if unset), role `NATIONAL`. Also create (inactive in UI, for RBAC tests) one user per role scoped to CG / Durg / Bhilai / BMC.

---

## 9. Gov Web (gov-web)

React **18 + Vite + plain JS** (match the citizen app; fewer moving parts). React Router 6. Leaflet + react-leaflet + `leaflet.markercluster` + `leaflet.heat` (or circle-scaled choropleth; see 9.3). No heavy UI kit: plain CSS modules with tokens. i18n: a tiny custom `t()` with `src/i18n/hi.json`, `en.json` (language persisted in localStorage with try/catch). Fonts: Noto Sans Devanagari + Inter (self-host or Google Fonts).

### 9.1 Screens
1. **Login** — email, password, language toggle, prototype disclaimer.
2. **Dashboard (main)** — layout:
   ```
   ┌ Header: NyaySetu Gov · [हिं|EN] · user · logout ───────────────────────────┐
   │ KPI strip: Received · Open · Awaiting citizen · Resolved · SLA breached % · │
   │            Reopen % · Confirmed-fix rate                                    │
   ├ Filters: [Group by ▼ National/State/District/City/Department]              │
   │          [State ▼][District ▼][City ▼][Area ▼][Department ▼]               │
   │          [Category ▼ Electricity/Water/…][Status ▼][Date from–to][Search]  │
   ├───────────────────────────────┬────────────────────────────────────────────┤
   │ India map (heat)              │ Complaints table (grouped)                 │
   │ zoom: India→state→city→ward→  │ ▸ Chhattisgarh (42)                         │
   │ points; "±25 m" label         │   ▸ Durg (42) ▸ Bhilai (42) ▸ Ward 14 (6)  │
   │                               │ cols: ID · Mobile(masked 👁) · Category ·   │
   │                               │ Area · Dept · Status · Priority · Age ·    │
   │                               │ Close-request                              │
   └───────────────────────────────┴────────────────────────────────────────────┘
   ```
   - **Group by = National** → flat nationwide list. Other values → collapsible groups with counts (from `/complaints/groups`), expanding loads that group's rows.
   - Cascading filters: choosing State narrows District options, etc.
   - Table: sticky header, cursor pagination ("Load more"), sort by created / priority / age.
   - Map and table share filters; clicking a city/area/point on the map sets the filter; clicking a table row highlights it on the map.
3. **Complaint detail drawer/page** — complaint ID (copy button), status chip, category icon+name, dept, full location path, original text (verbatim, with language tag) + English summary, priority + SLA due, **reporters list with masked numbers + "Show number" button** (confirm modal: "This view will be logged") → number + `tel:` link, timeline (events), close-request panel:
   - Enabled only if status = `WORK_DONE_PENDING_CONFIRMATION` and no request in last 24 h.
   - Modal: optional note (≤300 chars), confirm.
   - Badges: Awaiting citizen · Citizen confirmed · Citizen reopened · Unconfirmed after 7 days.
4. **Audit log** (admin) — reveal log + audit log table.

### 9.2 Status labels (hi / en)
| State | EN | HI |
|---|---|---|
| SUBMITTED | Received | प्राप्त |
| VERIFIED | Verified | सत्यापित |
| NEEDS_TRIAGE | Needs triage | जाँच आवश्यक |
| ASSIGNED | Assigned | सौंपी गई |
| TRANSFERRED | Transferred | स्थानांतरित |
| DISPATCHED | Team dispatched | टीम रवाना |
| WORK_DONE_PENDING_CONFIRMATION | Work done – awaiting citizen | कार्य पूर्ण – नागरिक की पुष्टि बाकी |
| CLOSED_CONFIRMED | Closed (citizen confirmed) | बंद (नागरिक द्वारा पुष्टि) |
| CLOSED_UNCONFIRMED | Closed (not confirmed) | बंद (पुष्टि नहीं) |
| REOPENED | Reopened | पुनः खोली गई |
| REJECTED_NOT_CIVIC | Not a civic issue | नागरिक समस्या नहीं |

Other key terms: Complaint ID = शिकायत संख्या · Mobile number = मोबाइल नंबर · Show number = नंबर दिखाएँ · Request closure = समापन का अनुरोध करें · Department = विभाग · State/District/City/Area = राज्य/ज़िला/शहर/क्षेत्र · Heat map = हीट मैप · Locations approximate (±25 m) = स्थान अनुमानित हैं (±25 मी.) · Group by = समूह बनाएँ · Export = निर्यात. Use Western digits (0-9) in both languages; Indian grouping (1,23,456).

### 9.3 Heat map behaviour
- Base: India states TopoJSON (official boundary, Part 5.1) drawn as a light grey GeoJSON layer, **no external tile layer at national zoom** (avoids tile-provider boundary issues); OSM tiles fade in from zoom ≥ 10 (city level) for street context.
- **Zoom ≤ 6 (India):** state choropleth (count-based, sequential palette, log scale; zero = neutral grey) **plus** a city "heat" circle (radius ∝ √count) at Bhilai and Bengaluru so two cities are visible on a big map.
- **Zoom 7–10 (state/city):** city circles + `leaflet.heat` layer from points (weight 1 each).
- **Zoom 11–14 (city):** ward/sector polygons choropleth with counts; approximate polygons drawn dashed with an "approximate" tooltip.
- **Zoom ≥ 15:** individual points via `markercluster`, coloured by category L1; click → detail.
- Legend always visible; label **"Locations approximate (±25 m)"** fixed bottom-left. Colour-blind-safe sequential palette (e.g. light yellow → deep red, checked for contrast).
- Map honours all filters (category, status, dept, date).

### 9.4 Citizen privacy text (in the copy, `Privacy.jsx` phone + desktop, and wherever the phone-number notice appears)
- hi: **"आपकी शिकायत की पुष्टि करने या उसे बेहतर समझने के लिए संबंधित सरकारी अधिकारी आपको कॉल कर सकते हैं। आपका नंबर किसी और के साथ साझा नहीं किया जाएगा।"**
- en: **"A government official handling your complaint may call you to confirm it or understand it better. Your number won't be shared with anyone else."**
Keep the rest of the existing notice.

### 9.5 Design
- Clean, neutral, data-dense; not the citizen app's style. Primary colour deep navy `#1F3A5F`, accent teal `#0E7C86`, status colours: amber `#B26B00`, blue `#1F6FEB`, green `#1E7B34`, red `#B42318` (text on white ≥ 4.5:1). Light theme only is fine for v1.
- Desktop-first (≥1280 px), usable at 1024 px. Keyboard navigable; visible focus rings; tables with `<th scope>`; aria-labels on icon buttons.
- Footer: "NyaySetu Gov — prototype, not an official government website." No emblem, no flag.

---

## 10. Citizen-side changes (in `NyaySetu_Full_v2` ONLY)

| # | Change | Files (expected) |
|---|---|---|
| C1 | Separate signing for officers: keep `JWT_SECRET` for citizens, add `OFFICER_JWT_SECRET` (register a second jwt namespace or verify manually). Officer tokens get `aud:"officer"`, citizen tokens `aud:"citizen"`. Keep existing behaviour otherwise. | `app.ts`, `env.ts`, `modules/officers/*`, `modules/auth/*` |
| C2 | Officer passcodes: bcrypt (cost 12). Seed writes bcrypt hashes; login uses `bcrypt.compare`. Keep a one-time fallback for old SHA-256 hashes → rehash on success. | `officers/routes.ts`, `db/seed*.ts` |
| C3 | `GOV` actor type + `CLOSE_REQUESTED_BY_GOV` event type + `appendEvent()` (non-transition ledger append, hash-linked, same tx rules). | `lifecycle/types.ts`, `lifecycle/transition.ts` (or new `ledger.ts`) |
| C4 | Internal listener (port 8090, not published) with `/internal/gov/close-request` + signature verification + nonce table. | new `modules/gov/*`, `server.ts`, new SQL migration `0007_gov_bridge.sql` (nonces, `gov_sync_cursor`) |
| C5 | `gov-sync` pg-boss job (cron 30 s + on-commit enqueue), phone re-sealing to gov public key, masking. | new `modules/gov/sync.ts`, `db/boss.ts`, `lifecycle/worker.ts` |
| C6 | `/me/reports` returns `pending_close_request`; new `/me/stream` SSE. | `modules/reports/routes.ts` / `session/routes.ts`, lifecycle routes |
| C7 | Feedback "No" accepts `note` + `media_id` and reopens the same ticket (verify existing path). | `lifecycle/routes.ts` |
| C8 | 7-day `CLOSED_UNCONFIRMED` cron (verify/add). 180-day phone erasure cron (null `phone_enc`/`phone_hash` for citizens whose all tickets are closed ≥ 180 days). ⚠️ `phone_hash` is the login key: erasing it means the citizen must re-register; log this. | `lifecycle/worker.ts` |
| C9 | Web: MyProblems banner + verify flow + re-report screen (phone + desktop); privacy text; `/me/stream` subscription. | `apps/web/src/{phone,desktop}/screens/*`, `lib/*`, `routes.js` |
| C10 | Compose: add `sync_net`, internal port, new env vars. | `docker-compose.yml`, `.env.example` |

Do **not** refactor anything else. Keep diffs minimal and readable. Existing tests must still pass (`npm test` in apps/api).

---

## 11. Docker / local run

Top-level `NyaySetu_Gov/docker-compose.yml` runs the **gov stack**; a root-level `NyaySetu_Gov/docker-compose.full.yml` (or `compose -f` instructions) runs **both** stacks together for the end-to-end test:

```
networks:
  citizen_db_net: {}   # citizen-api ↔ citizen-db
  gov_db_net: {}       # gov-api ↔ gov-db
  sync_net: { internal: true }   # citizen-api ↔ gov-api only
  public_net: {}       # web + api public ports
services:
  citizen-db  (citizen_db_net)                 no published port (or 5432 for dev only)
  citizen-api (public_net, citizen_db_net, sync_net)  publish 8080; 8090 NOT published
  citizen-web (public_net)                     publish 5173
  gov-db      (gov_db_net)                     no published port (5433 dev only)
  gov-api     (public_net, gov_db_net, sync_net)  publish 8081; 8091 NOT published
  gov-web     (public_net)                     publish 5174
```
gov-api must **not** be on `citizen_db_net`; citizen-api must **not** be on `gov_db_net`.

Scripts: `npm run gov:keys` (generate key pairs into both `.env`s), `npm run gov:migrate`, `npm run gov:seed` (geo + admin), `npm run gov:sync:backfill`.

---

## 12. Testing (must exist and pass)

gov-api (Vitest):
1. Citizen JWT → 401. Citizen-app officer JWT → 401. Token signed with `dev-secret-change-me` HS256 → 401. Token with wrong `aud`/`iss` → 401. `alg:none` → 401.
2. RBAC: DISTRICT user scoped to Durg cannot see a Bengaluru complaint (list, detail, map, stats, reveal).
3. Reveal writes exactly one `phone_reveal_log` row; DB role cannot UPDATE/DELETE it.
4. Close request: 409 if status ≠ WORK_DONE_PENDING_CONFIRMATION; 429/409 on second request within 24 h; success calls citizen write-back (mock) with a valid signature.
5. Sync: bad signature → 401; replayed nonce → 401; stale timestamp → 401; out-of-order seq ignored; idempotent re-send.
6. Login lockout after 5 fails.

citizen copy:
7. `/internal/gov/close-request` on public port 8080 → 404.
8. Write-back appends `CLOSE_REQUESTED_BY_GOV`, does not change `tickets.state`, ledger `verify-chain` still ok.
9. Rejected for wrong state / bad signature / replay.
10. "No" feedback reopens the same ticket, escalation +1.

End-to-end script `NyaySetu_Gov/scripts/e2e.mjs` (run after `compose up` + seeds): seed a ticket to WORK_DONE_PENDING_CONFIRMATION (use citizen demo endpoints/seed) → gov login → close-request → assert citizen `/me/reports` shows pending request → citizen feedback "No" → assert gov detail shows `reopened` within 60 s.

---

## 13. Build order (phases with "done when")

| Phase | Work | Done when |
|---|---|---|
| 0 | Copy citizen folder → `NyaySetu_Full_v2`. Create `NyaySetu_Gov` (apps/api, apps/web, infra/db, data/geo, scripts). Key generation script. | `docker compose up` brings up gov-db + empty gov-api `/healthz` green; citizen copy still runs. |
| 1 | Gov DB schema + migrations + geo seed + admin seed. Auth (login/refresh/logout, EdDSA, lockout, CSRF, helmet). | Test 1 + 6 pass. |
| 2 | Citizen copy: C3, C4, C5, C10. Gov `/internal/sync/batch`. Backfill. | Gov `complaints` table holds all seeded Bhilai + Bengaluru tickets with state/district/city/area filled; test 5 passes. |
| 3 | Gov API: complaints list/groups/detail/kpis/map/reveal/export + RBAC. | Tests 2, 3 pass; curl returns grouped counts. |
| 4 | Gov web: login, dashboard (KPIs, filters, group-by, table), detail, reveal, i18n hi/en. | Can log in, switch Group by across all 5 options, reveal a number, toggle Hindi. |
| 5 | Heat map (all zoom levels, ±25 m label, filters wired). | India shows only Bhilai & Bengaluru heated; zoom into Bhilai shows wards then points. |
| 6 | Close request: gov endpoint + citizen C6, C7, C9 (banner, verify, re-report), C8 crons. | Test 4, 7–10 pass; manual: request from gov appears on citizen My Problems within ~2 s without refresh. |
| 7 | C1, C2, privacy text, audit-log screen, `e2e.mjs`, `HANDOFF.md`. | e2e passes; all unit tests pass; HANDOFF written. |

If time runs short, cut in this order: audit-log screen → export → area polygons zoom tier (keep points) → C1/C2 (leave as documented TODO). **Never cut:** separation of stacks, signed channels, masked + logged phone reveal, close-request only in WORK_DONE_PENDING_CONFIRMATION, citizen verify/re-report on same ticket.

---

## 14. Honesty / integrity rules

- Say "prototype"; never imply this is an official government site.
- Label approximate polygons and the ±25 m location note.
- Don't invent LGD codes or legal claims — mark unverified data `⚠️ VERIFY` in data files and in `HANDOFF.md`.
- Never log full phone numbers (pino redact paths: `*.phone`, `*.phone_cipher`, `req.headers.authorization`, `req.headers.cookie`).
- No keys in git. `.env` git-ignored in both folders.

---

## APPENDIX A — Verify before relying on it
1. Bhilai's district (Durg) and LGD codes for CG/Durg/Bhilai, KA/Bengaluru Urban/Bengaluru.
2. India boundary file complies with Survey of India depiction.
3. Bengaluru civic structure after the 2025 Greater Bengaluru Authority reorganisation (affects City/Department labels).
4. DPDP Act/Rules provisions on State processing and retention (don't quote rule numbers without the primary notification).
5. Hindi terms against CSTT/Rajbhasha glossary where possible.

## APPENDIX B — Decision log (agent appends here / in HANDOFF.md)
| Date | Decision | Why |
|---|---|---|
| 2026-10-08 | All Locked decisions D1–D17 | Owner, in chat |
| | | |

## APPENDIX C — If the six Gemini Deep Research reports are attached
Read them after this file. Use them for: library choices and versions, India boundary data source, Hindi glossary, security hardening details, KPI SQL. If a report recommends something that contradicts Part 2, follow Part 2 and note the conflict in the decision log.
