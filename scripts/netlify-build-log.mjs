#!/usr/bin/env node
import { execSync } from 'node:child_process';

const SITE_ID = '67153b44-1cc2-41f2-85f4-cf4da6ca899a';
const buildId = process.argv[2];
if (!buildId) {
  console.error('Usage: node scripts/netlify-build-log.mjs <build_id>');
  process.exit(1);
}

const data = JSON.stringify({ site_id: SITE_ID, build_id: buildId });
const out = execSync(`npx --yes netlify-cli api getSiteBuild --data ${JSON.stringify(data)}`, {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});
console.log(out);
