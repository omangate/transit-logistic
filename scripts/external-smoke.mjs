/**
 * External smoke test for staging/preview URLs (no auth secrets).
 */
const WEB = process.env.WEB_URL ?? 'https://transit-logistic-web-staging-staging.up.railway.app';
const API = process.env.API_URL ?? 'https://transit-logistic-api-staging-staging.up.railway.app';

const PATHS = [
  '/',
  '/ar',
  '/en',
  '/ar/login',
  '/ar/register',
  '/ar/dashboard',
  '/ar/logistics',
  '/ar/ocean/carriers',
  '/ar/ocean/schedules',
  '/ar/documents',
  '/ar/payments',
  '/ar/ai',
  '/ar/admin/operations',
  '/ar/admin/integrations/ocean-carriers',
  '/health/live',
  '/api/v1/health/live',
  '/api/v1/ocean/carriers',
  '/api/v1/geography/ports/search?q=dubai',
];

async function check(path) {
  const base = path.startsWith('/api') || path === '/health/live' ? API : WEB;
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const ok = res.status < 400;
    return { path, status: res.status, ok };
  } catch (err) {
    return { path, status: 0, ok: false, error: String(err) };
  }
}

async function main() {
  console.log('External smoke test');
  console.log('WEB:', WEB);
  console.log('API:', API);
  const results = await Promise.all(PATHS.map(check));
  for (const r of results) console.log(r.ok ? 'PASS' : 'FAIL', r.path, r.status);
  const pass = results.every((r) => r.ok);
  process.exit(pass ? 0 : 1);
}

main();
