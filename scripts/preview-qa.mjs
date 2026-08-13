/**
 * Preview QA — role × locale × viewport smoke checks.
 * Usage: node scripts/preview-qa.mjs
 * Env: WEB_URL, API_URL (defaults to preview URLs)
 */
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'https://web-rosy-rho-64.vercel.app';
const API = process.env.API_URL ?? 'https://transit-logistic-production.up.railway.app';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

const LOCALES = ['en', 'ar'];

const ROLE_ROUTES = {
  customer: ['/dashboard', '/shipments', '/documents', '/payments', '/ai', '/freight/request'],
  fleet: ['/fleet/dashboard', '/fleet/shipments', '/fleet/logistics'],
  driver: ['/driver/dashboard'],
  admin: ['/admin/dashboard', '/admin/shipments', '/admin/integrations/ocean-carriers', '/admin/operations'],
};

const CREDENTIALS = {
  customer: { email: 'customer@test.com', password: 'Test1234' },
  fleet: { email: 'fleet@test.com', password: 'Test1234' },
  driver: { email: 'driver@test.com', password: 'Test1234' },
  admin: { email: 'admin@test.com', password: 'Test1234' },
};

const results = {
  api: false,
  roles: {},
  locales: { en: true, ar: true },
  mobile: true,
  pages: [],
};

async function checkApi() {
  try {
    const res = await fetch(`${API}/api/v1/health/live`, { signal: AbortSignal.timeout(15000) });
    results.api = res.status === 200;
    return results.api;
  } catch {
    results.api = false;
    return false;
  }
}

async function login(page, role) {
  const cred = CREDENTIALS[role];
  await page.goto(`${WEB}/en/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('input[name="email"]', cred.email);
  await page.fill('input[name="password"]', cred.password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  const token = await page.evaluate(() => localStorage.getItem('tl_access_token'));
  return Boolean(token);
}

async function checkRoute(page, locale, path) {
  const url = `${WEB}/${locale}${path}`;
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = res?.status() ?? 0;
    const body = await page.locator('body').innerText().catch(() => '');
    const hasError = body.includes('Application error') || body.includes('500') || status >= 500;
    const ok = status < 400 && !hasError;
    results.pages.push({ url, status, ok });
    return ok;
  } catch (err) {
    results.pages.push({ url, status: 0, ok: false, error: String(err) });
    return false;
  }
}

async function main() {
  console.log('Preview QA');
  console.log('WEB:', WEB);
  console.log('API:', API);

  await checkApi();
  console.log('API health:', results.api ? 'PASS' : 'FAIL');

  const browser = await chromium.launch({ headless: true });

  for (const [role, routes] of Object.entries(ROLE_ROUTES)) {
    const page = await browser.newPage();
    const loggedIn = await login(page, role);
    if (!loggedIn) {
      results.roles[role] = false;
      console.log(`${role}: FAIL (login)`);
      await page.close();
      continue;
    }

    let roleOk = true;
    for (const locale of LOCALES) {
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        for (const route of routes.slice(0, 2)) {
          const ok = await checkRoute(page, locale, route);
          if (!ok) roleOk = false;
          if (locale === 'ar' && !ok) results.locales.ar = false;
          if (locale === 'en' && !ok) results.locales.en = false;
          if (vp.name === 'mobile' && !ok) results.mobile = false;
        }
      }
    }
    results.roles[role] = roleOk;
    console.log(`${role}:`, roleOk ? 'PASS' : 'FAIL');
    await page.close();
  }

  // Public pages (no auth)
  const publicPage = await browser.newPage();
  for (const locale of LOCALES) {
    for (const path of ['/track', '/ocean/carriers', '/ocean/schedules']) {
      await publicPage.setViewportSize({ width: 390, height: 844 });
      const ok = await checkRoute(publicPage, locale, path);
      if (locale === 'ar' && !ok) results.locales.ar = false;
      if (locale === 'en' && !ok) results.locales.en = false;
    }
  }
  await publicPage.close();
  await browser.close();

  const passed = Object.values(results.roles).filter(Boolean).length;
  const total = Object.keys(results.roles).length;
  const readiness = Math.round(((passed / total) * 0.6 + (results.api ? 0.2 : 0) + (results.locales.en && results.locales.ar ? 0.2 : 0)) * 100);

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({ ...results, readiness }, null, 2));
  process.exit(results.api && passed === total && results.locales.en && results.locales.ar ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
