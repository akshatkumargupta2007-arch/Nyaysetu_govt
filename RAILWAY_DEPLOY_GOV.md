# NyaySetu GOV PORTAL on Railway: step by step (no thinking needed)

This is for the **gov portal repo only** (`NyaySetu_Gov`). The citizen app is a different repo with its own file, `RAILWAY_DEPLOY_SIMPLE.md`. Both live in **ONE Railway project** so they can talk to each other privately (Part 7 explains why).

Do the steps **in order**. Do not skip. Do not rename anything. If a step says "paste", paste exactly.

## What you are building (3 boxes, none of them has a second website)

```
Browser --> [gov-web]  Railway, public website (nginx)
                |  forwards /api/... privately
                v
            [gov-api]  Railway, NO public address  --->  [gov-db]  Railway, NO public address
                ^  |
   private links |  |  (to/from the citizen app, Part 7)
                |  v
            [citizen-api]  (the other repo, same Railway project)
```

Only **gov-web** has a public address. The API and the database are hidden. That is on purpose.

## Part 0. Before you start

You need:
1. A GitHub account and the **gov repo pushed to GitHub** (Part 1).
2. A Railway account with a card added.
3. The folder **`NYAYSETU_RAILWAY_VARIABLES`** that Arush gave you. It has 4 `.env` files full of secrets. **Never** put it on GitHub, never paste it in chat.
4. The citizen app already (or about to be) in the **same Railway project**, using the other file.

**Service names are fixed.** Create the services with exactly these names (lowercase): `gov-db`, `gov-api`, `gov-web`. The variable files refer to these names, and if you spell one differently, the link silently breaks. The citizen services must be named `citizen-db` and `citizen-api`.

## Part 1. Put the gov code on GitHub

```bash
cd NyaySetu_Gov
git add -A
git commit -m "gov portal ready to deploy"
git remote add origin <the-gov-github-repo-url>
git push -u origin main
```
(If it says `master` instead of `main`, push that branch name.) The `.env` files are already ignored by git. Check on GitHub that there is no `.env` file in the repo.

## Part 2. Railway project

Use the **same project** as the citizen app (name `nyaysetu`). If it does not exist yet: New Project, Empty Project, name it `nyaysetu`.

## Part 3. Service 1 of 3: `gov-db` (the database)

Do **not** use Railway's ready-made Postgres. We need the Tiger Data / TimescaleDB image from the repo.

1. In the project: **New**, **GitHub Repo**, choose the **gov repo**.
2. Open the new service, **Settings**:
   - Name: `gov-db`
   - **Root Directory**: `infra/db`
3. **Variables** tab, **Raw Editor**, paste the whole content of **`1-GOV-DB.env`**, click Update.
4. Add a **Volume**: press `Cmd+K` (or right click on the project canvas), choose "Volume", attach it to `gov-db`, **mount path**: `/home/postgres/pgdata`
5. **Settings, Networking**: do NOT generate a public domain. Nothing public.
6. Wait for the deploy to turn green. In the logs you should see "database system is ready to accept connections".

> If the logs say "permission denied" about `/home/postgres/pgdata`: add one more variable to `gov-db`: `RAILWAY_RUN_UID=0` and redeploy. If it still fails, stop and message Arush; do not try random things.

## Part 4. Service 2 of 3: `gov-api` (the brain)

1. **New**, **GitHub Repo**, choose the **gov repo** again (yes, again; same repo, second service). Leave Root Directory empty (it is the repo root).
2. **Settings**:
   - Name: `gov-api`
   - **Deploy, Pre-deploy command**: paste `npm run migrate:prod && npm run seed:prod`
     (this builds the tables and creates the first admin on every deploy; running it twice is safe)
   - **Deploy, Healthcheck path**: `/healthz`
   - **Replicas**: exactly **1**
   - **Networking**: do **NOT** generate a domain. Nothing public.
3. **Variables, Raw Editor**: paste the whole content of **`2-GOV-API.env`**.
4. **One line you must edit by hand**: `GOV_ADMIN_EMAIL=...` replace the whole value with a real email address (not `@nyaysetu.local`). This is the login name for the portal.
5. **Write down `GOV_ADMIN_PASSWORD`** from that same file. It is the portal password (change the variable and redeploy to change the password).
6. Deploy. In the logs you must see, in this order:
   - `migration complete`
   - `seeded 36 states/UTs ... and the administrator`
   - `NyaySetu Gov API listening` and `internal sync listener on :8091`

   If you see `Unsafe production configuration:` followed by a list, the list tells you exactly which variable is missing or wrong. Fix it and redeploy.

