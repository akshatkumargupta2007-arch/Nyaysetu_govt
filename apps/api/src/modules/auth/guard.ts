// requireAuth / requireCsrf preHandlers. Every route except login, refresh and healthz uses requireAuth.
import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { pool } from "../../db/client.js";
import { verifyAccessToken } from "../../lib/tokens.js";

export type Role = "NATIONAL" | "STATE" | "DISTRICT" | "CITY" | "DEPARTMENT";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  scopeState: string | null;
  scopeDistrict: string | null;
  scopeCity: string | null;
  scopeDepartment: string | null;
  /** Set only when a National official previews the portal as a narrower role (demo). The real role is kept here. */
  viewingAs?: { realRole: Role };
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export const CSRF_COOKIE = "gov_csrf";

const unauthorized = (reply: FastifyReply) => reply.status(401).send({ error: "Not signed in", code: "UNAUTHORIZED" });

export async function loadUser(id: string): Promise<AuthUser | null> {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, scope_state, scope_district, scope_city, scope_department
     FROM gov_users WHERE id = $1 AND active`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id, name: r.name, email: r.email, role: r.role,
    scopeState: r.scope_state, scopeDistrict: r.scope_district, scopeCity: r.scope_city, scopeDepartment: r.scope_department,
  };
}

/** Valid gov access token + an active user (so a disabled account stops working at once). */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return unauthorized(reply);
  let sub: string;
  try {
    sub = (await verifyAccessToken(header.slice(7))).sub;
  } catch {
    return unauthorized(reply);
  }
  const user = await loadUser(sub);
  if (!user) return unauthorized(reply);
  req.user = applyViewAs(user, req.headers["x-view-as"]);
}

/** Demo scopes for "View as". They only ever NARROW a National official's view; no one else can use the header. */
const VIEW_AS: Record<string, Pick<AuthUser, "role" | "scopeState" | "scopeDistrict" | "scopeCity" | "scopeDepartment">> = {
  STATE: { role: "STATE", scopeState: "CG", scopeDistrict: null, scopeCity: null, scopeDepartment: null },
  DISTRICT: { role: "DISTRICT", scopeState: "CG", scopeDistrict: "CG.DURG", scopeCity: null, scopeDepartment: null },
  CITY: { role: "CITY", scopeState: "CG", scopeDistrict: "CG.DURG", scopeCity: "cg.bhilai", scopeDepartment: null },
  DEPARTMENT: { role: "DEPARTMENT", scopeState: "CG", scopeDistrict: "CG.DURG", scopeCity: "cg.bhilai", scopeDepartment: "cg.bhilai.bmc" },
};
export function applyViewAs(user: AuthUser, header: string | string[] | undefined): AuthUser {
  const want = (Array.isArray(header) ? header[0] : header)?.toUpperCase();
  if (user.role !== "NATIONAL" || !want || !VIEW_AS[want]) return user;
  return { ...user, ...VIEW_AS[want]!, viewingAs: { realRole: "NATIONAL" } };
}

/** Double-submit CSRF: the x-csrf-token header must equal the gov_csrf cookie. */
export async function requireCsrf(req: FastifyRequest, reply: FastifyReply) {
  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.headers["x-csrf-token"];
  const h = Array.isArray(header) ? header[0] : header;
  const a = Buffer.from(cookie ?? "");
  const b = Buffer.from(h ?? "");
  if (!cookie || !h || a.length !== b.length || !timingSafeEqual(a, b)) {
    return reply.status(403).send({ error: "CSRF check failed", code: "CSRF" });
  }
}
