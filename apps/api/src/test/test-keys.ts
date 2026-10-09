// Throwaway key pairs for one test run, generated when vitest starts. They are handed to the app through
// env (the same variables production uses) and, for the private halves the citizen stack would hold,
// through TEST_* variables so tests can sign fixtures.
import { generateKeyPairSync } from "node:crypto";

const pair = (type: "ed25519" | "x25519") => {
  const { privateKey, publicKey } = generateKeyPairSync(type as "ed25519");
  return {
    priv: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
    pub: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
  };
};

export function testKeyEnv(): Record<string, string> {
  const jwt = pair("ed25519");
  const sync = pair("ed25519");
  const writeback = pair("ed25519");
  const seal = pair("x25519");
  return {
    GOV_JWT_PRIVATE_KEY: jwt.priv,
    GOV_JWT_PUBLIC_KEY: jwt.pub,
    SYNC_SIGNING_PUBLIC_KEY: sync.pub,
    TEST_SYNC_SIGNING_PRIVATE_KEY: sync.priv,
    GOV_WRITEBACK_PRIVATE_KEY: writeback.priv,
    TEST_WRITEBACK_PUBLIC_KEY: writeback.pub,
    GOV_PHONE_SEAL_PRIVATE_KEY: seal.priv,
    GOV_PHONE_SEAL_PUBLIC_KEY: seal.pub,
    GOV_ADMIN_PASSWORD: "test-admin-password",
    GOV_WEB_ORIGIN: "http://localhost:5174",
  };
}
