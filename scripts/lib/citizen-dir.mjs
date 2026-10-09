// Finds the citizen app folder (NyaySetu_Full_v2). The two apps do not have to be siblings:
//   1. CITIZEN_DIR in the environment, then CITIZEN_DIR in the gov .env
//   2. a sibling folder  ../NyaySetu_Full_v2
//   3. ~/Documents/NyaySetu_Full_v2  (where the Mac copy usually lives)
// Returns an absolute path, or null when nothing was found.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const govDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function fromGovEnv() {
  const file = join(govDir, '.env');
  if (!existsSync(file)) return null;
  const m = readFileSync(file, 'utf8').match(/^CITIZEN_DIR=(.+)$/m);
  return m ? m[1].trim() : null;
}

const isCitizenApp = (dir) => existsSync(join(dir, 'apps', 'api', 'package.json')) && existsSync(join(dir, 'infra', 'db'));

export function findCitizenDir() {
  const candidates = [
    process.env.CITIZEN_DIR,
    fromGovEnv(),
    join(govDir, '..', 'NyaySetu_Full_v2'),
    join(homedir(), 'Documents', 'NyaySetu_Full_v2'),
  ].filter(Boolean).map((p) => resolve(p));
  return candidates.find(isCitizenApp) ?? null;
}
