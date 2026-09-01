/**
 * End-to-end verification for Oman customs declaration prep module.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = (process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1').replace(/\/$/, '');
const FIXTURES = path.join(__dirname, 'fixtures', 'customs-docs');

const report = {
  realDocumentExtraction: 'FAIL',
  invoiceExtraction: 'FAIL',
  packingListExtraction: 'FAIL',
  blExtraction: 'FAIL',
  discrepancyDetection: 'FAIL',
  minimumManualFieldsAchieved: 'NO',
  hsSuggestions: 'FAIL',
  bayanCopyPaste: 'FAIL',
  rbac: 'FAIL',
};

async function req(method, urlPath, { token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !formData) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${urlPath}`, { method, headers, body: formData ?? (body ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 500) }; }
  return { status: res.status, json, text };
}

async function login(email, password) {
  const r = await req('POST', '/auth/login', { body: { email, password } });
  return r.status === 200 || r.status === 201 ? r.json?.accessToken : null;
}

function fieldVal(fields, key) {
  return fields.find((f) => f.fieldKey === key)?.displayValue;
}

const demoPassword = process.env.SEED_DEMO_PASSWORD;
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? demoPassword ?? 'Admin1234';
const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? demoPassword ?? 'Customer1234';
const admin = await login('admin@transit.dev', adminPassword);
let customer = await login('customer@transit.dev', customerPassword);
if (!customer && demoPassword && customerPassword !== 'Customer1234') {
  customer = await login('customer@transit.dev', 'Customer1234');
}

const rbacChecks = [];
rbacChecks.push({ check: 'admin login', ok: Boolean(admin) });
rbacChecks.push({ check: 'customer login', ok: Boolean(customer) });

if (!admin) {
  console.log('FAIL: admin login');
  process.exit(1);
}

const custDraft = await req('GET', '/admin/customs/requests/00000000-0000-4000-8000-000000000001/declaration-draft', { token: customer });
rbacChecks.push({ check: 'customer blocked from admin draft', ok: custDraft.status === 401 || custDraft.status === 403, status: custDraft.status });

const created = await req('POST', '/customs/requests', { token: admin, body: { transactionType: 'import' } });
const requestId = created.json?.id;
console.log('Request', requestId);

const form = new FormData();
for (const [file, category] of [
  ['commercial-invoice-qa.pdf', 'commercial_invoice'],
  ['packing-list-qa.pdf', 'packing_list'],
  ['bill-of-lading-qa.pdf', 'bill_of_lading'],
]) {
  form.append('files', new Blob([fs.readFileSync(path.join(FIXTURES, file))], { type: 'application/pdf' }), file);
}
form.append('categories', JSON.stringify(['commercial_invoice', 'packing_list', 'bill_of_lading']));

const upload = await req('POST', `/admin/customs/requests/${requestId}/documents/upload-and-extract`, { token: admin, formData: form });
console.log('Upload', upload.status);

const draft = upload.json;
const fields = draft.fields ?? [];

console.log('\n--- Key extracted values ---');
console.log('Invoice #', fieldVal(fields, 'commercial.invoiceNumber'));
console.log('BL #', fieldVal(fields, 'shipment.billOfLadingNumber'));
console.log('Container', fieldVal(fields, 'shipment.containerNumbers'));
console.log('Invoice qty line 0', fieldVal(fields, 'cargo.line.0.quantity'));
console.log('PL gross weight', fieldVal(fields, 'cargo.grossWeightKg'));
console.log('Discrepancies', draft.discrepancies?.length ?? 0);
console.log('Missing required', draft.missingFields?.filter((m) => m.required).map((m) => m.key));

const invOk = fieldVal(fields, 'commercial.invoiceNumber') === 'INV-REAL-VERIFY-90271';
const blOk = fieldVal(fields, 'shipment.billOfLadingNumber') === 'BL-REAL-VERIFY-55319';
const containerOk = fieldVal(fields, 'shipment.containerNumbers')?.includes('TLLU9876543');
const plOk = fieldVal(fields, 'cargo.grossWeightKg') === '9850.500';

report.invoiceExtraction = invOk ? 'PASS' : 'FAIL';
report.blExtraction = blOk && containerOk ? 'PASS' : 'FAIL';
report.packingListExtraction = plOk ? 'PASS' : 'FAIL';
report.realDocumentExtraction = invOk && blOk && plOk ? 'PASS' : 'FAIL';

const qtyDisc = (draft.discrepancies ?? []).length > 0;
report.discrepancyDetection = qtyDisc ? 'PASS' : 'FAIL';

const requiredMissing = (draft.missingFields ?? []).filter((m) => m.required);
report.minimumManualFieldsAchieved = requiredMissing.length <= 1 && requiredMissing.every((m) => m.key === 'customs.entryExitPort') ? 'YES' : 'NO';

const hsOk = (draft.hsSuggestions ?? []).some((l) => (l.suggestions?.length ?? 0) > 0);
report.hsSuggestions = hsOk ? 'PASS' : 'FAIL';

await req('PATCH', `/admin/customs/requests/${requestId}/declaration-draft`, { token: admin, body: { customsEntryExitPort: 'Sohar Port' } });
await req('POST', `/admin/customs/requests/${requestId}/build-draft`, { token: admin });
const refreshed = await req('GET', `/admin/customs/requests/${requestId}/declaration-draft`, { token: admin });
for (const line of refreshed.json?.cargoLines ?? []) {
  const hs = line.hsSuggestions?.[0]?.hsCode ?? line.hsSuggestions?.[0]?.hsCode;
  if (hs) await req('PATCH', `/admin/customs/cargo-lines/${line.id}/approve-hs`, { token: admin, body: { hsCode: hs } });
}

const bayan = await req('GET', `/admin/customs/requests/${requestId}/bayan-view`, { token: admin });
report.bayanCopyPaste = bayan.status === 200 && bayan.json?.sections?.length > 0 ? 'PASS' : 'FAIL';

report.rbac = rbacChecks.every((c) => c.ok) ? 'PASS' : 'FAIL';

console.log('\n=== REPORT ===');
console.log(JSON.stringify(report, null, 2));
console.log('RBAC', rbacChecks);
