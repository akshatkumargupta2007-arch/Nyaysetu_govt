#!/usr/bin/env node
// GX1: first-time setup of the combined Docker stack: create the tables and load the reference data in BOTH
// databases (citizen: taxonomy, Bhilai, demo officers, knowledge base; gov: geography, demo admin).
// Safe to run again.
import { compose } from './lib/compose.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// `retries` is for steps that call an outside service (the knowledge-base seed asks Gemini for embeddings, and
// Google answers 503 "busy" now and then). Everything is idempotent, so trying again is safe.
async function run(service, cmd, env = [], { retries = 0 } = {}) {
  for (let attempt = 0; ; attempt++) {
    console.log(`\n> ${service}: ${cmd.join(' ')}${attempt ? `  (attempt ${attempt + 1})` : ''}`);
    const r = compose(['exec', '-T', ...env.flatMap((e) => ['-e', e]), service, ...cmd]);
    if (r.status === 0) return;
    if (attempt >= retries) {
      console.error(`failed: ${service} ${cmd.join(' ')}`);
      process.exit(r.status || 1);
    }
    const wait = 5 * (attempt + 1);
    console.error(`failed, trying again in ${wait}s...`);
    await sleep(wait * 1000);
  }
}

await run('citizen-api', ['npm', 'run', 'db:migrate']);
// The knowledge base is embedded with Gemini, so the citizen .env needs a Gemini key.
// SEED_SKIP_HISTORY skips the 150 fake historical tickets (a free key cannot embed that many in a minute).
await run('citizen-api', ['npm', 'run', 'seed'], ['SEED_SKIP_HISTORY=1'], { retries: 4 });
await run('gov-api', ['npm', 'run', 'migrate']);
await run('gov-api', ['npm', 'run', 'seed']);

console.log('\nDone.');
console.log('  Gov portal:   http://localhost:5174  (admin@nyaysetu.local, password = GOV_ADMIN_PASSWORD in NyaySetu_Gov/.env)');
console.log('  Citizen app:  http://localhost:5175');
console.log('  Check the whole loop:  npm run e2e');
