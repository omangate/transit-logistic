const PRODUCTION_API = 'https://transit-logistic-production.up.railway.app/api/v1';
const PRODUCTION_WEB = 'https://insightful-forgiveness-production-6c81.up.railway.app';

const BASE = process.env.API_URL ?? PRODUCTION_API;
const WEB = process.env.WEB_URL ?? PRODUCTION_WEB;
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* */ }
  return { code: res.status, text, json };
}

function resolveCredential(role, emailDefault) {
  const email = process.env[`VERIFY_${role}_EMAIL`] ?? emailDefault;
  const password =
    process.env[`VERIFY_${role}_PASSWORD`] ??
    process.env[`SEED_${role}_PASSWORD`] ??
    process.env.SEED_DEMO_PASSWORD ??
    null;
  return { email, password };
}

async function login(role, emailDefault) {
  const { email, password } = resolveCredential(role, emailDefault);
  if (!password) {
    record(`Login ${email}`, true, 'skipped (set VERIFY_*_PASSWORD or SEED_DEMO_PASSWORD)');
    return null;
  }
  const r = await req('POST', '/auth/login', { email, password });
  record(`Login ${email}`, r.code === 200 || r.code === 201);
  return r.json?.accessToken ?? null;
}

async function webPage(path) {
  try {
    const res = await fetch(`${WEB}${path}`);
    record(`Web ${path}`, res.status === 200, `HTTP ${res.status}`);
    return res.status === 200;
  } catch (e) {
    record(`Web ${path}`, false, String(e));
    return false;
  }
}

// Health
const health = await req('GET', '/health');
record('Health full (DB+Redis)', health.code === 200, `HTTP ${health.code}`);

const live = await req('GET', '/health/live');
record('Health live', live.code === 200);

// Roles — credentials from VERIFY_* or SEED_* env (never hardcoded in production)
const customer = await login('CUSTOMER', 'customer@transit.dev');
const admin = await login('ADMIN', 'admin@transit.dev');
const fleet = await login('FLEET', 'fleet@transit.dev');
const driver = await login('DRIVER', 'driver@transit.dev');

if (customer) {
  const me = await req('GET', '/users/me', null, customer);
  record('User profile API', me.code === 200, me.json?.role);

  const before = await req('GET', '/admin/dashboard/metrics', null, admin);
  const beforeTotal = before.json?.shipments?.total ?? 0;

  const create = await req('POST', '/shipments', {
    cargoDescription: 'Production verify',
    weightKg: 5,
    stops: [
      { address: 'Pickup', city: 'Muscat', latitude: 23.588, longitude: 58.3829, stopType: 'pickup' },
      { address: 'Delivery', city: 'Salalah', latitude: 17.0151, longitude: 54.0924, stopType: 'delivery' },
    ],
  }, customer);
  record('Create shipment', create.code === 200 || create.code === 201);
  const shipId = create.json?.id;
  const ref = create.json?.referenceNumber;

  if (shipId) {
    const edit = await req('PATCH', `/shipments/${shipId}`, { cargoDescription: 'Edited verify' }, customer);
    record('Edit shipment', edit.code === 200);

    const quote = await req('GET', `/shipments/${shipId}/payment-quote`, null, customer);
    record('Payment quote', quote.code === 200);

    const intent = await req('POST', `/shipments/${shipId}/payment-intent`, {}, customer);
    record('Payment intent', intent.code === 200 || intent.code === 201);

    const verify = await req('POST', `/shipments/${shipId}/payment/verify`, {}, customer);
    record('Payment verify', verify.code === 200 || verify.code === 201, verify.json?.shipment?.status);

    if (ref) {
      const track = await req('GET', `/public/track/${ref}`);
      record('Public tracking', track.code === 200, track.json?.status);
    }
  }

  const notifs = await req('GET', '/notifications?page=1&limit=5', null, customer);
  record('Notifications', notifs.code === 200, `${notifs.json?.data?.length ?? 0} items`);

  const dash = await req('GET', '/shipments?page=1&limit=1', null, customer);
  record('Customer dashboard data', dash.code === 200);
}

if (admin) {
  const metrics = await req('GET', '/admin/dashboard/metrics', null, admin);
  record('Admin dashboard metrics', metrics.code === 200, `total=${metrics.json?.shipments?.total}`);
  const settings = await req('GET', '/settings', null, admin);
  record('Admin settings', settings.code === 200);

  const list = await req('GET', '/admin/shipments?page=1&limit=10', null, admin);
  const pending = list.json?.data?.find((s) => s.status === 'pending_assignment');
  if (pending) {
    const status = await req('PATCH', `/admin/shipments/${pending.id}/status`, { status: 'assigned', note: 'verify' }, admin);
    record('Admin status update', status.code === 200, status.json?.status);
  } else {
    record('Admin status update', true, 'skipped (no pending)');
  }
}

