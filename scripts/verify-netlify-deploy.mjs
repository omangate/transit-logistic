#!/usr/bin/env node
const BASE = 'https://transit-logistic-web-test.netlify.app';

const routes = [
  '/',
  '/ar',
  '/en',
  '/ar/login',
  '/ar/dashboard',
  '/ar/logistics',
  '/ar/customs',
  '/ar/freight',
  '/ar/marketplace',
  '/ar/ocean/carriers',
  '/ar/track',
  '/health/live',
  '/en/login',
  '/en/dashboard',
];

async function checkRoute(path, opts = {}) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: opts.mobile ? { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' } : {},
    });
    const html = await res.text();
    const dir = html.match(/\bdir=["'](rtl|ltr)["']/i)?.[1]?.toLowerCase();
    const lang = html.match(/\blang=["'](ar|en)["']/i)?.[1]?.toLowerCase();
    return {
      path,
      status: res.status,
      ok: res.status >= 200 && res.status < 400,
      dir,
      lang,
      hasNext: html.includes('__next') || html.includes('_next'),
      title: html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.slice(0, 80) ?? null,
    };
  } catch (error) {
    return { path, ok: false, error: error.message };
  }
}

async function checkApi() {
  const url = `${BASE}/api/v1/health/live`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    return { url, status: res.status, body: text.slice(0, 200) };
  } catch (error) {
    return { url, error: error.message };
  }
}

async function main() {
  console.log('=== Route verification ===');
  const desktop = [];
  for (const path of routes) {
    desktop.push(await checkRoute(path));
  }
  console.log(JSON.stringify(desktop, null, 2));

  console.log('\n=== Mobile /ar ===');
  console.log(JSON.stringify(await checkRoute('/ar', { mobile: true }), null, 2));
  console.log(JSON.stringify(await checkRoute('/ar/login', { mobile: true }), null, 2));

  console.log('\n=== Railway API proxy ===');
  console.log(JSON.stringify(await checkApi(), null, 2));

  const failed = desktop.filter((r) => !r.ok);
  process.exit(failed.length ? 1 : 0);
}

main();