## Part 5. Service 3 of 3: `gov-web` (the website)

1. **New**, **GitHub Repo**, the **gov repo** a third time.
2. **Settings**: Name `gov-web`, Root Directory empty, Replicas 1.
3. **Variables, Raw Editor**: paste the whole content of **`3-GOV-WEB.env`**.
4. **Settings, Networking, Generate Domain**. If it asks for a port, type `80`. You now have the website address, like `https://gov-web-production-xxxx.up.railway.app`. Write it down.
5. Go to **`gov-api`, Variables** and check that `GOV_WEB_ORIGIN` shows that same address (it fills itself from `gov-web`; it must start with `https://` and have no `/` at the end). If you generated the domain AFTER the first `gov-api` deploy, **redeploy `gov-api` once** so it picks the address up.

## Part 6. Open it

Open the `gov-web` address. You should see the sign-in page. Sign in with `GOV_ADMIN_EMAIL` and `GOV_ADMIN_PASSWORD`. You land on Civic Pulse (it is empty until complaints arrive, that is normal).

## Part 7. How the two servers talk (citizen app <-> gov portal)

**Plain English.** The two backends call each other directly, server to server, over Railway's **private network**. No browser is involved, so CORS does not matter for this link. Every message is **digitally signed** (Ed25519), so a stranger cannot fake one even if they could reach the port.

```
CITIZEN-API  --(1) new/updated complaints, signed -->  GOV-API   port 8091  (private)
CITIZEN-API  <--(2) close request, court look-ups, signed --  GOV-API   port 8090  (private)
```

| Link | Who calls | Address used | Port | Variable (where it is set) |
|---|---|---|---|---|
| 1. complaints go to gov | citizen-api | `http://gov-api.railway.internal` | 8091 | `GOV_SYNC_URL` (on citizen-api) |
| 2. gov asks citizen app | gov-api | `http://citizen-api.railway.internal` | 8090 | `CITIZEN_INTERNAL_URL` (on gov-api) |

The variable files already contain these as `${{gov-api.RAILWAY_PRIVATE_DOMAIN}}` and `${{citizen-api.RAILWAY_PRIVATE_DOMAIN}}`. Railway swaps in the real private address by service name. **That is why the names must be exact.**

**Rules that make it work (all must be true):**
1. Both repos' services are in the **same Railway project**. (The private network only exists inside one project.)
2. Ports **8090 and 8091 are never made public**. Do not generate domains for them.
3. The **keys match**. They come in pairs; one half goes to each app:

| Key pair | gov-api has | citizen-api has |
|---|---|---|
| Citizen signs what it sends to gov | `SYNC_SIGNING_PUBLIC_KEY` | `SYNC_SIGNING_PRIVATE_KEY` |
| Gov signs what it sends to citizen | `GOV_WRITEBACK_PRIVATE_KEY` | `GOV_WRITEBACK_PUBLIC_KEY` |
| Phone numbers are locked for gov only | `GOV_PHONE_SEAL_PRIVATE_KEY` (+ public) | `GOV_PHONE_SEAL_PUBLIC_KEY` |

   They were generated together in the `NYAYSETU_RAILWAY_VARIABLES` folder. **Never generate a second set**; a new set on one side breaks the link.

### Connect step (do this once, on the CITIZEN side)

1. Open Railway, service **`citizen-api`**, Variables, **Raw Editor**.
2. At the end, paste the content of **`4-CITIZEN-API-ADD-THESE.env`** (keep everything already there). Update.
3. `citizen-api` redeploys. Its log must now say **`gov sync: on`**.
4. The citizen API must listen on its bridge port: log line `gov bridge listening on :8090 (internal)`.

### Prove the connection works (3 checks)

