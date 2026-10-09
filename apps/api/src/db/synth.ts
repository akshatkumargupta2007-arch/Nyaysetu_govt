// Synthetic time-series data for the Tiger Data layer: lots of labelled, generated complaint events so the
// aggregates, compression and benchmarks have something real to chew on. Every row has synthetic = true.
// Never run against a production database (it refuses). Usage: npm run synth -- 2000000 [--clear]
import pg from "pg";

const CATS = ["ROADS", "STREETLIGHTS", "WATER", "SANITATION", "DRAINAGE", "GARBAGE", "PARKS", "TRAFFIC"];

export async function synth(databaseUrl: string, tickets: number, opts: { clear?: boolean; days?: number; hotspot?: boolean } = {}): Promise<number> {
  const days = opts.days ?? 90;
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const realRows = opts.clear ? Number((await client.query("SELECT count(*) AS n FROM complaint_activity WHERE NOT synthetic")).rows[0].n) : 0;
    if (opts.clear && realRows === 0) {
      // Nothing real to protect: truncating is instant and leaves no dead index space behind.
      await client.query("TRUNCATE complaint_activity, complaint_activity_plain");
      await client.query("DELETE FROM alerts WHERE synthetic");
    } else if (opts.clear) {
      // Old chunks are compressed; deleting from them needs the per-statement decompression cap lifted.
      await client.query("SET timescaledb.max_tuples_decompressed_per_dml_transaction = 0");
      await client.query("DELETE FROM complaint_activity WHERE synthetic");
      await client.query("DELETE FROM complaint_activity_plain WHERE synthetic");
    }
    await client.query("SELECT setseed(0.42)");
    // One generated ticket = a lifecycle of 4-6 events. Volume has a weekday rhythm and a morning/evening swell; the
    // category mix differs per city; fixes take a few hours to a few days; about 8% of fixes are reopened.
    const { rowCount } = await client.query(
      `WITH cities AS (SELECT gc.id AS city_id, gd.id AS district_id, gd.state_code, ST_X(gc.centroid) AS lng, ST_Y(gc.centroid) AS lat,
                              row_number() OVER (ORDER BY gc.id) AS rn, count(*) OVER () AS n FROM geo_cities gc JOIN geo_districts gd ON gd.id = gc.district_id),
       t AS (
         SELECT gen_random_uuid() AS ticket_id, g,
                date_trunc('day', now() - floor(random() * $2::int) * interval '1 day')
                  + (CASE WHEN random() < 0.6 THEN 8 + floor(random() * 4)::int + (CASE WHEN random() < 0.45 THEN 9 ELSE 0 END) ELSE floor(random() * 24)::int END) * interval '1 hour'
                  + random() * interval '1 hour' AS born,
                (floor(random() * (SELECT count(*) FROM geo_cities)) + 1)::int AS rn,
                ($3::text[])[1 + floor(random() * 8)::int] AS cat,
                (ARRAY['Low','Medium','Medium','High','Critical'])[1 + floor(random() * 5)::int] AS band,
                random() AS r_fix, random() AS r_re, random() AS r_conf
         FROM generate_series(1, $1::int) g),
       tk AS (
         SELECT t.*, c.city_id, c.district_id, c.state_code,
                c.city_id || '.dept' || (1 + (t.g % 3)) AS dept,
                c.lng + (random() + random() + random() - 1.5) * 0.05 AS lng, c.lat + (random() + random() + random() - 1.5) * 0.05 AS lat,
                (24 + random() * 48) * interval '1 hour' AS sla
         FROM t JOIN cities c ON c.rn = t.rn),
       ev AS (
         SELECT tk.*, s.seq, s.kind, s.fr, s.tg,
                tk.born + CASE s.seq
                  WHEN 1 THEN interval '0' WHEN 2 THEN interval '20 minutes'
                  WHEN 3 THEN (0.5 + power(tk.r_fix, 2.2) * 72) * interval '1 hour'
                  WHEN 4 THEN (0.5 + power(tk.r_fix, 2.2) * 72) * interval '1 hour' + (1 + tk.r_conf * 30) * interval '1 hour'
                  WHEN 5 THEN (0.5 + power(tk.r_fix, 2.2) * 72) * interval '1 hour' + (2 + tk.r_conf * 40) * interval '1 hour'
                END AS at
         FROM tk CROSS JOIN LATERAL (VALUES
           (1,'REPORT_RECEIVED',NULL,'SUBMITTED'), (2,'STATE_CHANGED','SUBMITTED','ASSIGNED'),
           (3,'STATE_CHANGED','ASSIGNED','WORK_DONE_PENDING_CONFIRMATION'),
           (4,'STATE_CHANGED','WORK_DONE_PENDING_CONFIRMATION', CASE WHEN tk.r_re < 0.08 THEN 'REOPENED' ELSE 'CLOSED_CONFIRMED' END)
         ) AS s(seq, kind, fr, tg)
         WHERE s.seq <= CASE WHEN tk.r_conf > 0.12 THEN 4 ELSE 3 END)
       INSERT INTO complaint_activity (at, ticket_id, seq, kind, from_state, to_state, state_code, district_id, city_id, department_id,
                                       category_l1, priority_band, cell, age_hours, sla_breached, synthetic)
       SELECT at, ticket_id, seq, kind, fr, tg, state_code, district_id, city_id, dept, cat, band,
              (floor(lng / 0.005 + 0.5)::int)::text || ':' || (floor(lat / 0.005 + 0.5)::int)::text,
              extract(epoch FROM (at - born)) / 3600.0, at > born + sla, true
       FROM ev WHERE at <= now() AND born <= now()
       ON CONFLICT DO NOTHING`,
      [tickets, days, CATS],
    );
    let total = rowCount ?? 0;
    if (opts.hotspot !== false) {
      // A planted cluster so the hotspot detector has something to find: 30 water reports in one cell, last 3 hours.
      const r = await client.query(
        `INSERT INTO complaint_activity (at, ticket_id, seq, kind, to_state, state_code, district_id, city_id, category_l1, priority_band, cell, age_hours, synthetic)
         SELECT now() - random() * interval '3 hours', gen_random_uuid(), 1, 'REPORT_RECEIVED', 'SUBMITTED', gd.state_code, gd.id, gc.id, 'WATER', 'High',
                (floor(ST_X(gc.centroid) / 0.005 + 0.5)::int)::text || ':' || (floor(ST_Y(gc.centroid) / 0.005 + 0.5)::int)::text, 0, true
         FROM (SELECT * FROM geo_cities ORDER BY id LIMIT 1) gc JOIN geo_districts gd ON gd.id = gc.district_id, generate_series(1, 30)`);
      total += r.rowCount ?? 0;
    }
    await client.query("CALL refresh_continuous_aggregate('activity_hourly', NULL, NULL)");
    for (const v of ["activity_daily", "activity_weekly", "cell_daily", "resolution_daily", "sla_hourly"]) {
      await client.query(`CALL refresh_continuous_aggregate('${v}', NULL, NULL)`);
    }
    // Compress everything older than a day now instead of waiting for the policy (it runs on a schedule).
    await client.query(`SELECT compress_chunk(c, if_not_compressed => true) FROM show_chunks('complaint_activity', older_than => interval '1 day') c`);
    // Compression leaves the emptied originals as dead space until vacuumed (autovacuum would get there eventually).
    await client.query("VACUUM complaint_activity");
    await client.query("REINDEX TABLE complaint_activity"); // the emptied originals keep their old index pages until rebuilt
    await client.query("VACUUM complaint_activity_plain");
    return total;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("synth.ts") || process.argv[1]?.endsWith("synth.js")) {
  if (process.env.NODE_ENV === "production") throw new Error("synth refuses to run in production");
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("set MIGRATE_DATABASE_URL (owner role) or DATABASE_URL");
  const n = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 100000);
  const rows = await synth(url, n, { clear: process.argv.includes("--clear") });
  console.log(`inserted ${rows} synthetic activity rows (${n} tickets)`);
}
