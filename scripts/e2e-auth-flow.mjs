import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://127.0.0.1:3001';

const password = 'Test1234';

async function runRegistration(page, email) {
  const consoleErrors = [];
  const network = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (res) => {
    if (res.status() === 404) consoleErrors.push(`404: ${res.url()}`);
    if (res.url().includes('/api/v1/auth/register')) {
      network.push({ status: res.status(), url: res.url() });
    }
  });

  await page.goto(`${WEB}/ar/register`, { waitUntil: 'networkidle' });
  await page.selectOption('select[name="role"]', 'customer');
  await page.fill('input[name="name"]', 'E2E Test User');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);

  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/register') || url.search.includes('password'), {
      timeout: 15000,
    }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  await page.waitForTimeout(2000);

  const url = page.url();
  const alertText = await page.locator('[role="alert"]').first().textContent().catch(() => null);
  const token = await page.evaluate(() => localStorage.getItem('tl_access_token'));

  return { url, alertText, token, consoleErrors, network };
}

async function runLogin(page, email) {
  await page.goto(`${WEB}/ar/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  await Promise.all([
    page.waitForURL((url) => url.pathname.includes('/dashboard'), { timeout: 15000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  await page.waitForTimeout(2000);

  const url = page.url();
  const alertText = await page.locator('[role="alert"]').first().textContent().catch(() => null);
  const token = await page.evaluate(() => localStorage.getItem('tl_access_token'));

  return { url, alertText, token };
}

async function main() {
  const health = await fetch(`${API}/api/v1/health/live`).then((r) => r.status).catch(() => 0);
  if (health !== 200) {
    console.error('API not reachable');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const newEmail = `e2e-${Date.now()}@example.com`;
  console.log('\n=== NEW USER REGISTRATION ===');
  console.log('Email:', newEmail);
  const reg = await runRegistration(page, newEmail);
  console.log('URL:', reg.url);
  console.log('Alert:', reg.alertText ?? '(none)');
  console.log('Token:', reg.token ? `${reg.token.slice(0, 20)}...` : '(none)');
  console.log('404 errors:', reg.consoleErrors.filter((e) => e.startsWith('404')).length);
  console.log('Register API calls:', reg.network);

  const regOk = reg.url.includes('/dashboard') && reg.token;
  console.log('Registration OK:', regOk);

  console.log('\n=== EXISTING USER LOGIN ===');
  const existingEmail = 'alharithlap@gmail.com';
  const login = await runLogin(page, existingEmail);
  console.log('Email:', existingEmail);
  console.log('URL:', login.url);
  console.log('Alert:', login.alertText ?? '(none)');
  console.log('Token:', login.token ? `${login.token.slice(0, 20)}...` : '(none)');

  const loginOk = login.url.includes('/dashboard') && login.token;
  console.log('Login OK:', loginOk);

  console.log('\n=== EXISTING USER REGISTER (expect error) ===');
  const dup = await runRegistration(page, existingEmail);
  console.log('URL:', dup.url);
  console.log('Alert:', dup.alertText ?? '(none)');
  const dupOk = dup.url.includes('/register') && dup.alertText && !dup.url.includes('password=');
  console.log('Duplicate register shows error (no URL leak):', dupOk);

  await browser.close();

  const allOk = regOk && loginOk && dupOk;
  console.log('\n=== OVERALL:', allOk ? 'PASS' : 'FAIL', '===');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
