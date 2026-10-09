# NyaySetu Gov: handoff

Written 2026-10-08 after an unattended build. **Prototype. Not an official government website.**
Built from `GOVERNMENT_BIBLE.md` and `GOV_BUILD_MAP.md`; the six research reports were read and used for the how (see Decisions).

## 1. What exists now

| Folder | What it is |
|---|---|
| `A:\Nyaysetu_main\NyaySetu_Full` | **Your original citizen app. Not touched** (it still shows the same 84 uncommitted files it had before I started). |
| `A:\Nyaysetu_main\NyaySetu_Full_v2` | A copy of it with the government bridge added (all citizen-side changes live only here). Git history kept; 8 local commits after the baseline commit. |
| `A:\Nyaysetu_main\NyaySetu_Gov` | The new, completely separate government portal (own API, own database, own web app, own keys). about 40 local commits. Nothing was pushed anywhere. |

## 2. The loop, working end to end (verified)

1. A citizen files a complaint. The citizen app **pushes** the ticket to the gov portal (signed, phone number sealed so only gov can open it).
2. A field team marks the work done. The gov portal shows "Work done – awaiting citizen" within seconds.
3. An official opens the complaint, can **reveal the phone number** (logged against their name first), and presses **Request closure** with an optional note.
4. The citizen's open app hears it **live** (about 50 ms in my runs) and shows a prominent **"Verify resolution"** banner at the top of My Problems.
5. The citizen answers:
   - **Yes** closes the complaint (only the citizen can ever close it).
   - **No** opens a **re-report screen** (voice box, photo box, text box, same look as the original report flow). Sending **reopens the same complaint** (same number, escalation +1).
6. The gov portal then shows "Citizen reopened".

`node scripts/e2e.mjs` checks all of that automatically (13 checks). It passed repeatedly against my local servers (5 times in a row at the end) and 3 times against the Docker stack, the last time after rebuilding the containers.

## 3. How to run it

**Everything in Docker (recommended):**
```
cd A:\Nyaysetu_main\NyaySetu_Gov
npm run up:all          # builds and starts 6 containers
npm run init:all        # first time only: creates both databases and loads reference data
npm run e2e             # proves the whole loop
npm run down:all        # stop
```
- Gov portal http://localhost:5174, gov API :8081. Citizen app http://localhost:5175, citizen API :8082 (these ports keep it away from your original stack on 8080/5173).
- `init:all` needs the Gemini key already in `NyaySetu_Full_v2\.env` (the knowledge base is embedded). It skips the 150 fake demo tickets (`SEED_SKIP_HISTORY=1`), because a free Gemini key cannot embed that many per minute.

**Logins**
- Gov admin: `admin@nyaysetu.local`, password = `GOV_ADMIN_PASSWORD` in `NyaySetu_Gov\.env` (generated; I did not print it anywhere). Four other role users exist but are switched off (for RBAC tests).
- Citizen app: any phone number; the demo code is the fixed OTP from `NyaySetu_Full_v2\.env` (`123456`).
- Demo field officer used by the helper script: `cg.bhilai.bmc_field_supervisor`, passcode `1234` (demo seed data only).

**What is running on your machine right now** (stop them when you are done):
- the Docker stack above (6 containers);
- your original stack: its Postgres container on :5432, plus the original API (:8080) and web (:5173) as normal processes;
- a standalone gov test database on :5433 (`docker compose up -d gov-db` in `NyaySetu_Gov`), which the gov unit tests need.

**Demo helper:** `node scripts/demo-workdone.mjs [BHI-26-xxxxxx]` moves one complaint to "work done" through the real officer endpoints, so you can show the loop live. `E2E_STOP_AFTER_REQUEST=1 node scripts/e2e.mjs` runs the loop up to the official's request and stops, printing a phone number to log in as.

**Tests:** gov `cd apps/api && npx vitest run` (11 files, 132 tests). Citizen copy `cd NyaySetu_Full_v2\apps\api && npx vitest run` (26 files, 185 tests; the original had 133). Each uses its own test database; neither touches your dev data.

## 4. What was built (by ticket)

All of the Build Map, with CA9 only half done (see section 5): G01–G03, GA1–GA6, GB1–GB7, GC0–GC8, GD1–GD5, CA1–CA8, CB1–CB4, GX1–GX5. Line-by-line status is in `PROGRESS.md`.
Highlights: separate stacks with signed channels (Ed25519 both ways, nonce replay table, ±60 s clock); phone numbers sealed with X25519 + AES-GCM; role scoping on every query (fails closed); hash-linked audit log that the application's database role cannot edit; heat map with five zoom levels; Hindi/English throughout; CSV export that is safe in Excel.

## 5. Not done, or only partly

- **CA9 (officer login hardening) is half done:** officer passcodes are now bcrypt (old SHA-256 hashes upgrade on first login; the login is rate-limited and least-privilege). **Still not done:** officers and citizens in the citizen app still share one `JWT_SECRET` (no separate `OFFICER_JWT_SECRET` or audience claims). The gov portal is unaffected (it rejects any token with a `kind` claim or the wrong algorithm, issuer or audience; tested).
- **Gov web has no production image** (only a dev Dockerfile). The gov **API** production image builds and its startup check works.
- **Mocks (GC0 "mock layer"):** skipped on purpose; the real API existed first.
- **TOTP / 2FA** for officials: the column exists, nothing uses it.
- **Real voice/camera on the re-report screen:** the screen is built and the logic mirrors the Speak/Photo screens, but the browser pane I tested in blocks the microphone and camera, so it needs one try on a real phone. Typing and sending were tested through the real screens.
- **Translations of the new citizen strings:** Hindi + English only; the other 9 languages show the English text for the 5 new strings and the privacy line.
- **Bengaluru shows zero.** The citizen data folder for `ka.bengaluru` is an empty placeholder, so only Bhilai can be "hot". (The Bible assumed both.) The geography for Bengaluru is in place, so it will light up as soon as that tenant has data.
- The two demo **sealed-phone** facts to remember: only tickets filed by a logged-in citizen have a phone number; the old history seed tickets have none.

