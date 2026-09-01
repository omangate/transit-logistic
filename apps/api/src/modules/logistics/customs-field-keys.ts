export const DECLARATION_FIELD_GROUPS = {
  shipment: 'shipment',
  parties: 'parties',
  commercial: 'commercial',
  cargo: 'cargo',
  vehicle: 'vehicle',
  document: 'document',
} as const;

export type ExtractedFieldInput = {
  fieldKey: string;
  fieldGroup: string;
  displayValue: string;
  normalizedValue?: string;
  confidence?: number;
  sourcePage?: number;
  cargoLineIndex?: number;
  extractionMethod?: string;
  evidenceSnippet?: string;
  reviewStatus?: 'CONFIRMED_FROM_DOCUMENT' | 'NEEDS_REVIEW' | 'MISSING' | 'MANUALLY_OVERRIDDEN' | 'EXTRACTION_FAILED';
};

export const STAFF_REQUIRED_FIELD_KEYS = ['customs.entryExitPort', 'parties.consignee'] as const;

export const MERGEABLE_FIELD_KEYS = [
  'shipment.billOfLadingNumber',
  'shipment.airWaybillNumber',
  'shipment.bookingNumber',
  'shipment.containerNumbers',
  'shipment.sealNumbers',
  'shipment.vessel',
  'shipment.voyage',
  'shipment.carrier',
  'shipment.portOfLoading',
  'shipment.portOfDischarge',
  'shipment.shipmentReference',
  'parties.exporter',
  'parties.importer',
  'parties.consignee',
  'parties.notifyParty',
  'parties.buyer',
  'parties.seller',
  'commercial.invoiceNumber',
  'commercial.invoiceDate',
  'commercial.invoiceTotal',
  'commercial.currency',
  'commercial.incoterm',
  'commercial.freightAmount',
  'commercial.insuranceAmount',
  'commercial.countryOfExport',
  'commercial.countryOfOrigin',
] as const;