1. **Citizen -> gov:** on the citizen website file a complaint (voice or text). Within a minute it appears in the gov portal under **Complaints**.
2. **Gov -> citizen:** in the gov portal, sign in as admin and open **System health**. It shows the AI status. If it loads, the gov API can reach the citizen API.
3. **Closure Court:** in the gov portal open **Closure Court** (`/queue`), open the complaint, and the page loads without "citizen app unavailable".

| What you see | What it means | Fix |
|---|---|---|
| Complaint never appears in gov | link 1 broken | citizen log: is `gov sync: on`? `GOV_SYNC_URL` correct? port 8091? |
| Gov log: `signature` / 401 | key pair mismatch | re-paste the 3 key lines in file 4 on citizen-api AND the 3 key lines in file 2 on gov-api from the SAME folder |
| System health: "could not load" | link 2 broken | `CITIZEN_INTERNAL_URL` on gov-api; citizen log `gov bridge listening on :8090` |
| `ENOTFOUND ...railway.internal` | wrong service name or different Railway project | rename the service to the exact name; keep both in one project |
| `ECONNREFUSED` on the private address | the app is only listening on IPv4 | message Arush (Railway's older projects use IPv6 only) |

## Part 8. If something breaks

| Problem | Fix |
|---|---|
| Website opens, login says "could not reach the server" | `gov-web` variable `API_UPSTREAM` wrong, or `gov-api` is not running. Check `gov-api` logs |
| Website shows a blank page | `gov-web` deploy logs; the build probably failed. Redeploy |
| `502 Bad Gateway` on /api | nginx cannot find the API. `NGINX_RESOLVER` must be exactly `[fd12::10]` (with the square brackets); `API_UPSTREAM` must be `http://${{gov-api.RAILWAY_PRIVATE_DOMAIN}}:8081` |
| Login works but you are logged out when you reload | you are using the API's own address instead of the website's. Always open the **gov-web** address. Never open gov-api directly (it has no public address by design) |
| `gov-api` crashes: `Unsafe production configuration` | read the list printed under it; it names the exact variable |
| `gov-api` crashes: `password authentication failed` | `GOV_APP_DB_PASSWORD` or `DATABASE_URL` mismatch between the two lines in file 2. Both must contain the SAME password |
| `migration` fails with `extension "timescaledb"` | `gov-db` is not the repo's database image. Check `gov-db` Root Directory is `infra/db` |
| Pre-deploy says `seed: GOV_ADMIN_EMAIL must be a real address` | you forgot step 4 of Part 4 |
| Bad deploy | Railway, the service, Deployments, "Redeploy" on the previous green one |
| A key leaked | tell Arush; do not rotate by yourself, the two apps must change together |

## What you must NOT do
- Do not commit `.env`, or the `NYAYSETU_RAILWAY_VARIABLES` folder, or paste it in WhatsApp or chat.
- Do not make `gov-api`, `gov-db`, port 8090 or port 8091 public.
- Do not use more than 1 replica of `gov-api`.
- Do not generate new keys. Do not "fix" a 401 by regenerating keys; follow the table above.
- Do not rename services after the variables are pasted.

## Known limits (honest)
- Civic Pulse starts empty. Real complaints fill it in. The big demo data set (millions of rows) is loaded separately by Arush; ask him before the demo.
- `PULSE_SIM=1` (in file 2) switches on the demo buttons. Remove that line for real users.
- Only one administrator exists. Other officials (state, district, city, department) are not created automatically; the administrator uses the "View as" selector to see their screens.
- This guide was written and the pieces tested on a laptop (database image, API, website with the API forwarding). It has not yet been run on Railway itself; the Railway-specific lines (private addresses, `[fd12::10]`, the volume path) follow Railway's documented behaviour. If one of them fails, send the log lines to Arush.
- Gemini keys live on the **citizen** side only. The gov API never calls Gemini directly; it asks the citizen API.

## Cheat sheet (service names and what they need)

| Service | From repo | Root dir | Public? | Variables file |
|---|---|---|---|---|
| gov-db | gov | `infra/db` | no | `1-GOV-DB.env` |
| gov-api | gov | (root) | no | `2-GOV-API.env` (edit the admin email) |
| gov-web | gov | (root) | **yes**, port 80 | `3-GOV-WEB.env` |
| citizen-api | citizen | (root) | yes (website calls it) | existing + `4-CITIZEN-API-ADD-THESE.env` |
