// Signed requests between the citizen and gov stacks (Bible 4.1 / 8). Ed25519 over
//   METHOD | path | timestamp(ms) | nonce | sha256hex(body)
// A different key pair is used per direction, so neither side can forge the other's messages.
import { createHash, randomBytes, sign, verify } from "node:crypto";
import { privateKeyFromB64, publicKeyFromB64 } from "./keys.js";

export const MAX_SKEW_MS = 60_000;
export const NONCE_TTL_MS = 10 * 60_000;

export const bodySha256 = (body: string | Buffer): string => createHash("sha256").update(body).digest("hex");

export const signingString = (method: string, path: string, ts: string, nonce: string, bodyHash: string): string =>
  `${method.toUpperCase()}|${path}|${ts}|${nonce}|${bodyHash}`;

export type SignedHeaders = { "x-sync-timestamp": string; "x-sync-nonce": string; "x-sync-signature": string };

export function signRequest(privateKeyB64: string, method: string, path: string, body: string, now = Date.now()): SignedHeaders {
  const ts = String(now);
  const nonce = randomBytes(16).toString("base64url");
  const sig = sign(null, Buffer.from(signingString(method, path, ts, nonce, bodySha256(body))), privateKeyFromB64(privateKeyB64));
  return { "x-sync-timestamp": ts, "x-sync-nonce": nonce, "x-sync-signature": sig.toString("base64") };
}

export type VerifyResult = { ok: true; nonce: string } | { ok: false; reason: "missing" | "stale" | "bad_signature" };

/** Checks the signature and the clock window. The caller must still record the nonce (replay defence). */
export function verifySignedRequest(
  publicKeyB64: string,
  method: string,
  path: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  now = Date.now(),
): VerifyResult {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const ts = one(headers["x-sync-timestamp"]);
  const nonce = one(headers["x-sync-nonce"]);
  const sig = one(headers["x-sync-signature"]);
  if (!ts || !nonce || !sig || !/^\d+$/.test(ts) || nonce.length < 8 || nonce.length > 100) return { ok: false, reason: "missing" };
  if (Math.abs(now - Number(ts)) > MAX_SKEW_MS) return { ok: false, reason: "stale" };
  let ok = false;
  try {
    ok = verify(null, Buffer.from(signingString(method, path, ts, nonce, bodySha256(rawBody))), publicKeyFromB64(publicKeyB64), Buffer.from(sig, "base64"));
  } catch {
    ok = false;
  }
  return ok ? { ok: true, nonce } : { ok: false, reason: "bad_signature" };
}