if (fleet) {
  const available = await req('GET', '/fleet/shipments/available?page=1&limit=5', null, fleet);
  record('Fleet shipments paginated', available.code === 200);
  const profile = await req('GET', '/fleet/profile', null, fleet);
  record('Fleet profile', profile.code === 200);

  const fleetLogistics = await req('GET', '/fleet/logistics/dashboard', null, fleet);
  record('Fleet logistics dashboard', fleetLogistics.code === 200);

  const fleetDeniedCustomerLogistics = await req('GET', '/logistics/orders/dashboard', null, fleet);
  record('Fleet denied customer logistics dashboard', fleetDeniedCustomerLogistics.code === 403, `HTTP ${fleetDeniedCustomerLogistics.code}`);
}

if (driver) {
  const active = await req('GET', '/driver/shipments/active', null, driver);
  record('Driver active shipment', active.code === 200);
}

// Tracking cache (Redis)
if (driver) {
  const active = await req('GET', '/driver/shipments/active', null, driver);
  const shipId = active.json?.id;
  if (shipId) {
    const point = await req('POST', `/driver/shipments/${shipId}/tracking`, {
      latitude: 24.7136,
      longitude: 46.6753,
      speed: 30,
    }, driver);
    record('Tracking point + cache', point.code === 200 || point.code === 201);
    const liveTrack = await req('GET', `/shipments/${shipId}/tracking/live`, null, driver);
    record('Live tracking cache read', liveTrack.code === 200, liveTrack.json?.latitude);
  }
}

// Marketplace (public + geography)
const marketplaceHome = await req('GET', '/marketplace/home');
record('Marketplace home', marketplaceHome.code === 200, `${marketplaceHome.json?.featured?.length ?? 0} featured`);

const trucks = await req('GET', '/marketplace/trucks?page=1&limit=5');
record('Marketplace browse trucks', trucks.code === 200, `${trucks.json?.items?.length ?? 0} items`);

const gov = await req('GET', '/geography/countries/OM/governorates');
record('Oman governorates', gov.code === 200, `${gov.json?.length ?? 0} governorates`);

if (customer) {
  const logisticsDash = await req('GET', '/logistics/orders/dashboard', null, customer);
  record('Logistics customer dashboard', logisticsDash.code === 200);

  const customsList = await req('GET', '/customs/requests', null, customer);
  record('Customs requests list', customsList.code === 200);

  const freightList = await req('GET', '/freight/shipments', null, customer);
  record('Freight shipments list', freightList.code === 200);
}

if (admin) {
  const customsOps = await req('GET', '/admin/customs/dashboard', null, admin);
  record('Admin customs dashboard', customsOps.code === 200);

  const logisticsOps = await req('GET', '/admin/logistics/dashboard', null, admin);
  record('Admin logistics ops dashboard', logisticsOps.code === 200);

  const templates = await req('GET', '/admin/logistics/checklist-templates', null, admin);
  record('Admin checklist templates', templates.code === 200);
}

if (customer) {
  const containers = await req('GET', '/logistics/containers?logisticsOrderId=00000000-0000-0000-0000-000000000000', null, customer);
  record('Logistics containers RBAC', containers.code === 403 || containers.code === 404, `HTTP ${containers.code}`);
}


if (customer) {
  const favIds = await req('GET', '/marketplace/favorites/ids', null, customer);
  record('Customer favorite truck ids', favIds.code === 200);
}

if (fleet) {
  const fleetTrucks = await req('GET', '/fleet/marketplace/trucks', null, fleet);
  record('Fleet marketplace listings', fleetTrucks.code === 200, `${fleetTrucks.json?.length ?? 0} listings`);
  const fleetQuotes = await req('GET', '/marketplace/quotes/fleet', null, fleet);
  record('Fleet quote inbox', fleetQuotes.code === 200);
}

// Web locales + portals (static shell)
await webPage('/en/login');
await webPage('/ar/login');
await webPage('/en/dashboard');
await webPage('/ar/dashboard');
await webPage('/en/admin/dashboard');
await webPage('/en/fleet/dashboard');
await webPage('/en/fleet/logistics');
await webPage('/ar/fleet/logistics');
await webPage('/en/driver/dashboard');
await webPage('/en/track');
await webPage('/ar/marketplace');
await webPage('/en/marketplace');
await webPage('/ar/marketplace/favorites');
await webPage('/en/marketplace/quotes');
await webPage('/en/customs');
await webPage('/ar/customs');
await webPage('/en/freight');
await webPage('/en/logistics');
await webPage('/en/admin/logistics');
await webPage('/en/admin/logistics/checklist-templates');
await webPage('/ar/admin/logistics');
await webPage('/health/live');

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`\nVERIFY SUMMARY: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
