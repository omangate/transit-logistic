const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

const apiRoot = join(__dirname, '..');
const mainPath = join(apiRoot, 'dist', 'main.js');
const schemaPath = join(apiRoot, 'prisma', 'schema.prisma');

function log(label, value) {
  console.log(`[railway-start] ${label}=${value}`);
}

function runPrisma(args, { allowFailure = false } = {}) {
  try {
    const output = execSync(`npx prisma ${args} --schema="${schemaPath}"`, {
      cwd: apiRoot,
      encoding: 'utf8',
      env: process.env,
    });
    if (output) process.stdout.write(output);
    return { ok: true, output: output ?? '' };
  } catch (error) {
    const output = [
      error instanceof Error ? error.message : String(error),
      error?.stdout?.toString?.() ?? '',
      error?.stderr?.toString?.() ?? '',
    ].join('\n');
    if (error?.stdout) process.stdout.write(error.stdout.toString());
    if (error?.stderr) process.stderr.write(error.stderr.toString());
    if (!allowFailure) {
      throw error;
    }
    return { ok: false, output };
  }
}

function recoverFailedMigration(output) {
  const match = output.match(/The `([^`]+)` migration started at .* failed/);
  if (!match) {
    return false;
  }
  const migrationName = match[1];
  console.warn(`[railway-start] Recovering failed migration "${migrationName}" (mark rolled back, then retry)...`);
  runPrisma(`migrate resolve --rolled-back ${migrationName}`);
  return true;
}

log('cwd', process.cwd());
log('apiRoot', apiRoot);
log('PORT', process.env.PORT ?? '(unset)');
log('DATABASE_URL', process.env.DATABASE_URL ? 'set' : 'MISSING');
log('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET ? 'set' : 'MISSING');

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

console.log('[railway-start] Running prisma migrate deploy...');
let migrateResult = runPrisma('migrate deploy', { allowFailure: true });

if (!migrateResult.ok) {
  const recovered = recoverFailedMigration(migrateResult.output);
  if (recovered) {
    console.log('[railway-start] Retrying prisma migrate deploy after recovery...');
    migrateResult = runPrisma('migrate deploy', { allowFailure: true });
  }
}

if (!migrateResult.ok) {
  console.error('[railway-start] FATAL: prisma migrate deploy failed after recovery attempt.');
  process.exit(1);
}

console.log('[railway-start] Migrations applied successfully.');
console.log('[railway-start] Starting API (node dist/main.js)...');
execSync('node dist/main.js', { cwd: apiRoot, stdio: 'inherit', env: process.env });
