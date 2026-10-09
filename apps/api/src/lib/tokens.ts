// Access tokens: Ed25519 (EdDSA) JWTs signed with a key only gov-api holds. Nothing minted by the citizen
// stack (HS256, `kind` claim, different issuer/audience) can ever verify here.
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "../env.js";
import { privateKeyFromB64, publicKeyFromB64 } from "./keys.js";

export const JWT_ISSUER = "nyaysetu-gov";
export const JWT_AUDIENCE = "gov-web";
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 8 * 60 * 60;

export async function signAccessToken(user: { id: string; role: string }, ttlSeconds = ACCESS_TTL_SECONDS): Promise<string> {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "EdDSA" })
    .setSubject(user.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .setJti(randomUUID())
    .sign(privateKeyFromB64(env.GOV_JWT_PRIVATE_KEY));
}

/** Throws unless the token is a valid, unexpired gov access token. */
export async function verifyAccessToken(token: string): Promise<JWTPayload & { sub: string }> {
  const { payload } = await jwtVerify(token, publicKeyFromB64(env.GOV_JWT_PUBLIC_KEY), {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithms: ["EdDSA"], // rejects HS256 and "none"
  });
  // Citizen and officer tokens carry a `kind` claim. A gov token never does.
  if ("kind" in payload) throw new Error("foreign token");
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("no subject");
  return payload as JWTPayload & { sub: string };
}

export const newOpaqueToken = (): string => randomBytes(32).toString("base64url");
export const sha256Hex = (s: string): string => createHash("sha256").update(s).digest("hex");
