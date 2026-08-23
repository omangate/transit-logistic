#!/usr/bin/env node
/**
 * Provision isolated Netlify TEST stack: database + secrets (never logs secret values).
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SITE_ID = '67153b44-1cc2-41f2-85f4-cf4da6ca899a';
const SITE_URL = 'https://transit-logistic-web-test.netlify.app';
const API = 'https://api.netlify.com/api/v1';

function token() {
  const config = JSON.parse(
    readFileSync(join(homedir(), 'AppData', 'Roaming', 'netlify', 'Config', 'config.json'), 'utf8'),
  );
  return config.users[config.userId].auth.token;
}

async function netlify(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${text.slice(0, 400)}`);
  return data;
}

function secret(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

async function ensureDatabase() {
  try {
    const db = await netlify('GET', `/sites/${SITE_ID}/database`);
    console.log('Database exists:', db.id ?? 'ok');
    return db;
  } catch {
    console.log('Creating Netlify DB...');
    return netlify('POST', `/sites/${SITE_ID}/database`, {});
  }
}

async function setEnvVars(accountId, vars) {
  const batch = [];
  for (const [key, value, context = 'all', secret = false] of vars) {
    if (!value) continue;
    batch.push({
      key,
      is_secret: secret,
      values: [{ value, context }],
    });
  }

  if (!batch.length) return;

  try {
    await netlify('POST', `/accounts/${accountId}/env?site_id=${SITE_ID}`, batch);
    for (const item of batch) {
      console.log(`Env set: ${item.key}`);
    }
  } catch (error) {
    for (const item of batch) {
      try {
        await netlify('POST', `/accounts/${accountId}/env?site_id=${SITE_ID}`, [item]);
        console.log(`Env set: ${item.key}`);
      } catch (inner) {
        if (String(inner.message).includes('409')) {
          console.log(`Env exists: ${item.key}`);
        } else {
          console.warn(`Env ${item.key}:`, String(inner.message).slice(0, 120));
        }
      }
    }
  }
}

async function main() {
  const site = await netlify('GET', `/sites/${SITE_ID}`);
  const db = await ensureDatabase();

  const jwtAccess = secret();
  const jwtRefresh = secret();

  const dbUrl =
    process.env.NETLIFY_DATABASE_URL ??
    db.connection_string ??
    db.connection_strings?.postgresql ??
    db.connection_uri ??
    db.url;

  const envVars = [
    ['DATABASE_URL', dbUrl, 'all', true],
    ['JWT_ACCESS_SECRET', jwtAccess, 'all', true],
    ['JWT_REFRESH_SECRET', jwtRefresh, 'all', true],
    ['WEB_APP_URL', SITE_URL, 'all'],
    ['CORS_ORIGIN', SITE_URL, 'all'],
    ['NETLIFY_TEST_STACK', 'true', 'all'],
    ['NETLIFY', 'true', 'all'],
    ['CACHE_PROVIDER', 'postgres', 'all'],
    ['STORAGE_PROVIDER', 'netlify-blobs', 'all'],
    ['NETLIFY_BLOB_STORE', 'transit-uploads', 'all'],
    ['EMAIL_PROVIDER', 'mock', 'all'],
    ['AI_PROVIDER', 'mock', 'all'],
    ['PAYMENT_PROVIDER', 'mock', 'all'],
    ['NEXT_PUBLIC_USE_SAME_ORIGIN_API', 'true', 'build'],
    ['SEED_DEMO_ACCOUNTS', 'true', 'build'],
    ['NETLIFY_TEST_SEED', 'true', 'build'],
  ];

  await setEnvVars(site.account_id, envVars);

  await netlify('PATCH', `/sites/${SITE_ID}`, { sso_login: false });

  console.log('\nProvision complete. Trigger deploy: node scripts/netlify-api.mjs build');
  console.log('Site:', SITE_URL);
  console.log('API:', `${SITE_URL}/api/v1`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
