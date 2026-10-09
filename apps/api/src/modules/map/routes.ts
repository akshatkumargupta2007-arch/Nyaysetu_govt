// GD1: data for the heat map. Every endpoint honours the same filters and role scope as the table, so the map and the
// table always describe the same complaints. Coordinates are approximate (about +/-25 m) and the web app says so.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { App } from "../../app.js";
import { pool } from "../../db/client.js";
import { GEO_DIR } from "../../lib/paths.js";
import { requireAuth } from "../auth/guard.js";
import { buildWhere, CLOSED_STATES, FilterQuery } from "../complaints/filters.js";
import { join } from "node:path";

const closedList = `ARRAY['${CLOSED_STATES.join("','")}']`;
const MAX_POINTS = 2000;

// The simplified India outline is a static file: load once, serve with a content hash so browsers cache it hard.
let indiaCache: { body: string; etag: string } | null = null;
function india() {
  if (!indiaCache) {
    const body = readFileSync(join(GEO_DIR, "india_states.topojson"), "utf8");
    indiaCache = { body, etag: `"${createHash("sha1").update(body).digest("hex")}"` };
  }
  return indiaCache;
}

export function registerMapRoutes(app: App) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // The base map: public to any signed-in official (still no access without a login).
  typed.get("/api/geo/india", { preHandler: [requireAuth] }, async (req, reply) => {
    const f = india();
    if (req.headers["if-none-match"] === f.etag) return reply.status(304).send();
    return reply.header("ETag", f.etag).header("Cache-Control", "private, max-age=31536000, immutable").type("application/json").send(f.body);
  });

  // Counts for ALL 36 states/UTs (zeros included), so the map can draw the whole country.
  typed.get("/api/map/states", { preHandler: [requireAuth], schema: { querystring: FilterQuery } }, async (req, reply) => {
    const where = buildWhere(req.user!, req.query);
    const { rows } = await pool.query(
      `SELECT gs.code, gs.name, count(c.ticket_id)::int AS count,
              count(c.ticket_id) FILTER (WHERE NOT (c.status = ANY(${closedList})))::int AS open
       FROM geo_states gs LEFT JOIN complaints c ON c.state_code = gs.code AND ${where.sql}
       GROUP BY gs.code, gs.name ORDER BY gs.code`,
      where.params,
    );
    return reply.send({ states: rows, max: Math.max(0, ...rows.map((r) => r.count)) });
  });

  // One circle per city: where the complaints are, at national zoom.
  typed.get("/api/map/cities", { preHandler: [requireAuth], schema: { querystring: FilterQuery } }, async (req, reply) => {
    const where = buildWhere(req.user!, req.query);
    const { rows } = await pool.query(
      `SELECT gc.id, gc.name, gd.state_code, ST_Y(gc.centroid) AS lat, ST_X(gc.centroid) AS lng, count(c.ticket_id)::int AS count,
              count(c.ticket_id) FILTER (WHERE NOT (c.status = ANY(${closedList})))::int AS open
       FROM geo_cities gc JOIN geo_districts gd ON gd.id = gc.district_id
       LEFT JOIN complaints c ON c.city_id = gc.id AND ${where.sql}
       GROUP BY gc.id, gc.name, gd.state_code, gc.centroid ORDER BY count DESC, gc.id`,
      where.params,
    );
    return reply.send({ cities: rows.map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) })), max: Math.max(0, ...rows.map((r) => r.count)) });
  });

  // Ward / sector outlines with their counts (GeoJSON). Approximate outlines say so.
  typed.get(
    "/api/map/areas",
    { preHandler: [requireAuth], schema: { querystring: FilterQuery.extend({ cityId: z.string().min(1).max(80) }) } },
    async (req, reply) => {
      const { cityId, ...filters } = req.query;
      const where = buildWhere(req.user!, filters);
      const { rows } = await pool.query(
        `SELECT ga.id, ga.kind, ga.name, ga.approximate, ST_AsGeoJSON(ST_Multi(ST_SimplifyPreserveTopology(ga.geom, 0.00005)))::json AS geometry,
                count(c.ticket_id)::int AS count,
                count(c.ticket_id) FILTER (WHERE NOT (c.status = ANY(${closedList})))::int AS open
         FROM geo_areas ga LEFT JOIN complaints c ON c.area_id = ga.id AND ${where.sql}
         WHERE ga.city_id = $${where.params.length + 1}
         GROUP BY ga.id, ga.kind, ga.name, ga.approximate, ga.geom ORDER BY ga.id`,
        [...where.params, cityId],
      );
      return reply.send({
        type: "FeatureCollection",
        features: rows.map((r) => ({
          type: "Feature",
          id: r.id,
          geometry: r.geometry,
          properties: { id: r.id, kind: r.kind, name: r.name, approximate: r.approximate, count: r.count, open: r.open },
        })),
        max: Math.max(0, ...rows.map((r) => r.count)),
      });
    },
  );

  // Individual complaints inside the visible map rectangle (clustering is done in the browser).
  typed.get(
    "/api/map/points",
    {
      preHandler: [requireAuth],
      schema: {
        querystring: FilterQuery.extend({
          bbox: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/), // west,south,east,north
        }),
      },
    },
    async (req, reply) => {
      const { bbox, ...filters } = req.query;
      const [w, s, e, n] = bbox.split(",").map(Number) as [number, number, number, number];
      if (w < -180 || e > 180 || s < -90 || n > 90 || w >= e || s >= n) return reply.status(400).send({ error: "Invalid bbox", code: "VALIDATION" });
      const where = buildWhere(req.user!, filters);
      const p = where.params.length;
      const { rows } = await pool.query(
        `SELECT c.ticket_id, c.public_code, c.category_l1, c.status, c.priority_band, ST_Y(c.geom) AS lat, ST_X(c.geom) AS lng
         FROM complaints c
         WHERE ${where.sql} AND c.geom && ST_MakeEnvelope($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, 4326)
         ORDER BY c.created_at DESC LIMIT ${MAX_POINTS + 1}`,
        [...where.params, w, s, e, n],
      );
      const truncated = rows.length > MAX_POINTS;
      return reply.send({
        truncated,
        points: (truncated ? rows.slice(0, MAX_POINTS) : rows).map((r) => ({ id: r.ticket_id, code: r.public_code, l1: r.category_l1, status: r.status, priority: r.priority_band, lat: Number(r.lat), lng: Number(r.lng) })),
      });
    },
  );
}
