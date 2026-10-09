// GB5: GET /api/stats/kpis. Same filters and role scope as the list, so the strip always describes the table.
//
// Definitions (shown to officials as tooltips in the web app):
//   received            every complaint matching the filters
//   open                not yet closed (anything except CLOSED_CONFIRMED / CLOSED_UNCONFIRMED / REJECTED_NOT_CIVIC)
//   awaitingCitizen     work reported done, waiting for the citizen to confirm
//   resolved            closed after work: CLOSED_CONFIRMED + CLOSED_UNCONFIRMED
//   workDone            complaints where field work was reported done at least once (the denominator for the rates)
//   avgResolutionHours  mean of (work done - received) over workDone
//   slaBreachedPct      of complaints with an SLA: still open past the deadline, or finished after it
//   reopenPct           workDone complaints the citizen reopened at least once
//   confirmedFixRate    workDone complaints the citizen confirmed (CLOSED_CONFIRMED)
//   unconfirmedRate     workDone complaints that closed by the 7-day timeout without a reply
// Rates are percentages with one decimal, or null when there is nothing to divide by.
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { App } from "../../app.js";
import { pool } from "../../db/client.js";
import { requireAuth } from "../auth/guard.js";
import { buildWhere, CLOSED_STATES, FilterQuery } from "../complaints/filters.js";

const closedList = `ARRAY['${CLOSED_STATES.join("','")}']`;
const pct = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

export function registerStatsRoutes(app: App) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/api/stats/kpis", { preHandler: [requireAuth], schema: { querystring: FilterQuery } }, async (req, reply) => {
    const where = buildWhere(req.user!, req.query);
    const { rows } = await pool.query(
      `SELECT
         count(*)::int                                                                           AS received,
         count(*) FILTER (WHERE NOT (c.status = ANY(${closedList})))::int                        AS open,
         count(*) FILTER (WHERE c.status = 'WORK_DONE_PENDING_CONFIRMATION')::int               AS awaiting,
         count(*) FILTER (WHERE c.status IN ('CLOSED_CONFIRMED','CLOSED_UNCONFIRMED'))::int      AS resolved,
         count(*) FILTER (WHERE c.resolved_at IS NOT NULL)::int                                  AS work_done,
         avg(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600.0) FILTER (WHERE c.resolved_at IS NOT NULL) AS avg_hours,
         count(*) FILTER (WHERE c.sla_due_at IS NOT NULL)::int                                   AS with_sla,
         count(*) FILTER (WHERE c.sla_due_at IS NOT NULL AND (
              (c.resolved_at IS NULL AND NOT (c.status = ANY(${closedList})) AND c.sla_due_at < now())
           OR (c.resolved_at IS NOT NULL AND c.resolved_at > c.sla_due_at)))::int                AS sla_breached,
         count(*) FILTER (WHERE c.resolved_at IS NOT NULL AND c.reopen_count > 0)::int           AS reopened,
         count(*) FILTER (WHERE c.status = 'CLOSED_CONFIRMED' AND c.resolved_at IS NOT NULL)::int AS confirmed,
         count(*) FILTER (WHERE c.status = 'CLOSED_UNCONFIRMED' AND c.resolved_at IS NOT NULL)::int AS unconfirmed
       FROM complaints c WHERE ${where.sql}`,
      where.params,
    );
    const r = rows[0]!;
    return reply.send({
      kpis: {
        received: r.received,
        open: r.open,
        awaitingCitizen: r.awaiting,
        resolved: r.resolved,
        workDone: r.work_done,
        avgResolutionHours: r.avg_hours == null ? null : Math.round(Number(r.avg_hours) * 10) / 10,
        slaBreachedPct: pct(r.sla_breached, r.with_sla),
        reopenPct: pct(r.reopened, r.work_done),
        confirmedFixRate: pct(r.confirmed, r.work_done),
        unconfirmedRate: pct(r.unconfirmed, r.work_done),
      },
      generatedAt: new Date().toISOString(),
    });
  });
}
