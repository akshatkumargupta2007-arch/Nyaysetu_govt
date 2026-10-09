#!/usr/bin/env node
// npm run up:all / down:all go through here:  node scripts/compose.mjs up -d --build
import { compose } from './lib/compose.mjs';

const r = compose(process.argv.slice(2));
process.exit(r.status ?? 1);
