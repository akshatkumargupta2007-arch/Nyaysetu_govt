// Phone sealing: the citizen stack encrypts a phone number so ONLY the gov private key can read it.
// Sealed box built from Node's own crypto (no extra library):
//   random ephemeral X25519 key  ->  ECDH with the gov public key  ->  HKDF-SHA256  ->  AES-256-GCM
// Wire format (base64):  ephemeralPublicKey(SPKI DER, 44 bytes) | iv(12) | authTag(16) | ciphertext
// The citizen stack (NyaySetu_Full_v2) implements `sealPhone` with exactly this layout.
import { createCipheriv, createDecipheriv, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes } from "node:crypto";
import { privateKeyFromB64, publicKeyFromB64 } from "./keys.js";

const INFO = Buffer.from("nyaysetu-phone-seal-v1");
const EPH_LEN = 44; // X25519 SPKI DER length

const deriveKey = (shared: Buffer): Buffer => Buffer.from(hkdfSync("sha256", shared, Buffer.alloc(0), INFO, 32));

export function sealPhone(govPublicKeyB64: string, phone: string): string {
  const eph = generateKeyPairSync("x25519");
  const shared = diffieHellman({ privateKey: eph.privateKey, publicKey: publicKeyFromB64(govPublicKeyB64) });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(shared), iv);
  const ct = Buffer.concat([cipher.update(phone, "utf8"), cipher.final()]);
  const ephPub = eph.publicKey.export({ type: "spki", format: "der" });
  return Buffer.concat([ephPub, iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function openSealedPhone(govPrivateKeyB64: string, sealed: string): string {
  const raw = Buffer.from(sealed, "base64");
  if (raw.length < EPH_LEN + 12 + 16 + 1) throw new Error("sealed phone is too short");
  const ephPub = raw.subarray(0, EPH_LEN);
  const iv = raw.subarray(EPH_LEN, EPH_LEN + 12);
  const tag = raw.subarray(EPH_LEN + 12, EPH_LEN + 28);
  const ct = raw.subarray(EPH_LEN + 28);
  const shared = diffieHellman({
    privateKey: privateKeyFromB64(govPrivateKeyB64),
    publicKey: publicKeyFromB64(ephPub.toString("base64")),
  });
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(shared), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** '9876543221' -> '98XXXXXX21' (first two and last two digits). */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 2)}XXXXXX${d.slice(8)}` : "XXXXXXXXXX";
}
