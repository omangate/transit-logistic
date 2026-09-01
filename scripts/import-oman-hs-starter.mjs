/**
 * Import GCC/WCO harmonized heading starter records (descriptions only — no duty rates).
 * Usage: node scripts/import-oman-hs-starter.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = (process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1').replace(/\/$/, '');
const DATA = path.join(__dirname, 'data', 'oman-hs-gcc-headings-starter.json');

async function login() {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.VERIFY_ADMIN_EMAIL ?? 'admin@transit.dev', password: process.env.SEED_DEMO_PASSWORD ?? 'Admin1234' }),
  });
  const j = await r.json();
  return j.accessToken;
}

const records = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const token = await login();
if (!token) {
  console.error('Admin login failed');
  process.exit(1);
}

const form = new FormData();
form.append('file', new Blob([JSON.stringify(records)], { type: 'application/json' }), 'oman-hs-gcc-headings-starter.json');
form.append('tariffVersion', 'GCC-2025');
form.append('tariffYear', '2025');
form.append('archivePrevious', 'true');
form.append('notes', 'Starter import — WCO/GCC heading descriptions without duty rates; admin verification required');

const res = await fetch(`${API}/admin/customs/hs-tariff/import`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
console.log('Import status', res.status, await res.text());

const stats = await fetch(`${API}/admin/customs/hs-tariff/stats`, { headers: { Authorization: `Bearer ${token}` } });
console.log('Stats', await stats.json());
