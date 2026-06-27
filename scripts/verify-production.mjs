const BASE = process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:3000';
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

async function login(email, password) {
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

// Roles
const customer = await login('phase1test@example.com', 'Password1');
const admin = await login('admin@transit.dev', 'Admin1234');
const fleet = await login('fleet@transit.dev', 'Fleet1234');
const driver = await login('driver@transit.dev', 'Driver1234');

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

if (admin) {
  const mpMetrics = await req('GET', '/admin/marketplace/metrics', null, admin);
  record('Admin marketplace metrics', mpMetrics.code === 200);
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
await webPage('/en/driver/dashboard');
await webPage('/en/track');
await webPage('/ar/marketplace');
await webPage('/en/marketplace');
await webPage('/ar/marketplace/favorites');
await webPage('/en/marketplace/quotes');

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`\nVERIFY SUMMARY: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
