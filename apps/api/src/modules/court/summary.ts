// What the government database already knows about repair proof: the Closure Court events that sync over with each
// complaint (contract hash, submissions, verdicts). No images and no model output live here.
import { pool } from "../../db/client.js";

export interface ProofSummary { verdict: string | null; submissions: number; lastAt: string | null; contractSource: string | null; sha256: string | null }
const VERDICT_TYPES = ["PROOF_REJECTED_REUSED", "PROOF_NEEDS_MORE", "PROOF_FAILED", "PROOF_CONTESTED", "PROOF_PASSED"];

export async function proofSummaries(ids: string[]): Promise<Map<string, ProofSummary>> {
  const out = new Map<string, ProofSummary>();
  if (!ids.length) return out;
  const { rows } = await pool.query(
    `SELECT ticket_id,
            count(*) FILTER (WHERE type = 'PROOF_SUBMITTED')::int AS submissions,
            (array_agg(payload->>'verdict' ORDER BY seq DESC) FILTER (WHERE type = ANY($2::text[])))[1] AS verdict,
            max(created_at) FILTER (WHERE type <> 'PROOF_CONTRACT_FROZEN') AS last_at,
            (array_agg(payload->>'source' ORDER BY seq DESC) FILTER (WHERE type = 'PROOF_CONTRACT_FROZEN'))[1] AS contract_source,
            (array_agg(payload->>'sha256' ORDER BY seq DESC) FILTER (WHERE type = 'PROOF_CONTRACT_FROZEN'))[1] AS sha256
     FROM complaint_events WHERE ticket_id = ANY($1::uuid[]) AND type LIKE 'PROOF\\_%'
     GROUP BY ticket_id`, [ids, VERDICT_TYPES]);
  for (const r of rows) out.set(r.ticket_id, { verdict: r.verdict, submissions: r.submissions, lastAt: r.last_at, contractSource: r.contract_source, sha256: r.sha256 });
  return out;
}
