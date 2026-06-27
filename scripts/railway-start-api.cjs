const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

const repoRoot = process.cwd();
const apiRoot = existsSync(join(repoRoot, 'apps', 'api', 'dist', 'main.js'))
  ? join(repoRoot, 'apps', 'api')
  : repoRoot;

const mainPath = join(apiRoot, 'dist', 'main.js');
const schemaPath = join(apiRoot, 'prisma', 'schema.prisma');
const startScript = join(apiRoot, 'scripts', 'start-production.cjs');

function log(label, value) {
  console.log(`[railway-start] ${label}=${value}`);
}

log('repoRoot', repoRoot);
log('apiRoot', apiRoot);

if (existsSync(startScript)) {
  execSync(`node "${startScript}"`, { stdio: 'inherit', env: process.env, cwd: apiRoot });
  process.exit(0);
}

log('PORT', process.env.PORT ?? '(unset)');
log('API_PORT', process.env.API_PORT ?? '(unset)');
log('DATABASE_URL', process.env.DATABASE_URL ? 'set' : 'MISSING');
log('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET ? 'set' : 'MISSING');

if (!process.env.DATABASE_URL) {
  console.error('[railway-start] FATAL: DATABASE_URL is not configured.');
  process.exit(1);
}

if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.error('[railway-start] FATAL: JWT secrets are not configured.');
  process.exit(1);
}

if (!existsSync(mainPath)) {
  console.error(`[railway-start] FATAL: ${mainPath} not found.`);
  process.exit(1);
}

execSync(`npx prisma migrate deploy --schema="${schemaPath}"`, {
  cwd: apiRoot,
  stdio: 'inherit',
  env: process.env,
});

execSync('node dist/main.js', { cwd: apiRoot, stdio: 'inherit', env: process.env });
