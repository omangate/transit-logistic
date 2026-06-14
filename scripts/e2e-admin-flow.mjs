import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:3003';
const API = process.env.API_URL ?? 'http://127.0.0.1:3004';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@transit.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin1234';

const ADMIN_PAGES = [
  { path: '/ar/admin/dashboard', titleKey: 'dashboard' },
  { path: '/ar/admin/shipments', titleKey: 'shipments' },
  { path: '/ar/admin/customers', titleKey: 'customers' },
  { path: '/ar/admin/fleet-owners', titleKey: 'fleetOwners' },
  { path: '/ar/admin/drivers', titleKey: 'drivers' },
  { path: '/ar/admin/vehicles', titleKey: 'vehicles' },
  { path: '/ar/admin/payments', titleKey: 'payments' },
  { path: '/ar/admin/payouts', titleKey: 'payouts' },
  { path: '/ar/admin/ratings', titleKey: 'ratings' },
  { path: '/ar/admin/settings', titleKey: 'settings' },
];

async function apiLogin() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`API login failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function seedAdminSession(page, session) {
  await page.goto(`${WEB}/ar/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ accessToken, refreshToken, user }) => {
      localStorage.setItem('tl_access_token', accessToken);
      localStorage.setItem('tl_refresh_token', refreshToken);
      localStorage.setItem('tl_user', JSON.stringify(user));
    },
    {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    },
  );
  await page.goto(`${WEB}/ar/admin/dashboard`, { waitUntil: 'networkidle' });
}

async function testAdminApis(token) {
  const headers = { Authorization: `Bearer ${token}` };
  const endpoints = [
    '/admin/dashboard/metrics',
    '/admin/customers',
    '/admin/fleet-owners',
    '/admin/ratings?page=1&limit=5',
    '/payments/history?page=1&limit=5',
    '/fleet/drivers',
    '/fleet/vehicles',
    '/admin/payouts/summary',
    '/settings',
  ];

  const results = [];
  for (const path of endpoints) {
    const res = await fetch(`${API}/api/v1${path}`, { headers });
    results.push({ path, ok: res.ok, status: res.status });
    console.log(`API ${res.ok ? 'PASS' : 'FAIL'} ${path} (${res.status})`);
  }
  return results.every((r) => r.ok);
}

async function main() {
  const health = await fetch(`${API}/api/v1/health/live`).then((r) => r.status).catch(() => 0);
  if (health !== 200) {
    console.error('API not reachable at', API);
    process.exit(1);
  }

  console.log('\n=== API LOGIN & ENDPOINTS ===');
  const session = await apiLogin();
  console.log('Admin role:', session.user.role);
  const apisOk = await testAdminApis(session.accessToken);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('\n=== ADMIN UI (session injected) ===');
  await seedAdminSession(page, session);
  const dashUrl = page.url();
  console.log('Dashboard URL:', dashUrl);
  const loginRedirectOk = dashUrl.includes('/ar/admin/dashboard');

  const results = [];
  for (const item of ADMIN_PAGES) {
    await page.goto(`${WEB}${item.path}`, { waitUntil: 'networkidle' });
    if (item.path.includes('/admin/dashboard')) {
      await page.waitForSelector('.stat-card', { timeout: 15000 }).catch(() => null);
    } else {
      await page.waitForTimeout(1500);
    }

    const url = page.url();
    const title = await page.locator('.portal-header__title').textContent().catch(() => null);
    const sidebarLinks = await page.locator('.admin-sidebar .portal-sidebar__link').count();
    const alertTexts = await page.locator('[role="alert"]').allTextContents();
    const hasErrorAlert = alertTexts.some((text) => text.trim().length > 0);
    const ok = url.includes(item.path.split('?')[0]) && !!title && sidebarLinks >= 10 && !hasErrorAlert;

    results.push({ path: item.path, ok, title: title?.trim() });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${item.path} — ${title?.trim() ?? '(no title)'}`);
  }

  await page.goto(`${WEB}/ar/admin/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stat-card', { timeout: 15000 }).catch(() => null);
  const statCards = await page.locator('.stat-card').count();
  console.log('\nDashboard stat cards:', statCards);
  const metricsOk = statCards >= 8;

  console.log('\n=== ADMIN FORM LOGIN ===');
  const loginPage = await browser.newPage();
  await loginPage.goto(`${WEB}/ar/login`, { waitUntil: 'networkidle' });
  await loginPage.fill('input[name="email"]', ADMIN_EMAIL);
  await loginPage.fill('input[name="password"]', ADMIN_PASSWORD);
  await Promise.all([
    loginPage.waitForURL((url) => url.pathname.includes('/admin/dashboard'), { timeout: 20000 }),
    loginPage.click('button[type="submit"]'),
  ]);
  const formLoginOk = loginPage.url().includes('/ar/admin/dashboard');
  console.log('Form login redirect OK:', formLoginOk);
  await loginPage.close();

  await browser.close();

  const allPagesOk = results.every((r) => r.ok);
  const overall = apisOk && loginRedirectOk && formLoginOk && allPagesOk && metricsOk;
  console.log('\n=== OVERALL:', overall ? 'PASS' : 'FAIL', '===');
  process.exit(overall ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
