// Key helpers. Keys live in env as one-line base64 of DER (PKCS8 private, SPKI public) written by
// scripts/gen-keys.mjs.
import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";

export function privateKeyFromB64(b64: string): KeyObject {
  if (!b64) throw new Error("private key is not configured");
  return createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" });
}

export function publicKeyFromB64(b64: string): KeyObject {
  if (!b64) throw new Error("public key is not configured");
  return createPublicKey({ key: Buffer.from(b64, "base64"), format: "der", type: "spki" });
}
