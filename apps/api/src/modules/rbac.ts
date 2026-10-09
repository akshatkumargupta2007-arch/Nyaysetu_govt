// GA6: row-level scope. Every query that reads complaints, maps, stats or phone numbers appends this fragment
// so an official only ever sees their own state / district / city / department. It fails CLOSED: a role
// whose scope value is missing sees nothing.
import { pool } from "../db/client.js";
import type { AuthUser } from "./auth/guard.js";

export type Scope = { sql: string; params: unknown[] };

/**
 * @param startIndex  first $n placeholder the fragment may use (so it composes with other filters)
 * @param alias       table alias of `complaints` in the query
 */
export function scopeWhere(user: AuthUser, startIndex = 1, alias = "c"): Scope {
  const col = (name: string) => `${alias}.${name}`;
  const parts: string[] = [];
  const params: unknown[] = [];
  const need = (column: string, value: string | null) => {
    if (!value) {
      parts.push("FALSE"); // misconfigured scope: show nothing
      return;
    }
    params.push(value);
    parts.push(`${col(column)} = $${startIndex + params.length - 1}`);
  };

  switch (user.role) {
    case "NATIONAL":
      return { sql: "TRUE", params: [] };
    case "STATE":
      need("state_code", user.scopeState);
      break;
    case "DISTRICT":
      need("district_id", user.scopeDistrict);
      break;
    case "CITY":
      need("city_id", user.scopeCity);
      break;
    case "DEPARTMENT":
      need("department_id", user.scopeDepartment);
      if (user.scopeCity) need("city_id", user.scopeCity); // a department user may also be pinned to one city
      break;
    default:
      return { sql: "FALSE", params: [] };
  }
  return { sql: parts.join(" AND "), params };
}

/** True when the ticket exists AND is inside the user's scope. (A ticket outside scope looks like "not found".) */
export async function assertTicketInScope(user: AuthUser, ticketId: string): Promise<boolean> {
  const scope = scopeWhere(user, 2);
  const { rowCount } = await pool.query(`SELECT 1 FROM complaints c WHERE c.ticket_id = $1 AND ${scope.sql}`, [ticketId, ...scope.params]);
  return (rowCount ?? 0) > 0;
}
