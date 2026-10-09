// Time-series helpers: how a ledger event becomes one `complaint_activity` row (the hypertable that feeds the
// Tiger Data aggregates). The SAME formulas are used in SQL in migration 0004 (backfill), so the two never disagree.

/** The citizen app names the first event REPORT_CREATED; the analytics tables call it REPORT_RECEIVED. */
export const activityKind = (type: string): string => (type === "REPORT_CREATED" ? "REPORT_RECEIVED" : type);

/** Map grid cell (about 500 m): "x:y" in 0.005-degree steps. floor(v/0.005 + 0.5) is used instead of round() so
 *  JavaScript and PostgreSQL agree on exact halves. */
export const CELL_DEGREES = 0.005;
export const cellOf = (lng: number, lat: number): string =>
  `${Math.floor(lng / CELL_DEGREES + 0.5)}:${Math.floor(lat / CELL_DEGREES + 0.5)}`;

/** Centre of a cell id (for drawing the time-lapse map). */
export function cellCentre(cell: string): { lng: number; lat: number } {
  const [x, y] = cell.split(":").map(Number);
  return { lng: (x ?? 0) * CELL_DEGREES, lat: (y ?? 0) * CELL_DEGREES };
}
