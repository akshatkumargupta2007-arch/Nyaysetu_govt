import { hash, verify } from "@node-rs/argon2";

// argon2id with the OWASP-recommended minimum cost (19 MiB, 2 passes, 1 lane)
export const hashPassword = (pw: string): Promise<string> => hash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifyPassword = (hashed: string, pw: string): Promise<boolean> => verify(hashed, pw).catch(() => false);
