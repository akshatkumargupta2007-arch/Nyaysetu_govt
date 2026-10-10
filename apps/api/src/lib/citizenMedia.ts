// The government portal's way of asking the citizen stack for the photos a citizen attached to a complaint. One
// signed, read-only door (see the citizen API's modules/gov/bridge.ts). The portal checks the official's area
// BEFORE it calls, and never keeps a copy of the picture.
import { env } from "../env.js";
import { signRequest } from "./signing.js";

export const MEDIA_PATH = "/internal/gov/media";

export class MediaError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export type PhotoCheck = { verdict: string; confidence: number | null; reason: string | null };
export type PhotoItem = { id: string; kind: string; at: string; available: boolean; check?: PhotoCheck | null };
export type PhotoFile = { mime: "image/jpeg" | "image/png" | "image/webp"; data_base64: string };

async function call<T>(body: object, timeoutMs: number): Promise<T> {
  const raw = JSON.stringify(body);
  let res: Response;
  try {
    res = await fetch(`${env.CITIZEN_INTERNAL_URL.replace(/\/$/, "")}${MEDIA_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...signRequest(env.GOV_WRITEBACK_PRIVATE_KEY, "POST", MEDIA_PATH, raw) },
      body: raw,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new MediaError(502, "CITIZEN_UNREACHABLE", "Could not reach the citizen app");
  }
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; error?: string } & Record<string, unknown>;
  if (!res.ok || !json.ok) throw new MediaError(res.status === 404 ? 404 : res.status >= 500 ? 502 : 400, json.code ?? "MEDIA_FAILED", json.error ?? "The citizen app refused the request");
  return json as T;
}

export async function listPhotos(ticketId: string): Promise<PhotoItem[]> {
  return (await call<{ items: PhotoItem[] }>({ op: "list", ticket_id: ticketId }, 8_000)).items;
}

export async function getPhoto(ticketId: string, mediaId: string): Promise<PhotoFile> {
  return call<PhotoFile>({ op: "get", ticket_id: ticketId, media_id: mediaId }, 15_000);
}
