import type { LogisticsDocumentCategory } from '@prisma/client';

import { DECLARATION_FIELD_GROUPS, type ExtractedFieldInput } from './customs-field-keys';

export type PageText = { page: number; text: string };

export type ParsedField = ExtractedFieldInput & {
  extractionMethod: string;
  evidenceSnippet?: string;
  reviewStatus?: 'CONFIRMED_FROM_DOCUMENT' | 'NEEDS_REVIEW' | 'EXTRACTION_FAILED' | 'MISSING';
};

const CONTAINER_RE = /\b([A-Z]{4}\d{7})\b/g;
const CURRENCY_RE = /\b(USD|EUR|OMR|AED|SAR|CNY|GBP)\b/i;

function firstMatch(text: string, patterns: RegExp[]): { value: string; snippet: string } | null {
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    const m = re.exec(text);
    if (m?.[1]?.trim()) {
      const start = Math.max(0, (m.index ?? 0) - 20);
      const end = Math.min(text.length, (m.index ?? 0) + m[0].length + 40);
      return { value: m[1].trim(), snippet: text.slice(start, end).replace(/\s+/g, ' ').trim() };
    }
  }
  return null;
}

function allMatches(text: string, pattern: RegExp): string[] {
  const results: string[] = [];
  const re = new RegExp(pattern.source, pattern.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1] && !results.includes(m[1])) results.push(m[1]);
  }
  return results;
}

function normalizeNumber(raw: string): string {
  return raw.replace(/,/g, '').trim();
}

function field(
  fieldKey: string,
  fieldGroup: string,
  value: string,
  page: number,
  method: string,
  snippet?: string,
  confidence = 0.88,
  cargoLineIndex?: number,
): ParsedField {
  const inText = snippet ? true : false;
  return {
    fieldKey,
    fieldGroup,
    displayValue: value,
    normalizedValue: value,
    confidence: inText ? confidence : 0.5,
    sourcePage: page,
    extractionMethod: method,
    evidenceSnippet: snippet,
    reviewStatus: inText && confidence >= 0.9 ? 'CONFIRMED_FROM_DOCUMENT' : 'NEEDS_REVIEW',
    cargoLineIndex,
  };
}

function parseCargoLines(text: string, page: number, method: string): ParsedField[] {
  const fields: ParsedField[] = [];
  const blocks = text.split(/\n+/);
  let index = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] ?? '';
    const lineMatch = block.match(/^\d{1,3}[\.\)]\s*(.+)/);
    const desc = lineMatch?.[1]?.trim() ?? (block.length > 8 && !/^(quantity|unit|total|gross|net|package|invoice|bill|seller|buyer)/i.test(block) ? block.trim() : '');
    if (!lineMatch && !/^\d{1,3}[\.\)]/.test(block)) continue;
    if (!desc || desc.length < 4) continue;

    fields.push(field(`cargo.line.${index}.description`, DECLARATION_FIELD_GROUPS.cargo, desc, page, method, block.slice(0, 80), 0.86, index));

    const windowText = [blocks[i], blocks[i + 1], blocks[i + 2], blocks[i + 3]].join('\n');
    const qty = firstMatch(windowText, [/quantity[:\s]+([\d,.]+)/i, /\bqty[:\s]+([\d,.]+)/i]);
    const uom = firstMatch(windowText, [/unit[:\s]+([A-Za-z]{2,10})/i]);
    const unitPrice = firstMatch(windowText, [/unit\s*price[:\s]+([\d,.]+)/i]);
    const total = firstMatch(windowText, [/total[:\s]+([\d,.]+)/i]);
    const gross = firstMatch(windowText, [/gross[\s_-]*weight[:\s]+([\d,.]+)/i]);

    if (qty) fields.push(field(`cargo.line.${index}.quantity`, DECLARATION_FIELD_GROUPS.cargo, normalizeNumber(qty.value), page, method, qty.snippet, 0.9, index));
    if (uom) fields.push(field(`cargo.line.${index}.unitOfMeasure`, DECLARATION_FIELD_GROUPS.cargo, uom.value.toUpperCase(), page, method, uom.snippet, 0.85, index));
    if (unitPrice) fields.push(field(`cargo.line.${index}.unitPrice`, DECLARATION_FIELD_GROUPS.cargo, normalizeNumber(unitPrice.value), page, method, unitPrice.snippet, 0.84, index));
    if (total) fields.push(field(`cargo.line.${index}.totalValue`, DECLARATION_FIELD_GROUPS.cargo, normalizeNumber(total.value), page, method, total.snippet, 0.84, index));
    if (gross) fields.push(field(`cargo.line.${index}.grossWeightKg`, DECLARATION_FIELD_GROUPS.cargo, normalizeNumber(gross.value), page, method, gross.snippet, 0.87, index));
    index += 1;
    if (index >= 20) break;
  }
  return fields;
}

