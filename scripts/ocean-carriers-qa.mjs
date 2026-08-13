/**
 * Ocean carriers directory QA — customer EN/AR, network checks.
 * Usage: node scripts/ocean-carriers-qa.mjs
 */
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'https://transit-logistic-web-staging-staging.up.railway.app';
const API = process.env.API_URL ?? 'https://transit-logistic-api-staging-staging.up.railway.app';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

const LOCALES = ['ar', 'en'];
const EXPECTED_CARRIERS = [
  'Maersk',
  'Hapag-Lloyd',
  'MSC',
  'CMA CGM',
  'COSCO Shipping',
  'Ocean Network Express',
  'Evergreen Line',
  'Yang Ming',
  'ZIM',
];

async function login(page, email, password) {
  await page.goto(`${WEB}/en/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(en|ar)\/(dashboard|shipments|logistics)/, { timeout: 30000 });
}

async function main() {
  const report = {
    apiCarriers: null,
    admin401: null,
    consoleErrors: 0,
    unauthorized401: 0,
    carriersFound: 0,
    locales: {},
    viewports: {},
    rawUnauthorizedVisible: false,
  };

  const apiRes = await fetch(`${API}/api/v1/ocean/carriers`);
  report.apiCarriers = apiRes.status;
  const carriers = await apiRes.json();
  report.carriersFound = Array.isArray(carriers) ? carriers.length : 0;

  const adminRes = await fetch(`${API}/api/v1/admin/integrations/ocean-carriers`);
  report.admin401 = adminRes.status;

  const browser = await chromium.launch({ headless: true });

  for (const locale of LOCALES) {
    report.locales[locale] = { pass: true, issues: [] };
    const page = await browser.newPage();
    const consoleErrors = [];
    const failed401 = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('response', (res) => {
      const url = res.url();
      if (res.status() === 401 && url.includes('/api/v1/') && !url.includes('/auth/')) {
        failed401.push(url);
      }
    });

    await login(page, 'customer@transit.dev', 'Customer1234');
    await page.goto(`${WEB}/${locale}/ocean/carriers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const bodyText = await page.locator('body').innerText();
    if (/\bUnauthorized\b/.test(bodyText)) {
      report.rawUnauthorizedVisible = true;
      report.locales[locale].pass = false;
      report.locales[locale].issues.push('Raw Unauthorized visible');
    }

    for (const name of EXPECTED_CARRIERS) {
      if (!bodyText.includes(name)) {
        report.locales[locale].pass = false;
        report.locales[locale].issues.push(`Missing carrier: ${name}`);
      }
    }

    if (!bodyText.includes(locale === 'ar' ? 'تتبع خارجي' : 'EXTERNAL TRACKING')) {
      report.locales[locale].pass = false;
      report.locales[locale].issues.push('External tracking badge missing');
    }

    report.consoleErrors += consoleErrors.length;
    report.unauthorized401 += failed401.length;

    for (const viewport of VIEWPORTS) {
      const key = `${locale}-${viewport.name}`;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.reload({ waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      report.viewports[key] = overflow ? 'FAIL overflow' : 'PASS';
      if (overflow) report.locales[locale].pass = false;
    }

    await page.close();
  }

  await browser.close();

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
