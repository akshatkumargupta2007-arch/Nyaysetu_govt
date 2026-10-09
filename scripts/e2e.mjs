#!/usr/bin/env node
// GX3: the whole "please verify" loop across the two REAL servers (citizen copy + gov portal), no mocks:
//
//   citizen files a complaint -> field team finishes it -> gov portal shows it (sync) -> gov reveals the phone
//   -> gov sends a close request -> the citizen's open app hears about it live -> the citizen says "No, still
//   broken" -> the SAME complaint reopens (+1 escalation) -> gov sees "citizen reopened"
//
// Needs both stacks running (see HANDOFF.md). Environment (all optional):
//   CITIZEN_API  default http://localhost:8082     GOV_API  default http://localhost:8081
//   GOV_ADMIN_PASSWORD  default: read from NyaySetu_Gov/.env     GOV_ADMIN_EMAIL  default admin@nyaysetu.local
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';

const CITIZEN = (process.env.CITIZEN_API || 'http://localhost:8082').replace(/\/$/, '');
const GOV = (process.env.GOV_API || 'http://localhost:8081').replace(/\/$/, '');
const GOV_ORIGIN = process.env.GOV_WEB_ORIGIN || 'http://localhost:5174';
const here = dirname(fileURLToPath(import.meta.url));

function adminPassword() {
  if (process.env.GOV_ADMIN_PASSWORD) return process.env.GOV_ADMIN_PASSWORD;
  const text = readFileSync(join(here, '..', '.env'), 'utf8');
  const m = text.match(/^GOV_ADMIN_PASSWORD=(.+)$/m);
  if (!m) throw new Error('GOV_ADMIN_PASSWORD not found (set it or run npm run gov:keys)');
  return m[1].trim();
}

let step = 0;
const ok = (msg) => console.log(`  ✓ ${String(++step).padStart(2)}. ${msg}`);
const fail = (msg) => { console.error(`  ✗ ${msg}`); process.exit(1); };
const expect = (cond, msg) => { if (!cond) fail(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(what, fn, { timeout = 90_000, every = 1500 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeout) fail(`timed out waiting for: ${what}`);
    await sleep(every);
  }
}

async function http(base, path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: res.status, json, headers: res.headers };
}

// ── 1. a citizen files a complaint ─────────────────────────────────────────
console.log('NyaySetu e2e: citizen app', CITIZEN, '| gov portal', GOV);
const phone = `9${String(randomInt(0, 1_000_000_000)).padStart(9, '0')}`;
let r = await http(CITIZEN, '/auth/request-otp', { method: 'POST', body: { phone } });
expect(r.status === 200 && r.json?.devOtp, `citizen OTP (the citizen app must run with DEMO/dev OTP): ${r.status}`);
r = await http(CITIZEN, '/auth/verify-otp', { method: 'POST', body: { phone, code: r.json.devOtp, lang: 'en' } });
expect(r.status === 200, `citizen login: ${r.status}`);
const citizen = { authorization: `Bearer ${r.json.token}` };
const citizenToken = r.json.token;
ok('a new citizen logged in with a phone number');

// A unique place and wording each run: the app merges same-place, same-problem reports into one work order
// ("one ticket, many voices"), and we want a fresh complaint every time.
const jitter = () => (Math.random() - 0.5) * 0.016; // about +-900 m, still inside Bhilai
const text = `The lamp outside house number ${randomInt(1, 9999)} has been dark for days, e2e ${Date.now()}`;
r = await http(CITIZEN, '/reports/understand', { method: 'POST', body: { text, lang: 'en', lat: 21.185 + jitter(), lng: 81.33 + jitter() } });
expect(r.status === 200, `understand: ${r.status}`);
r = await http(CITIZEN, '/reports/confirm', { method: 'POST', headers: citizen, body: { draftId: r.json.draftId } });
expect(r.status === 201, `confirm: ${r.status}`);
const { ticketId, publicCode } = r.json;
ok(`complaint filed: ${publicCode}`);

// ── 2. the field team finishes it (the demo helper = the real officer endpoints) ─
const { spawnSync } = await import('node:child_process');
const helper = spawnSync(process.execPath, [join(here, 'demo-workdone.mjs'), publicCode], { env: { ...process.env, CITIZEN_API: CITIZEN }, encoding: 'utf8' });
expect(helper.status === 0, `demo-workdone failed: ${helper.stderr || helper.stdout}`);
ok('the field team marked the work done (assigned -> dispatched -> work done)');

// ── 3. the gov portal logs in and sees it (sync) ───────────────────────────
r = await http(GOV, '/api/auth/login', { method: 'POST', headers: { origin: GOV_ORIGIN }, body: { email: process.env.GOV_ADMIN_EMAIL || 'admin@nyaysetu.local', password: adminPassword() } });
expect(r.status === 200, `gov login: ${r.status} ${JSON.stringify(r.json)}`);
const cookies = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const gov = { authorization: `Bearer ${r.json.accessToken}`, cookie: cookies, 'x-csrf-token': r.json.csrfToken };
ok('an official logged in to the gov portal');

