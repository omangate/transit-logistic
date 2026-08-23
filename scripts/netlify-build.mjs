#!/usr/bin/env node
import { execSync } from 'node:child_process';

function run(cmd, opts = {}) {
  console.log(`[netlify-build] $ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', shell: true, ...opts });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? error.status : 1;
    console.error(`[netlify-build] FAILED (exit ${status}): ${cmd}`);
    throw error;
  }
}

function tryRun(cmd) {
  try {
    run(cmd);
    return true;
  } catch {
    return false;
  }
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const injected = process.env.NETLIFY_DATABASE_URL?.trim() ?? process.env.NETLIFY_DB_URL?.trim();
  if (injected) {
    process.env.DATABASE_URL = injected;
    console.log('[netlify-build] Using Netlify-injected database URL');
    return injected;
  }
  return null;
}

console.log('[netlify-build] Installing dependencies...');
process.env.NODE_ENV = 'development';
process.env.NPM_CONFIG_PRODUCTION = 'false';
run('pnpm install --ignore-scripts --config.production=false');

console.log('[netlify-build] Building shared package...');
run('pnpm --filter @transit-logistic/shared build');

console.log('[netlify-build] Generating Prisma client...');
run('pnpm --filter @transit-logistic/api exec prisma generate --schema=prisma/schema.prisma');

console.log('[netlify-build] Building API...');
run('pnpm --filter @transit-logistic/api build');

const dbUrl = resolveDatabaseUrl();
if (dbUrl && process.env.NETLIFY_TEST_SEED === 'force') {
  console.log('[netlify-build] Running Prisma migrations...');
  if (!tryRun('pnpm --filter @transit-logistic/api exec prisma migrate deploy --schema=prisma/schema.prisma')) {
    console.warn('[netlify-build] WARNING: prisma migrate deploy failed');
  }

  if (process.env.NETLIFY_TEST_SEED !== 'false') {
    console.log('[netlify-build] Seeding test database...');
    process.env.SEED_DEMO_ACCOUNTS = 'true';
    if (!tryRun('pnpm --filter @transit-logistic/api exec ts-node prisma/seed.ts')) {
      console.warn('[netlify-build] Seed skipped or failed (non-fatal)');
    }
  }
} else {
  console.log('[netlify-build] DATABASE_URL not set — skipping migrate/seed');
}

console.log('[netlify-build] Building web app...');
process.env.NODE_ENV = 'production';
process.env.NEXT_PUBLIC_USE_SAME_ORIGIN_API ??= 'true';
run('pnpm --filter @transit-logistic/web build');

console.log('[netlify-build] Done.');
