// The government portal's way of asking the citizen stack for Closure Court data and AI health. One signed door
// (see the citizen API's modules/gov/bridge.ts). The portal checks the official's scope BEFORE calling.
import { env } from "../env.js";
import { signRequest } from "./signing.js";

export const RPC_PATH = "/internal/gov/rpc";
export class RpcError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function citizenRpc<T = unknown>(op: string, args: Record<string, unknown> = {}, timeoutMs = 25_000): Promise<T> {
  const raw = JSON.stringify({ op, args });
  let res: Response;
  try {
    res = await fetch(`${env.CITIZEN_INTERNAL_URL.replace(/\/$/, "")}${RPC_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...signRequest(env.GOV_WRITEBACK_PRIVATE_KEY, "POST", RPC_PATH, raw) },
      body: raw,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new RpcError(502, "CITIZEN_UNREACHABLE", "Could not reach the citizen app");
  }
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: T; code?: string; error?: string };
  if (!res.ok || !json.ok) throw new RpcError(res.status === 404 ? 404 : res.status >= 500 ? 502 : 400, json.code ?? "RPC_FAILED", json.error ?? "The citizen app refused the request");
  return json.data as T;
}
