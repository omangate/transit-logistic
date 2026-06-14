import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', (msg) => console.log('CONSOLE', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('PAGEERROR', err.message));

await page.goto('http://localhost:3000/ar/register', { waitUntil: 'networkidle' });
await page.fill('input[name="name"]', 'Test');
await page.fill('input[name="email"]', 'alharithlap@gmail.com');
await page.fill('input[name="password"]', 'Test1234');
await page.fill('input[name="confirmPassword"]', 'Test1234');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

const alertCount = await page.locator('[role="alert"]').count();
const alertText = await page.locator('[role="alert"]').textContent().catch(() => null);
const html = await page.locator('form').evaluate((el) => el.parentElement?.innerHTML.slice(0, 800));
console.log('Alert count:', alertCount);
console.log('Alert:', alertText);
console.log('Form parent HTML snippet:', html);
await browser.close();
