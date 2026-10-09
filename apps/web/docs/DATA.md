# Data each screen needs

All endpoints need sign-in and are limited to the person's own area on the server. Names of places, departments and categories come from the API in English and Hindi. Every row of activity and every alert carries a `synthetic` flag, and generated rows are labelled in the screens.

Existing endpoints are marked "exists". Everything marked "planned" is to be built to match these screens.

| Screen | Needs | Endpoint |
|---|---|---|
| Header | name, role, scope | `GET /api/me` (exists) |
| Civic Pulse: heartbeat strip | `eps`, `reportsLastHour`, `totalEvents`, `feed[]`, `sim`, `simAllowed` | `GET /api/pulse/live` (exists) |
| Civic Pulse: engine line | version, hypertables, continuous aggregates, compressed chunks, policy jobs | `GET /api/pulse/engine` (exists) |
| Civic Pulse: forecast | `points[{t, actual, expected, lower, upper}]` | `GET /api/pulse/forecast` (exists) |
| Civic Pulse: trends | `series[{t, received, work_done, confirmed, reopened}]`, `grain=hour|day|week` | `GET /api/pulse/trend` (exists) |
| Civic Pulse: fix time | `series[{t, work_done, median_hours, p90_hours}]` | `GET /api/pulse/resolution` (exists) |
| Civic Pulse: missed deadlines | `series[{t, work_done, breached, breached_pct}]` | `GET /api/pulse/sla` (exists) |
| Civic Pulse: time-lapse map | `cells[{t, cell, lat, lng, received, reopened, city_id}]`, `cities[]`, `from`, `to`, `category_l1` | `GET /api/pulse/cells` (exists) |
| Civic Pulse: alerts | `id, time, kind, city, category, observed, expected, zscore, status, explanation{cell, rule}, lat, lng, synthetic` | `GET /api/pulse/alerts` (exists) |
| Civic Pulse: simulator | `{action: start|stop|surge, rate}` | `POST /api/pulse/sim` (exists) |
| Civic Pulse: closure integrity | per department and per day: passed first time, needed more evidence, rejected as reused, contested; groups under 5 hidden | planned |
| Alert detail | the alert above, its complaints, history of alerts for the cell; actions acknowledge, note, false alarm (status and notes) | `GET /api/pulse/alerts`, `GET /api/complaints?area=` (exist); alert actions and per-cell endpoint planned |
| Complaints: list, filters, groups | filters state, district, city, area, department, category, status, priority, verification, dates, search; sort; cursor | `GET /api/complaints`, `/api/complaints/groups` (exist) |
| Complaints: 8 numbers | received, open, awaiting, resolved, SLA %, reopened %, confirmed-fix %, average hours | `GET /api/stats/kpis` (exists) |
| Complaints: export | CSV that respects filters and scope | `GET /api/export.csv` (exists) |
| Complaints: map | cities, areas, points | `GET /api/map/states`, `/cities`, `/areas`, `/points` (exist) |
| Complaints: drawer | summary, original text and language, location, SLA due, merged count, reporters (masked), escalation, timeline | `GET /api/complaints/:id` (exists) |
| Complaints: reveal phone | reason (3+ characters); logged before shown; 30 an hour | `POST /api/complaints/:id/reveal-phone` (exists) |
| Complaints: request verification | optional note up to 300 characters; once per 24 h | close-request endpoint (exists); latest proof verdict field planned |
| Closure Court (one complaint) | contract (claim, criteria, version, source, hash), submissions (files, time, GPS, distance, hash), gate results, per-condition assessments (pass A, pass B, observation, cannot establish, confidence, objection, merged status), verdict and rule, next evidence, ledger events | planned |
| Closure Court: submit, Open Challenge, replay, reset | upload of up to 4 photos or one clip up to 15 s; scenario fixtures | planned |
| Review queue | latest verdict, number of proofs, last activity, contract source, scenario tag; filters by verdict, department, age | planned |
| Scorecard | run date, models, counts, false-pass rate, confusion table, per-condition agreement, schema-valid rate, disagreement rate, gate hit rates, latency, tokens, cost, failing cases with images, trend, safety suite | planned (stored evaluation runs) |
| Ask the City | question, the query form the AI filled (`view, metrics, group_by, filters, time{from,to,grain}, order_by, limit`), result rows, timing, scope applied | planned |
| Benchmark and receipts | race: three questions on plain, hypertable and summary; storage; rows real vs generated; chunks; policies and last runs; summary lag; past runs | `GET /api/pulse/race`, `/api/pulse/engine` (exist); history planned |
| System health | per model and purpose: calls, errors, average and 95th percentile per minute; circuit state; fallback chain; error kinds; start-up check; degraded flags | `GET /api/pulse/ai-health` (exists); circuit and fallback data planned |
| Audit log | who revealed which number and why; every sensitive action; integrity check | `GET /api/audit/reveals`, `/api/audit/log`, `/api/audit/verify` (exist) |

## Rules the screens follow

- Phone numbers are always masked unless revealed with a reason. No personal data in addresses (URLs).
- Anything generated is labelled "Generated". Template contracts are labelled "Template (AI unavailable)". Recorded runs are labelled "Replay" with the date.
- Panels never show zero when data failed; they show an error or "unavailable" state.
