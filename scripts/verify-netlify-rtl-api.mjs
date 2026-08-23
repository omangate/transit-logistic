const BASE = 'https://transit-logistic-web-test.netlify.app';

async function page(path) {
  const html = await (await fetch(BASE + path)).text();
  return {
    path,
    dir: html.match(/\bdir=["'](rtl|ltr)["']/i)?.[1] ?? null,
    lang: html.match(/\blang=["'](ar|en)["']/i)?.[1] ?? null,
    viewport: html.includes('width=device-width'),
  };
}

async function main() {
  const ar = await page('/ar');
  const en = await page('/en');
  const arLogin = await page('/ar/login');
  const health = await fetch(`${BASE}/api/v1/health`).then((r) => r.json());
  const marketplace = await fetch(`${BASE}/api/v1/marketplace/home?page=1&limit=1`).then(async (r) => ({
    status: r.status,
    ok: r.ok,
    snippet: (await r.text()).slice(0, 150),
  }));

  console.log(JSON.stringify({ ar, en, arLogin, health, marketplace }, null, 2));
}

main();
