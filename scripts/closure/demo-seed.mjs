#!/usr/bin/env node
// Files one real complaint through the citizen app, waits for it to reach the government portal, stores its
// "before" picture and submits repair proof, so the Closure Court pages have something to show.
//   node scripts/closure/demo-seed.mjs            (needs the stack running: npm run up:all)
// Pictures are generated drawings, clearly illustrations (replace them with real photos for the real demo).
import { createRequire } from 'node:module';
const require = createRequire(process.env.SHARP_FROM || import.meta.url);
const sharp = require('sharp');

const CITIZEN = process.env.CITIZEN || 'http://localhost:8082';
const GOV = process.env.GOV || 'http://localhost:8081';
const EMAIL = process.env.GOV_EMAIL || 'admin@nyaysetu.local';
const PASSWORD = process.env.GOV_PASSWORD || '';
const j = async (url, o = {}) => { const r = await fetch(url, o); let b = null; try { b = await r.json(); } catch {} return { status: r.status, json: b, headers: r.headers }; };
const svg = (body) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560"><rect width="800" height="560" fill="#8a8f94"/>${body}</svg>`)).jpeg({ quality: 88 }).toBuffer();
const road = '<rect y="250" width="800" height="310" fill="#3b3b3b"/><line x1="0" y1="420" x2="800" y2="420" stroke="#fff" stroke-width="7" stroke-dasharray="46 34"/>';

const phone = `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
let r = await j(`${CITIZEN}/auth/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
r = await j(`${CITIZEN}/auth/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: r.json.devOtp, lang: 'en' }) });
const ctoken = r.json.token;
const u = await j(`${CITIZEN}/reports/understand`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: `The pothole on the main road outside the school is deep and dangerous, kids nearly fell ${Date.now()}`, lang: 'en', lat: 21.185, lng: 81.33 }) });
const c = await j(`${CITIZEN}/reports/confirm`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${ctoken}` }, body: JSON.stringify({ draftId: u.json.draftId }) });
const code = c.json.publicCode; console.log('filed', code, c.json.ticketId);

const l = await j(`${GOV}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: process.env.GOV_ORIGIN || 'http://localhost:5174' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
if (l.status !== 200) { console.error('gov login failed', l.status); process.exit(1); }
const cookie = (l.headers.getSetCookie?.() || []).map((x) => x.split(';')[0]).join('; ');
const hdr = { 'content-type': 'application/json', authorization: `Bearer ${l.json.accessToken}`, 'x-csrf-token': l.json.csrfToken, cookie };
let gid = null;
for (let i = 0; i < 40 && !gid; i++) { const q = await j(`${GOV}/api/complaints?q=${encodeURIComponent(code)}`, { headers: hdr }); gid = q.json?.items?.[0]?.id ?? null; if (!gid) await new Promise((x) => setTimeout(x, 2500)); }
if (!gid) { console.error('the complaint did not reach the government portal in time'); process.exit(1); }
console.log('in gov portal', gid);

const b64 = (b) => b.toString('base64'); const file = (name, buf) => ({ name, mime: 'image/jpeg', base64: b64(buf) });
const before = await svg(road + '<ellipse cx="400" cy="440" rx="150" ry="55" fill="#101010"/>');
const cosmetic = await svg(road + '<ellipse cx="400" cy="440" rx="150" ry="55" fill="#4a4a4a"/><ellipse cx="400" cy="440" rx="70" ry="24" fill="#101010"/>');
const fixed = await svg(road + '<ellipse cx="400" cy="440" rx="150" ry="55" fill="#4d4d4d"/>');
console.log((await j(`${GOV}/api/court/${gid}/before`, { method: 'POST', headers: hdr, body: JSON.stringify({ files: [file('before.jpg', before)] }) })).status, 'before stored');
const mirrored = await sharp(before).flop().jpeg({ quality: 80 }).toBuffer();
for (const [label, buf] of [['mirrored copy of the original', mirrored], ['patched edges, hole remains', cosmetic], ['fully filled', fixed]]) {
  const t0 = Date.now(); const p = await j(`${GOV}/api/court/${gid}/proof`, { method: 'POST', headers: hdr, body: JSON.stringify({ files: [file('proof.jpg', buf)] }) });
  console.log(label.padEnd(32), '->', p.json?.verdict ?? p.status, `(${Date.now() - t0} ms, AI called: ${p.json?.aiCalled})`, p.json?.nextEvidence?.[0] ?? '');
}
console.log('open /court after: sessionStorage gov.court =', JSON.stringify({ id: gid }));
