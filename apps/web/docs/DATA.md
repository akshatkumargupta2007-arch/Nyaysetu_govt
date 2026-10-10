# Data each screen needs

All endpoints need sign-in and are limited to the person's own area on the server. Names of places, departments and categories come from the API in English and Hindi.

| Screen | Needs | Endpoint |
|---|---|---|
| Header | name, role, scope | `GET /api/me` |
| Complaints: list, filters, groups | filters state, district, city, area, department, category, status, priority, verification, dates, search; sort; cursor | `GET /api/complaints`, `/api/complaints/groups` |
| Complaints: 8 numbers | received, open, awaiting, resolved, SLA %, reopened %, confirmed-fix %, average hours | `GET /api/stats/kpis` |
| Complaints: export | CSV that respects filters and scope | `GET /api/export.csv` |
| Complaints: map | cities, areas, points | `GET /api/geo/india`, `/api/map/states`, `/cities`, `/areas`, `/points` |
| Complaints: drawer | summary, original text and language, location, SLA due, merged count, reporters (masked), escalation, timeline | `GET /api/complaints/:id` |
| Complaints: reveal phone | reason (3+ characters); logged before shown; 30 an hour | `POST /api/complaints/:id/reveal-phone` |
| Complaints: request verification | optional note up to 300 characters; once per 24 h | close-request endpoint |
| Audit log | who revealed which number and why; every sensitive action; integrity check | `GET /api/audit/reveals`, `/api/audit/log`, `/api/audit/verify` |

## Rules the screens follow

- Phone numbers are always masked unless revealed with a reason. No personal data in addresses (URLs).
- Anything generated is labelled "Generated".
- Panels never show zero when data failed; they show an error or "unavailable" state.
