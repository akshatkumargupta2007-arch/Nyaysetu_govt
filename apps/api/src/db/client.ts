import pg from "pg";
import { env } from "../env.js";

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
