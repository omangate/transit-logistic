#!/usr/bin/env node
/** Set all Netlify test stack env vars via CLI (free-plan compatible). */
import { randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SITE_ID = '67153b44-1cc2-41f2-85f4-cf4da6ca899a';
const SITE_URL = 'https://transit-logistic-web-test.netlify.app';

function token() {
  const config = JSON.parse(
    readFileSync(join(homedir(), 'AppData', 'Roaming', 'netlify', 'Config', 'config.json'), 'utf8'),
  );
  return config.users[config.userId].auth.token;
}

async function getDatabaseUrl() {
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/database`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  const db = await res.json();
  return db.connection_string ?? db.connection_strings?.postgresql ?? null;
}

function setEnv(key, value, context = 'all') {
  if (!value) return;
  execSync(
    `npx --yes netlify-cli env:set ${key} ${JSON.stringify(value)} --context ${context} --filter @transit-logistic/web`,
    { stdio: 'inherit', cwd: process.cwd() },
  );
}

async function main() {
  const dbUrl = process.env.NETLIFY_DATABASE_URL ?? (await getDatabaseUrl());
  if (!dbUrl) throw new Error('Netlify DATABASE_URL unavailable');

  const jwtAccess = randomBytes(32).toString('base64url');
  const jwtRefresh = randomBytes(32).toString('base64url');

  const vars = [
    ['DATABASE_URL', dbUrl, 'all'],
    ['JWT_ACCESS_SECRET', jwtAccess, 'all'],
    ['JWT_REFRESH_SECRET', jwtRefresh, 'all'],
    ['WEB_APP_URL', SITE_URL, 'all'],
    ['CORS_ORIGIN', SITE_URL, 'all'],
    ['NETLIFY', 'true', 'all'],
    ['NETLIFY_TEST_STACK', 'true', 'all'],
    ['CACHE_PROVIDER', 'postgres', 'all'],
    ['STORAGE_PROVIDER', 'netlify-blobs', 'all'],
    ['NETLIFY_BLOB_STORE', 'transit-uploads', 'all'],
    ['EMAIL_PROVIDER', 'mock', 'all'],
    ['AI_PROVIDER', 'mock', 'all'],
    ['PAYMENT_PROVIDER', 'mock', 'all'],
    ['NETLIFY_TEST_SEED', 'true', 'build'],
    ['SEED_DEMO_ACCOUNTS', 'true', 'build'],
    ['NEXT_PUBLIC_USE_SAME_ORIGIN_API', 'true', 'build'],
    ['NEXT_TELEMETRY_DISABLED', '1', 'build'],
    ['NODE_VERSION', '20', 'build'],
    ['NETLIFY_USE_PNPM', 'true', 'build'],
  ];

  console.log('Setting env vars (secrets not printed)...');
  for (const [key, value, context] of vars) {
    console.log(`→ ${key}`);
    setEnv(key, value, context);
  }

  console.log('\nDone. Trigger: node scripts/netlify-api.mjs build');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
