// Runs `docker compose -f docker-compose.full.yml ...` with CITIZEN_DIR resolved, so the combined stack works
// wherever the citizen folder lives.
import { spawnSync } from 'node:child_process';
import { findCitizenDir, govDir } from './citizen-dir.mjs';

export const COMPOSE_FILE = 'docker-compose.full.yml';

export function citizenDirOrExit() {
  const dir = findCitizenDir();
  if (!dir) {
    console.error('Could not find the citizen app folder (NyaySetu_Full_v2).');
    console.error('Set CITIZEN_DIR to its full path, e.g.  CITIZEN_DIR=/Users/you/Documents/NyaySetu_Full_v2');
    console.error('(or put CITIZEN_DIR=... in the gov .env, or place the folder next to NyaySetu_Gov).');
    process.exit(1);
  }
  return dir;
}

export function composeEnv() {
  return { ...process.env, CITIZEN_DIR: citizenDirOrExit() };
}

export function compose(args, extra = {}) {
  return spawnSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], { stdio: 'inherit', cwd: govDir, env: composeEnv(), ...extra });
}
