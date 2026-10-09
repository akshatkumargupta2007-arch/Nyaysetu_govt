#!/usr/bin/env node
// GX2: moves ONE real complaint to "Work done - awaiting citizen" so the close-request loop can be shown.
// It only talks to the citizen app's own HTTP API as a seeded DEMO field officer (no database writes, no shortcuts):
//   assigned -> team dispatched -> work done, exactly the steps a field team takes.
//
//   node scripts/demo-workdone.mjs                 # picks the oldest assigned complaint
//   node scripts/demo-workdone.mjs BHI-26-318813   # or one you choose (complaint ID or ticket UUID)
//
// Environment (all optional):
//   CITIZEN_API      default http://localhost:8082  (the citizen copy; 8080 is the untouched original)
//   DEMO_OFFICER_ID  default cg.bhilai.bmc_field_supervisor
//   DEMO_PASSCODE    default 1234 (the demo seed's passcode: demo data only)
const API = (process.env.CITIZEN_API || 'http://localhost:8082').replace(/\/$/, '');
const OFFICER = process.env.DEMO_OFFICER_ID || 'cg.bhilai.bmc_field_supervisor';
const PASSCODE = process.env.DEMO_PASSCODE || '1234';
const wanted = process.argv[2];

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${json.code || json.error || ''}`);
  return json;
}

const login = await call('/officer/login', { method: 'POST', body: { id: OFFICER, passcode: PASSCODE } });
const token = login.token;
const { tickets } = await call('/officer/tickets', { token });

const t = wanted
  ? tickets.find((x) => x.publicCode === wanted || x.id === wanted)
  : [...tickets].filter((x) => x.state === 'ASSIGNED').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
if (!t) {
  console.error(wanted ? `No complaint "${wanted}" in this officer's queue.` : 'No assigned complaint found to move.');
  process.exit(1);
}

const steps = { ASSIGNED: ['DISPATCHED', 'WORK_DONE_PENDING_CONFIRMATION'], DISPATCHED: ['WORK_DONE_PENDING_CONFIRMATION'], WORK_DONE_PENDING_CONFIRMATION: [] };
if (!(t.state in steps)) {
  console.error(`${t.publicCode} is "${t.state}"; this helper only moves assigned or dispatched complaints.`);
  process.exit(1);
}
for (const toState of steps[t.state]) {
  await call(`/tickets/${t.id}/transition`, { method: 'POST', token, body: { toState, actor: { type: 'FIELD', id: OFFICER }, payload: { demo: true, by: 'demo-workdone.mjs' } } }); // the server ignores `actor` and uses the verified login
  console.log(`  ${t.publicCode}: -> ${toState}`);
}
console.log(`Done. ${t.publicCode} is now "Work done - awaiting citizen". It appears in the gov portal within about 30 seconds.`);