export function parseDocumentFields(category: LogisticsDocumentCategory, pages: PageText[]): ParsedField[] {
  const fullText = pages.map((p) => p.text).join('\n');
  const page = pages[0]?.page ?? 1;
  const method = 'pdf_text_heuristic';
  const fields: ParsedField[] = [];

  if (!fullText.trim()) {
    return [
      {
        fieldKey: 'extraction.status',
        fieldGroup: DECLARATION_FIELD_GROUPS.document,
        displayValue: 'EXTRACTION_FAILED',
        reviewStatus: 'EXTRACTION_FAILED',
        confidence: 0,
        sourcePage: page,
        extractionMethod: 'none',
      },
    ];
  }

  const parties = {
    seller: firstMatch(fullText, [/seller[:\s]+(.{3,120})/i, /exporter[:\s]+(.{3,120})/i]),
    buyer: firstMatch(fullText, [/buyer[:\s]+(.{3,120})/i, /importer[:\s]+(.{3,120})/i]),
    consignee: firstMatch(fullText, [/consignee[:\s]+(.{3,120})/i, /recipient[:\s]+(.{3,120})/i]),
    notify: firstMatch(fullText, [/notify\s*party[:\s]+(.{3,120})/i]),
  };

  if (parties.seller) fields.push(field('parties.seller', DECLARATION_FIELD_GROUPS.parties, parties.seller.value, page, method, parties.seller.snippet, 0.88));
  if (parties.buyer) fields.push(field('parties.buyer', DECLARATION_FIELD_GROUPS.parties, parties.buyer.value, page, method, parties.buyer.snippet, 0.88));
  if (parties.consignee) fields.push(field('parties.consignee', DECLARATION_FIELD_GROUPS.parties, parties.consignee.value, page, method, parties.consignee.snippet, 0.9));
  if (parties.notify) fields.push(field('parties.notifyParty', DECLARATION_FIELD_GROUPS.parties, parties.notify.value, page, method, parties.notify.snippet, 0.85));

  const invoiceNum = firstMatch(fullText, [
    /invoice\s+number\s*:\s*([A-Z0-9-]{6,40})/i,
    /\b(INV-[A-Z0-9-]{4,40})\b/i,
  ]);
  const invoiceDate = firstMatch(fullText, [/invoice\s*date[:\s]+([\d]{4}[-\/\.][\d]{1,2}[-\/\.][\d]{1,2})/i, /date[:\s]+([\d]{4}[-\/\.][\d]{1,2}[-\/\.][\d]{1,2})/i]);
  const total = firstMatch(fullText, [/total(?:\s*amount)?[:\s]+([\d,.]+)/i, /invoice\s*total[:\s]+([\d,.]+)/i]);
  const currency = fullText.match(CURRENCY_RE)?.[1]?.toUpperCase();
  const incoterm = firstMatch(fullText, [/\b(FOB|CIF|CFR|EXW|DDP|DAP|FCA)\b/i]);
  const origin = firstMatch(fullText, [/country\s*of\s*origin[:\s]+([A-Za-z ]{2,40})/i, /origin[:\s]+([A-Z]{2,3})/i]);
  const exportCountry = firstMatch(fullText, [/country\s*of\s*export[:\s]+([A-Za-z ]{2,40})/i]);

  if (invoiceNum) fields.push(field('commercial.invoiceNumber', DECLARATION_FIELD_GROUPS.commercial, invoiceNum.value, page, method, invoiceNum.snippet, 0.94));
  if (invoiceDate) fields.push(field('commercial.invoiceDate', DECLARATION_FIELD_GROUPS.commercial, invoiceDate.value, page, method, invoiceDate.snippet, 0.9));
  if (total) fields.push(field('commercial.invoiceTotal', DECLARATION_FIELD_GROUPS.commercial, normalizeNumber(total.value), page, method, total.snippet, 0.88));
  if (currency) fields.push(field('commercial.currency', DECLARATION_FIELD_GROUPS.commercial, currency, page, method, currency, 0.92));
  if (incoterm) fields.push(field('commercial.incoterm', DECLARATION_FIELD_GROUPS.commercial, incoterm.value.toUpperCase(), page, method, incoterm.snippet, 0.87));
  if (origin) fields.push(field('commercial.countryOfOrigin', DECLARATION_FIELD_GROUPS.commercial, origin.value.slice(0, 40), page, method, origin.snippet, 0.86));
  if (exportCountry) fields.push(field('commercial.countryOfExport', DECLARATION_FIELD_GROUPS.commercial, exportCountry.value.slice(0, 40), page, method, exportCountry.snippet, 0.86));

  const bl = firstMatch(fullText, [
    /bill\s+of\s+lading\s+number\s*:\s*([A-Z0-9-]{6,40})/i,
    /\b(BL-[A-Z0-9-]{4,40})\b/i,
  ]);
  const awb = firstMatch(fullText, [/air\s*waybill[:\s#]+([A-Z0-9-]{4,40})/i, /\bAWB[:\s#]+([A-Z0-9-]{4,40})/i]);
  const booking = firstMatch(fullText, [/booking[:\s#]+([A-Z0-9-]{4,40})/i]);
  const vessel = firstMatch(fullText, [/vessel[:\s]+(.{3,80})/i, /ship[:\s]+(.{3,80})/i]);
  const voyage = firstMatch(fullText, [/voyage[:\s#]+([A-Z0-9-]{2,20})/i]);
  const carrier = firstMatch(fullText, [/carrier[:\s]+(.{2,60})/i, /shipping\s*line[:\s]+(.{2,60})/i]);
  const pol = firstMatch(fullText, [/port\s*of\s*loading[:\s]+(.{2,40})/i, /\bPOL[:\s]+(.{2,40})/i]);
  const pod = firstMatch(fullText, [/port\s*of\s*discharge[:\s]+(.{2,40})/i, /\bPOD[:\s]+(.{2,40})/i]);
  const containers = allMatches(fullText, CONTAINER_RE);
  const seals = allMatches(fullText, /seal[:\s#]+([A-Z0-9-]{3,20})/gi);

  if (bl) fields.push(field('shipment.billOfLadingNumber', DECLARATION_FIELD_GROUPS.shipment, bl.value, page, method, bl.snippet, 0.94));
  if (awb) fields.push(field('shipment.airWaybillNumber', DECLARATION_FIELD_GROUPS.shipment, awb.value, page, method, awb.snippet, 0.93));
  if (booking) fields.push(field('shipment.bookingNumber', DECLARATION_FIELD_GROUPS.shipment, booking.value, page, method, booking.snippet, 0.88));
  if (vessel) fields.push(field('shipment.vessel', DECLARATION_FIELD_GROUPS.shipment, vessel.value, page, method, vessel.snippet, 0.9));
  if (voyage) fields.push(field('shipment.voyage', DECLARATION_FIELD_GROUPS.shipment, voyage.value, page, method, voyage.snippet, 0.9));
  if (carrier) fields.push(field('shipment.carrier', DECLARATION_FIELD_GROUPS.shipment, carrier.value, page, method, carrier.snippet, 0.88));
  if (pol) fields.push(field('shipment.portOfLoading', DECLARATION_FIELD_GROUPS.shipment, pol.value, page, method, pol.snippet, 0.9));
  if (pod) fields.push(field('shipment.portOfDischarge', DECLARATION_FIELD_GROUPS.shipment, pod.value, page, method, pod.snippet, 0.9));
  if (containers.length) fields.push(field('shipment.containerNumbers', DECLARATION_FIELD_GROUPS.shipment, containers.join(', '), page, method, containers.join(', '), 0.92));
  if (seals.length) fields.push(field('shipment.sealNumbers', DECLARATION_FIELD_GROUPS.shipment, seals.join(', '), page, method, seals.join(', '), 0.88));

  const pkgCount = firstMatch(fullText, [/package\s*count[:\s]+([\d,.]+)/i, /total\s*packages[:\s]+([\d,.]+)/i, /no\.?\s*of\s*packages[:\s]+([\d,.]+)/i]);
  const pkgType = firstMatch(fullText, [/package\s*type[:\s]+([A-Za-z ]{2,30})/i]);
  const gross = firstMatch(fullText, [/gross[\s_-]*weight[:\s]+([\d,.]+)\s*(?:kg|kgs)?/i]);
  const net = firstMatch(fullText, [/net[\s_-]*weight[:\s]+([\d,.]+)\s*(?:kg|kgs)?/i]);
  const volume = firstMatch(fullText, [/volume[:\s]+([\d,.]+)\s*(?:cbm|m3)?/i]);

  if (pkgCount) fields.push(field('cargo.packageCount', DECLARATION_FIELD_GROUPS.cargo, normalizeNumber(pkgCount.value), page, method, pkgCount.snippet, 0.9));
  if (pkgType) fields.push(field('cargo.packageType', DECLARATION_FIELD_GROUPS.cargo, pkgType.value.trim(), page, method, pkgType.snippet, 0.88));
  if (gross) fields.push(field('cargo.grossWeightKg', DECLARATION_FIELD_GROUPS.cargo, normalizeNumber(gross.value), page, method, gross.snippet, 0.9));
  if (net) fields.push(field('cargo.netWeightKg', DECLARATION_FIELD_GROUPS.cargo, normalizeNumber(net.value), page, method, net.snippet, 0.88));
  if (volume) fields.push(field('cargo.volumeCbm', DECLARATION_FIELD_GROUPS.cargo, normalizeNumber(volume.value), page, method, volume.snippet, 0.86));

  const vin = firstMatch(fullText, [/\b(VIN|chassis)[:\s#]+([A-HJ-NPR-Z0-9]{11,17})/i, /\b([A-HJ-NPR-Z0-9]{17})\b/]);
  const make = firstMatch(fullText, [/make[:\s]+(.{2,40})/i]);
  const model = firstMatch(fullText, [/model[:\s]+(.{2,40})/i]);
  const year = firstMatch(fullText, [/year[:\s]+(20\d{2})/i]);
  if (vin) fields.push(field('vehicle.vin', DECLARATION_FIELD_GROUPS.vehicle, vin.value.replace(/^.*?:\s*/, ''), page, method, vin.snippet, 0.95));
  if (make) fields.push(field('vehicle.make', DECLARATION_FIELD_GROUPS.vehicle, make.value, page, method, make.snippet, 0.9));
  if (model) fields.push(field('vehicle.model', DECLARATION_FIELD_GROUPS.vehicle, model.value, page, method, model.snippet, 0.9));
  if (year) fields.push(field('vehicle.year', DECLARATION_FIELD_GROUPS.vehicle, year.value, page, method, year.snippet, 0.9));

  if (['commercial_invoice', 'packing_list', 'certificate_of_origin'].includes(category)) {
    fields.push(...parseCargoLines(fullText, page, method));
  }

  if (fields.length === 0) {
    return [
      {
        fieldKey: 'extraction.status',
        fieldGroup: DECLARATION_FIELD_GROUPS.document,
        displayValue: 'EXTRACTION_FAILED',
        reviewStatus: 'EXTRACTION_FAILED',
        confidence: 0,
        sourcePage: page,
        extractionMethod: method,
        evidenceSnippet: fullText.slice(0, 200),
      },
    ];
  }

  return fields;
}

export function mergeAiFields(heuristic: ParsedField[], aiFields: ParsedField[]): ParsedField[] {
  const map = new Map<string, ParsedField>();
  for (const f of heuristic) map.set(f.fieldKey + (f.cargoLineIndex ?? ''), f);
  for (const f of aiFields) {
    const key = f.fieldKey + (f.cargoLineIndex ?? '');
    const existing = map.get(key);
    if (!existing || (f.confidence ?? 0) > (existing.confidence ?? 0)) map.set(key, { ...f, extractionMethod: f.extractionMethod ?? 'openai_structured' });
  }
  return [...map.values()];
}
