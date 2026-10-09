// GB1: one filter parser + SQL builder shared by the list, the group counts, the KPIs, the map and the CSV
// export, so they can never disagree about what "the current filters" mean. The role scope (GA6) is ALWAYS
// part of the WHERE clause.
import { z } from "zod";
import type { AuthUser } from "../auth/guard.js";
import { scopeWhere } from "../rbac.js";

export const CLOSED_STATES = ["CLOSED_CONFIRMED", "CLOSED_UNCONFIRMED", "REJECTED_NOT_CIVIC"] as const;
export const PRIORITY_RANK_SQL = `CASE c.priority_band WHEN 'Critical' THEN 4 WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 1 ELSE 0 END`;

const csv = z
  .string()
  .max(500)
  .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean))
  .pipe(z.array(z.string().max(100)).max(30));

/** Query-string filters accepted by every complaints endpoint. */
export const FilterQuery = z.object({
  state: csv.optional(),
  district: csv.optional(),
  city: csv.optional(),
  area: csv.optional(),
  department: csv.optional(),
  category_l1: csv.optional(),
  category: csv.optional(),
  status: csv.optional(), // may include the pseudo-value OPEN (everything that is not closed)
  priority: csv.optional(),
  close_request_status: csv.optional(), // requested | confirmed | reopened | unconfirmed | none
  from: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  to: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  q: z.string().trim().max(100).optional(),
});
export type Filters = z.infer<typeof FilterQuery>;

export type Where = { sql: string; params: unknown[] };

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** A search that is exactly four digits is a "last four digits of the phone number" lookup. */
export const isPhoneLast4Query = (q: string | undefined): boolean => Boolean(q && /^\d{4}$/.test(q));

/**
 * @param opts.phoneSearch  match a four-digit `q` against the reporters' last four phone digits. Off by default:
 *   that lookup is a (rate-limited, audited) feature of the complaints list ONLY. Counts, maps, KPIs and exports
 *   never use it, otherwise they would leak the same digits without any record.
 */
export function buildWhere(user: AuthUser, f: Filters, startIndex = 1, opts: { phoneSearch?: boolean } = {}): Where {
  const scope = scopeWhere(user, startIndex);
  const params: unknown[] = [...scope.params];
  const parts: string[] = [`(${scope.sql})`];
  const next = () => startIndex + params.length; // the $n the NEXT pushed param will get
  const inList = (column: string, values?: string[], allowNone = false) => {
    if (!values?.length) return;
    // "none" means "no value" (a complaint that matched no area / no department), only where that makes sense
    const wantsNone = allowNone && values.includes("none");
    const real = allowNone ? values.filter((v) => v !== "none") : values;
    const ors: string[] = [];
    if (real.length) {
      params.push(real);
      ors.push(`${column} = ANY($${next() - 1}::text[])`);
    }
    if (wantsNone) ors.push(`${column} IS NULL`);
    parts.push(`(${ors.join(" OR ")})`);
  };

  inList("c.state_code", f.state);
  inList("c.district_id", f.district);
  inList("c.city_id", f.city);
  inList("c.area_id", f.area, true);
  inList("c.department_id", f.department, true);
  inList("c.category_l1", f.category_l1);
  inList("c.category_code", f.category);
  inList("c.priority_band", f.priority);

  if (f.status?.length) {
    const wantsOpen = f.status.includes("OPEN");
    const exact = f.status.filter((s) => s !== "OPEN");
    const ors: string[] = [];
    if (exact.length) {
      params.push(exact);
      ors.push(`c.status = ANY($${next() - 1}::text[])`);
    }
    if (wantsOpen) {
      params.push([...CLOSED_STATES]);
      ors.push(`NOT (c.status = ANY($${next() - 1}::text[]))`);
    }
    parts.push(`(${ors.join(" OR ")})`);
  }
  if (f.close_request_status?.length) {
    const wantsNone = f.close_request_status.includes("none");
    const exact = f.close_request_status.filter((s) => s !== "none");
    const ors: string[] = [];
    if (exact.length) {
      params.push(exact);
      ors.push(`c.close_request_status = ANY($${next() - 1}::text[])`);
    }
    if (wantsNone) ors.push("c.close_request_status IS NULL");
    parts.push(`(${ors.join(" OR ")})`);
  }
  if (f.from) {
    params.push(f.from);
    parts.push(`c.created_at >= $${next() - 1}::timestamptz`);
  }
  if (f.to) {
    // a plain date means "through the end of that day"
    params.push(f.to);
    parts.push(/^\d{4}-\d{2}-\d{2}$/.test(f.to) ? `c.created_at < ($${next() - 1}::date + 1)` : `c.created_at <= $${next() - 1}::timestamptz`);
  }
  if (f.q) {
    const q = f.q;
    const clauses: string[] = [];
    params.push(`%${likeEscape(q)}%`);
    const like = `$${next() - 1}`;
    clauses.push(`c.public_code ILIKE ${like}`, `c.summary_en ILIKE ${like}`, `c.original_text ILIKE ${like}`);
    if (opts.phoneSearch && isPhoneLast4Query(q)) {
      params.push(q);
      clauses.push(`EXISTS (SELECT 1 FROM complaint_reporters r WHERE r.ticket_id = c.ticket_id AND r.phone_last4 = $${next() - 1})`);
    }
    parts.push(`(${clauses.join(" OR ")})`);
  }
  return { sql: parts.join(" AND "), params };
}
