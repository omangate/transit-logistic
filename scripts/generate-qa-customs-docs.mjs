/**
 * Generate realistic QA customs PDFs with unique verifiable values.
 * Usage: node scripts/generate-qa-customs-docs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'fixtures', 'customs-docs');
fs.mkdirSync(OUT, { recursive: true });

function textPdf(lines) {
  const contentLines = lines.map((line, i) => {
    const y = 750 - i * 14;
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    return `BT /F1 10 Tf 40 ${y} Td (${escaped}) Tj ET`;
  });
  const stream = contentLines.join('\n');
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n',
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream endobj\n`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return pdf;
}

const invoice = textPdf([
  'COMMERCIAL INVOICE',
  'Invoice Number: INV-REAL-VERIFY-90271',
  'Invoice Date: 2026-08-15',
  'Currency: USD',
  'Invoice Total: 45200.00',
  'Incoterm: CIF',
  'Country of Origin: CN',
  'Seller: Shenzhen Apex Export Co.',
  'Buyer: Oman Gate Trading LLC',
  'Consignee: Oman Gate Trading LLC',
  '1. Electronic components and accessories',
  'Quantity: 1200',
  'Unit: PCS',
  'Unit Price: 32.50',
  'Total: 39000.00',
  '2. Industrial spare parts',
  'Quantity: 85',
  'Unit: PCS',
  'Unit Price: 72.94',
  'Total: 6200.00',
]);

const packing = textPdf([
  'PACKING LIST',
  'Document Number: PL-REAL-VERIFY-44102',
  'Package Count: 52',
  'Package Type: Cartons',
  'Gross Weight: 9850.500 kg',
  'Net Weight: 9420.000 kg',
  'Volume: 32.400 cbm',
  '1. Electronic components and accessories',
  'Quantity: 1000',
  'Gross Weight: 6200 kg',
  '2. Industrial spare parts',
  'Quantity: 85',
  'Gross Weight: 3650 kg',
]);

const bl = textPdf([
  'BILL OF LADING',
  'Bill of Lading Number: BL-REAL-VERIFY-55319',
  'Booking Number: BK-REAL-77881',
  'Vessel: TEST STAR',
  'Voyage: 99E',
  'Carrier: Transit Ocean Line',
  'Port of Loading: CNSHA',
  'Port of Discharge: OMSLL',
  'Container: TLLU9876543',
  'Seal: SL-REAL-9911',
  'Consignee: Oman Gate Trading LLC',
  'Notify Party: Transit Logistic Customs Broker',
]);

fs.writeFileSync(path.join(OUT, 'commercial-invoice-qa.pdf'), invoice);
fs.writeFileSync(path.join(OUT, 'packing-list-qa.pdf'), packing);
fs.writeFileSync(path.join(OUT, 'bill-of-lading-qa.pdf'), bl);
console.log('Wrote QA customs PDFs to', OUT);