const seen = await waitFor(`the gov portal to show ${publicCode} as "work done"`, async () => {
  const x = await http(GOV, `/api/complaints?q=${publicCode}`, { headers: gov });
  const c = x.json?.items?.[0];
  return c && c.status === 'WORK_DONE_PENDING_CONFIRMATION' ? c : null;
});
expect(/^\d\dXXXXXX\d\d$/.test(seen.phoneMasked), `masked phone looks wrong: ${seen.phoneMasked}`);
expect(seen.location.city.id === 'cg.bhilai' && seen.location.district.id === 'CG.DURG' && seen.location.state.code === 'CG', 'location path was not mapped');
ok(`gov portal shows ${publicCode}: ${seen.status}, ${seen.phoneMasked}, ${seen.location.state.name.en} > ${seen.location.district.name.en} > ${seen.location.city.name.en}`);

// ── 4. the official reveals the phone: it is the citizen's real number, delivered sealed ─
r = await http(GOV, `/api/complaints/${ticketId}/reveal-phone`, { method: 'POST', headers: gov, body: { reason: 'e2e' } });
expect(r.status === 200 && r.json.phone === `+91${phone}`, `revealed phone does not match the citizen's number (${r.status})`);
ok('the revealed phone number matches the citizen\'s real number (sealed in transit, opened only in gov)');

// ── 5. the citizen opens the live stream, then the official sends a close request ─
const ctl = new AbortController();
const stream = await fetch(`${CITIZEN}/me/stream?token=${citizenToken}`, { signal: ctl.signal });
const reader = stream.body.getReader();
let streamText = '';
const dec = new TextDecoder();
const pump = (async () => { for (;;) { const { done, value } = await reader.read(); if (done) return; streamText += dec.decode(value); } })().catch(() => {});
await waitFor('the live stream to open', async () => streamText.includes('event: ready'), { timeout: 8000, every: 200 });
ok('the citizen\'s app opened its live connection');

r = await http(GOV, `/api/complaints/${ticketId}`, { headers: gov });
expect(r.json.closeRequest.canRequest === true, 'close request should be allowed now');
const asked = Date.now();
r = await http(GOV, `/api/complaints/${ticketId}/close-request`, { method: 'POST', headers: gov, body: { note: 'Please check the light now' } });
expect(r.status === 200 && r.json.ok, `close request: ${r.status} ${JSON.stringify(r.json)}`);
ok('the official sent a close request with a note');

await waitFor('the citizen app to hear the request live', async () => streamText.includes('event: close_request'), { timeout: 10_000, every: 100 });
ok(`the citizen's open app heard it live in ${Date.now() - asked} ms (no refresh)`);
expect(streamText.includes('Please check the light now'), 'the note did not reach the citizen');

r = await http(CITIZEN, '/me/reports', { headers: citizen });
const card = r.json.find((c) => c.ticketId === ticketId);
expect(card?.pending_close_request?.note === 'Please check the light now', 'pending_close_request missing on My Problems');
ok('My Problems shows "Verify resolution" with the official\'s note');

// the official cannot send another within 24 h, and cannot close anything
r = await http(GOV, `/api/complaints/${ticketId}/close-request`, { method: 'POST', headers: gov, body: {} });
expect(r.status === 409 && r.json.code === 'TOO_SOON', `second request should be refused (got ${r.status} ${r.json?.code})`);
ok('a second request within 24 h is refused');

if (process.env.E2E_STOP_AFTER_REQUEST) {
  // for looking at the citizen screens by hand: leave the request pending and say who to log in as
  console.log(`
Stopped with a pending request. Log in to the citizen app as phone ${phone}; open "My problems" (${publicCode}).`);
  ctl.abort();
  process.exit(0);
}

// ── 6. the citizen says NO: the same complaint reopens ─────────────────────
r = await http(CITIZEN, `/reports/${ticketId}/confirm-closure`, { method: 'POST', headers: citizen, body: { confirmed: false, note: 'The light still goes off at night' } });
expect(r.status === 200 && r.json.state === 'REOPENED', `confirm-closure: ${r.status} ${JSON.stringify(r.json)}`);
r = await http(CITIZEN, `/tickets/${ticketId}/tracking`, { headers: citizen });
ok(`the citizen said "No, still broken": ${publicCode} is REOPENED (same complaint number)`);

const reopened = await waitFor('the gov portal to show "citizen reopened"', async () => {
  const x = await http(GOV, `/api/complaints/${ticketId}`, { headers: gov });
  const c = x.json;
  return c?.complaint?.status === 'REOPENED' && c.closeRequest.status === 'reopened' ? c : null;
}, { timeout: 60_000 });
expect(reopened.complaint.code === publicCode, 'the complaint number changed!');
expect(reopened.complaint.escalationLevel >= 1, 'the escalation level did not go up');
expect(reopened.closeRequest.reopenCount === 1, 'reopen count should be 1');
ok(`gov portal shows: ${reopened.complaint.code} REOPENED, citizen reopened, escalation level ${reopened.complaint.escalationLevel}`);

ctl.abort();
await pump;
console.log(`\nPASS: the whole loop works end to end for ${publicCode}.`);
process.exit(0);