## 6. Decisions I took alone (also for the Bible's Appendix B)

1. Named the copy `NyaySetu_Full_v2` (the Bible's name) although you said "full 2".
2. Gov DB access with plain `pg` + SQL instead of Drizzle (the PostGIS and counting queries are clearer in SQL). The schema is in `apps/api/sql/*.sql`.
3. Phone sealing uses Node's built-in crypto (X25519 → HKDF → AES-256-GCM) rather than libsodium; format documented in `lib/phone-seal.ts` and copied into the citizen side.
4. The "No" answer uses the **existing** `POST /reports/:id/confirm-closure` (which already reopens the same ticket and escalates) rather than creating a `/feedback` route; I extended it with an optional new photo.
5. **The 7 days count from when the work was marked done, not from the official's request** (so asking the citizen to verify never gives them extra time). Tested.
6. KPI definitions are in the header comment of `modules/stats/routes.ts` (shown as tooltips). Rates use "work reported done" as the denominator.
7. The sync wire format needs `phone_last4` (for "search by last 4 digits") and UUID report ids; the citizen side sends both. Only `CLOSE_REQUESTED_BY_GOV` event payloads are shared with gov (officer notes, proof and citizen text never leave the citizen side).
8. Added a `PHONE_ERASED` ledger note on the citizen side so the 180-day erasure also reaches gov at the next sync.
9. The "please verify" banner is at the top of My Problems on every tab (and on the card), because "work done" cards sit under the *Fixed* tab and would otherwise be easy to miss.
10. The gov access token lives in memory only; the CSRF token in `sessionStorage`; the refresh token is an httpOnly cookie that rotates, and reusing an old one ends the whole session family.
11. Plain CSS with design tokens instead of CSS modules; heat colours use a log scale so one big city does not wash out the rest.
12. The gov API's CORS sends no headers at all to other origins (a stricter function check rather than a fixed allowed origin).
13. Citizen tests were moved to their own database (`nyaysetu_v2_test`) after my sync tests polluted the dev database.
14. Research reports: read the two short ones in full and searched the four long ones. They agreed with the Bible (transactional-outbox style sync, per-citizen live stream with replay, H3 aggregation, partitioning/materialised views at scale). I did **not** add partitioning or materialised views (the Bible says plain `GROUP BY` is enough at demo scale; revisit past about a million rows) and did not add event-id replay to the live stream (the app re-fetches on reconnect instead, which is simpler and cannot miss anything).
15. Duplicate detection is the original app's: two reports at the same place about the same problem merge into one complaint ("one ticket, many voices"). My e2e script uses a unique place each run for that reason.

## 7. Things to check yourself (⚠️ VERIFY)

- **Geography codes:** the LGD codes in `data/geo/states.json` were written from memory and are all marked `verified:false`; Bhilai's district (Durg) and its codes need confirming; Bengaluru's post-2025 civic structure too.
- **India outline:** `data/geo/india_states.topojson` comes from DataMeet's public `states.geojson`, simplified to 785 KB. It shows J&K with Gilgit-Baltistan and Aksai Chin and Arunachal in full, but it predates the 2019 split (Ladakh is inside the J&K shape; Dadra & Nagar Haveli and Daman & Diu are two shapes). **Check against Survey of India before any public use.**
- The Hindi wording in `src/i18n/hi.json` and the citizen strings is machine-written: have someone review it against the official glossary.
- DPDP / CERT-In points (retention, log retention, incident reporting) are noted in the research but I did not check primary notifications; do not quote rule numbers from my notes.
- Ward and sector outlines for Bhilai are the original app's hand-drawn approximate shapes (dashed on the map).

## 8. Security notes

- Separate keys, databases and networks; tokens from the citizen app or its officers are rejected by gov (algorithm, issuer, audience and the absence of a `kind` claim are all enforced; tested).
- `sync_net` is an internal Docker network; ports 8090/8091 are not published; the two databases cannot see each other (verified from inside the containers).
- Phone numbers: stored sealed, shown masked, revealed only after a log row is written, 30 per official per hour, never in logs or CSV. The application database role can insert into the reveal log and audit log but not update or delete them (tested as that role).
- Logs: I scanned both stacks' logs after the e2e run. Found and fixed one leak I had introduced (the live-stream token in the citizen request log); it is redacted now and unit-tested.
- `npm audit`: 2 moderate findings in `react-router` 6 (open redirect via backslash; SSR hydration). Not reachable here (no server rendering; only fixed internal routes). The fix is the breaking v7 upgrade, which I did not force. Same finding exists in your original citizen app.
- The original citizen demo still logs the OTP code outside production by design; its startup safety check stops that in production.
- Before any real deployment: set a real `gov_app` database role (the migration creates it when `GOV_APP_DB_PASSWORD` is set), HTTPS everywhere, `NODE_ENV=production` (the gov API then refuses to start with missing keys, the default DB password, or a non-https web address), and rotate every key (`npm run gov:keys -- --force`, on both sides together).

## 9. Known rough edges

- The first sync after a restart can take up to 30 seconds (the sweep interval); changes made through the app normally arrive in a few seconds.
- The browser pane could not show the microphone prompt; mic/camera need a real device.
- Fake `TEST-*` tickets from earlier test runs were removed from the dev copy, but your original dev database still contains whatever your own testing created (135 tickets).
