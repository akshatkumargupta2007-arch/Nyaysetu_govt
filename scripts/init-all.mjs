#!/usr/bin/env node
// GX1: first-time setup of the combined Docker stack: create the tables and load the reference data in BOTH
// databases (citizen: taxonomy, Bhilai, demo officers, knowledge base; gov: geography, demo admin).
// Safe to run again.
import { spawnSync } from 'node:child_process';

const FILE = 'docker-compose.full.yml';

function run(service, cmd, env = []) {
  console.log(`\n> ${service}: ${cmd.join(' ')}`);
  const args = ['compose', '-f', FILE, 'exec', '-T', ...env.flatMap((e) => ['-e', e]), service, ...cmd];
  const r = spawnSync('docker', args, { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`failed: ${service} ${cmd.join(' ')}`);
    process.exit(r.status || 1);
  }
}

run('citizen-api', ['npm', 'run', 'db:migrate']);
// The knowledge base is embedded with Gemini, so the citizen .env needs a Gemini key.
// SEED_SKIP_HISTORY skips the 150 fake historical tickets (a free key cannot embed that many in a minute).
run('citizen-api', ['npm', 'run', 'seed'], ['SEED_SKIP_HISTORY=1']);
run('gov-api', ['npm', 'run', 'migrate']);
run('gov-api', ['npm', 'run', 'seed']);

console.log('\nDone.');
console.log('  Gov portal:   http://localhost:5174  (admin@nyaysetu.local, password = GOV_ADMIN_PASSWORD in NyaySetu_Gov/.env)');
console.log('  Citizen app:  http://localhost:5175');
console.log('  Check the whole loop:  npm run e2e');
