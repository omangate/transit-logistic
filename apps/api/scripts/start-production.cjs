const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

const apiRoot = join(__dirname, '..');
const mainPath = join(apiRoot, 'dist', 'main.js');
const schemaPath = join(apiRoot, 'prisma', 'schema.prisma');

function log(label, value) {
  console.log(`[railway-start] ${label}=${value}`);
}

log('cwd', process.cwd());
log('apiRoot', apiRoot);
log('PORT', process.env.PORT ?? '(unset)');
log('API_PORT', process.env.API_PORT ?? '(unset)');
log('NODE_ENV', process.env.NODE_ENV ?? '(unset)');
log('DATABASE_URL', process.env.DATABASE_URL ? 'set' : 'MISSING');
log('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET ? 'set' : 'MISSING');
log('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET ? 'set' : 'MISSING');
log('REDIS_HOST', process.env.REDIS_HOST ?? '(unset)');

if (!process.env.DATABASE_URL) {
  console.error('[railway-start] FATAL: DATABASE_URL is not configured on the API service.');
  process.exit(1);
}

if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.error('[railway-start] FATAL: JWT secrets are not configured on the API service.');
  process.exit(1);
}

if (!existsSync(mainPath)) {
  console.error(`[railway-start] FATAL: ${mainPath} was not found. Build step may have failed.`);
  process.exit(1);
}

if (!existsSync(schemaPath)) {
  console.error(`[railway-start] FATAL: ${schemaPath} was not found.`);
  process.exit(1);
}

try {
  console.log('[railway-start] Running prisma migrate deploy...');
  execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
    cwd: apiRoot,
    stdio: 'inherit',
    env: process.env,
  });
  console.log('[railway-start] Migrations applied successfully.');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[railway-start] WARNING: prisma migrate deploy failed:', message);
  console.error('[railway-start] Starting API anyway so health checks can pass; run migrate manually in Railway shell.');
}

console.log('[railway-start] Starting API (node dist/main.js)...');
execSync('node dist/main.js', { cwd: apiRoot, stdio: 'inherit', env: process.env });
