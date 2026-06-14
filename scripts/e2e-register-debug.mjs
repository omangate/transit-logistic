import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:3002';
const API = process.env.API_URL ?? 'http://127.0.0.1:3001';

const email = process.env.TEST_EMAIL ?? `e2e-${Date.now()}@example.com`;
const password = 'Test1234';

async function main() {
  console.log('API health...');
  const health = await fetch(`${API}/api/v1/health/live`).then((r) => r.status).catch(() => 0);
  console.log('  health/live:', health);
  if (health !== 200) {
    console.error('API not reachable at', API);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleErrors = [];
  const network = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('request', (req) => {
    if (req.url().includes('/api/v1/auth/register')) {
      network.push({ type: 'request', url: req.url(), method: req.method() });
    }
  });

  page.on('response', async (res) => {
    if (res.status() === 404) {
      consoleErrors.push(`404: ${res.url()}`);
    }
    if (res.url().includes('/api/v1/auth/register')) {
      let body = '';
      try {
        body = await res.text();
      } catch {
        body = '<unreadable>';
      }
      network.push({
        type: 'response',
        url: res.url(),
        status: res.status(),
        body: body.slice(0, 500),
      });
    }
  });

  console.log('\nNavigate to', `${WEB}/ar/register`);
  await page.goto(`${WEB}/ar/register`, { waitUntil: 'networkidle' });

  // Fill form - customer role (default)
  await page.selectOption('select[name="role"]', 'customer');
  await page.fill('input[name="name"]', 'E2E Test User');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);

  console.log('Submitting registration for', email);
  await page.click('button[type="submit"]');

  await page.waitForTimeout(5000);

  const url = page.url();
  const alertText = await page.locator('[role="alert"]').textContent().catch(() => null);
  const buttonText = await page.locator('button[type="submit"]').textContent();

  console.log('\n--- RESULT ---');
  console.log('Final URL:', url);
  console.log('Alert/error:', alertText ?? '(none)');
  console.log('Submit button:', buttonText);
  console.log('Register network:', JSON.stringify(network, null, 2));
  console.log('Console errors:', consoleErrors.length ? consoleErrors : '(none)');

  const localStorage = await page.evaluate(() => ({
    token: localStorage.getItem('tl_access_token')?.slice(0, 20),
    user: localStorage.getItem('tl_user'),
  }));
  console.log('LocalStorage:', localStorage);

  // Test login if register redirected
  if (url.includes('/dashboard')) {
    console.log('\nRegistration redirect OK');
  } else {
    console.log('\nRegistration FAILED to redirect');
  }

  await browser.close();

  process.exit(url.includes('/dashboard') ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
