#!/usr/bin/env node
// Writes ready-to-paste Railway variable files for BOTH deployments (gov portal and citizen app) with one matching set
// of keys, so nobody has to copy keys between repos by hand. Needs no other folder. Nothing is printed.
//   node scripts/railway-vars.mjs [output-folder]        (default: ./railway-vars, which git ignores)
// Service names in Railway MUST be exactly: gov-db, gov-api, gov-web, citizen-db, citizen-api, citizen-web
// (the ${{...}} references below use those names).
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] || 'railway-vars');
mkdirSync(out, { recursive: true });
const pair = (type) => {
  const { privateKey, publicKey } = generateKeyPairSync(type);
  return { priv: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'), pub: publicKey.export({ type: 'spki', format: 'der' }).toString('base64') };
};
const secret = (n) => randomBytes(n).toString('base64url');
const hex = (n) => randomBytes(n).toString('hex');
const jwt = pair('ed25519'), sync = pair('ed25519'), wb = pair('ed25519'), seal = pair('x25519');
const dbPass = secret(24), appPass = secret(24), adminPass = secret(18);
const W = (name, header, lines) => writeFileSync(resolve(out, name), `# ${header}\n${lines.map((l) => (l.startsWith('#') || l === '' ? l : l)).join('\n')}\n`, { mode: 0o600 });

W('1-GOV-DB.env', 'Railway service "gov-db" (Variables tab, Raw Editor)', [
  `POSTGRES_PASSWORD=${dbPass}`, 'POSTGRES_DB=nyaysetu_gov', 'PGDATA=/home/postgres/pgdata/data',
]);
W('2-GOV-API.env', 'Railway service "gov-api" (Variables tab, Raw Editor). Replace ONLY the line that says CHANGE-ME.', [
  'RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile', 'NODE_ENV=production', 'PORT=8081', 'SYNC_PORT=8091', 'TRUST_PROXY=2',
  '# Demo only: turns on the Closure Court demo buttons and the Civic Pulse load simulator. Delete this line for real use.', 'PULSE_SIM=1',
  `MIGRATE_DATABASE_URL=postgres://postgres:${dbPass}@\${{gov-db.RAILWAY_PRIVATE_DOMAIN}}:5432/nyaysetu_gov`,
  `GOV_APP_DB_PASSWORD=${appPass}`,
  `DATABASE_URL=postgres://gov_app:${appPass}@\${{gov-db.RAILWAY_PRIVATE_DOMAIN}}:5432/nyaysetu_gov`,
  'GOV_WEB_ORIGIN=https://${{gov-web.RAILWAY_PUBLIC_DOMAIN}}',
  'CITIZEN_INTERNAL_URL=http://${{citizen-api.RAILWAY_PRIVATE_DOMAIN}}:8090',
  `GOV_JWT_PRIVATE_KEY=${jwt.priv}`, `GOV_JWT_PUBLIC_KEY=${jwt.pub}`, `SYNC_SIGNING_PUBLIC_KEY=${sync.pub}`,
  `GOV_WRITEBACK_PRIVATE_KEY=${wb.priv}`, `GOV_PHONE_SEAL_PRIVATE_KEY=${seal.priv}`, `GOV_PHONE_SEAL_PUBLIC_KEY=${seal.pub}`,
  'GOV_ADMIN_EMAIL=CHANGE-ME-type-a-real-email-address-here', `GOV_ADMIN_PASSWORD=${adminPass}`,
]);
W('3-GOV-WEB.env', 'Railway service "gov-web" (Variables tab, Raw Editor)', [
  'RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile', 'PORT=80', 'VITE_API_URL=/',
  'API_UPSTREAM=http://${{gov-api.RAILWAY_PRIVATE_DOMAIN}}:8081', 'NGINX_RESOLVER=[fd12::10]',
]);
W('4-CITIZEN-API-ADD-THESE.env', 'ADD these lines to the Railway service "citizen-api" (keep its existing variables)', [
  'GOV_SYNC_URL=http://${{gov-api.RAILWAY_PRIVATE_DOMAIN}}:8091', 'GOV_BRIDGE_PORT=8090',
  `SYNC_SIGNING_PRIVATE_KEY=${sync.priv}`, `GOV_WRITEBACK_PUBLIC_KEY=${wb.pub}`, `GOV_PHONE_SEAL_PUBLIC_KEY=${seal.pub}`,
]);
console.log(`Wrote 4 files to ${out}. They contain secrets: do not commit or paste them in chat.`);
