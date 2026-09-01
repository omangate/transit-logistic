import { Injectable } from '@nestjs/common';
import type { User } from '@/types/user';
import type { ExtractionReviewStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { MERGEABLE_FIELD_KEYS } from './customs-field-keys';
import { CustomsDocumentExtractionService } from './customs-document-extraction.service';
import { OmanHsTariffService } from './oman-hs-tariff.service';
import { LogisticsAccessService } from './logistics-access.service';

type CargoLineDraft = {
  description: string;
  quantity?: number;
  unitOfMeasure?: string;
  unitPrice?: number;
  cargoValue?: number;
  packageCount?: number;
  packageType?: string;
  grossWeightKg?: number;
  netWeightKg?: number;
  volumeCbm?: number;
  currency?: string;
  vin?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
};

@Injectable()
export class CustomsDeclarationPrepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LogisticsAccessService,
    private readonly extraction: CustomsDocumentExtractionService,
    private readonly hsTariff: OmanHsTariffService,
  ) {}

  async getDraft(user: User, customsRequestId: string) {
    await this.access.assertCustomsAccess(user, customsRequestId);
    const request = await this.loadRequest(customsRequestId);
    const merged = this.mergeFields(request.extractedFields);
    const missingFields = this.computeMissingFields(request, merged);
    return {
      request: this.serializeRequest(request),
      fields: request.extractedFields,
      merged,
      discrepancies: request.fieldDiscrepancies.filter((d) => !d.resolved),
      missingFields,
      cargoLines: request.cargoLines,
      documents: request.documents,
      hsSuggestions: (await this.hsTariff.suggestionsForRequest(customsRequestId)).lines,
      hsDataset: await this.hsTariff.stats(),
    };
  }

  async uploadAndExtract(
    user: User,
    customsRequestId: string,
    files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname?: string; category: string }>,
    uploadFn: (file: { buffer: Buffer; mimetype: string; size: number; originalname?: string }, category: string) => Promise<{ id: string }>,
  ) {
    await this.access.assertCustomsAccess(user, customsRequestId);
    await this.prisma.customsClearanceRequest.update({
      where: { id: customsRequestId },
      data: { declarationPrepStatus: 'documents_uploaded' },
    });

    for (const file of files) {
      const doc = await uploadFn(file, file.category);
      await this.extraction.extractDocument(doc.id, customsRequestId);
    }

    return this.buildDraft(user, customsRequestId);
  }

  async extractAll(user: User, customsRequestId: string) {
    await this.access.assertCustomsAccess(user, customsRequestId);
    await this.prisma.customsClearanceRequest.update({
      where: { id: customsRequestId },
      data: { declarationPrepStatus: 'extracting' },
    });
    await this.extraction.extractAllForRequest(customsRequestId);
    return this.buildDraft(user, customsRequestId);
  }

  async buildDraft(user: User, customsRequestId: string) {
    await this.access.assertCustomsAccess(user, customsRequestId);
    await this.detectDiscrepancies(customsRequestId);
    await this.applyMergedToRequest(customsRequestId);
    await this.autoConfirmConsignee(customsRequestId);
    await this.syncCargoLines(customsRequestId);
    await this.hsTariff.suggestForAllLines(customsRequestId);

    await this.prisma.customsClearanceRequest.update({
      where: { id: customsRequestId },
      data: {
        declarationPrepStatus: 'draft_ready',
        declarationDraftBuiltAt: new Date(),
      },
    });

    return this.getDraft(user, customsRequestId);
  }

  async updateManualFields(
    user: User,
    customsRequestId: string,
    input: { customsEntryExitPort?: string; consigneeName?: string; consigneeConfirmed?: boolean; transactionType?: string },
  ) {
    await this.access.assertCustomsAccess(user, customsRequestId);
    const data: Prisma.CustomsClearanceRequestUpdateInput = {};
    if (input.customsEntryExitPort != null) {
      data.customsEntryExitPort = input.customsEntryExitPort;
      await this.upsertManualField(customsRequestId, 'customs.entryExitPort', input.customsEntryExitPort, user.id);
    }
    if (input.consigneeName != null) {
      data.consigneeName = input.consigneeName;
      data.consigneeConfirmed = input.consigneeConfirmed ?? true;
      await this.upsertManualField(customsRequestId, 'parties.consignee', input.consigneeName, user.id);
    }
    if (input.transactionType) {
      data.transactionType = input.transactionType as never;
    }
    await this.prisma.customsClearanceRequest.update({ where: { id: customsRequestId }, data });
    return this.getDraft(user, customsRequestId);
  }

  async updateFieldReview(
    user: User,
    fieldId: string,
    input: { reviewStatus: ExtractionReviewStatus; displayValue?: string },
  ) {
    const field = await this.prisma.declarationExtractedField.findUniqueOrThrow({ where: { id: fieldId } });
    await this.access.assertCustomsAccess(user, field.customsRequestId);
    return this.prisma.declarationExtractedField.update({
      where: { id: fieldId },
      data: {
        reviewStatus: input.reviewStatus,
        displayValue: input.displayValue ?? field.displayValue,
        normalizedValue: input.displayValue ?? field.normalizedValue,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      include: { sourceDocument: { select: { id: true, category: true, originalName: true } } },
    });
  }

  async approveHsCode(user: User, cargoLineId: string, hsCode: string) {
    const line = await this.prisma.customsCargoLine.findUniqueOrThrow({ where: { id: cargoLineId } });
    await this.access.assertCustomsAccess(user, line.customsRequestId);
    return this.prisma.customsCargoLine.update({
      where: { id: cargoLineId },
      data: { approvedHsCode: hsCode, hsCode },
    });
  }

  async validateDraft(user: User, customsRequestId: string) {
    const draft = await this.getDraft(user, customsRequestId);
    const blockers = draft.missingFields.filter((f) => f.required);
    if (blockers.length > 0) {
      return { valid: false, blockers, draft };
    }
    const unapprovedHs = draft.cargoLines.filter((l) => !l.approvedHsCode);
    if (unapprovedHs.length > 0) {
      await this.prisma.customsClearanceRequest.update({
        where: { id: customsRequestId },
        data: { declarationPrepStatus: 'hs_review' },
      });
      return { valid: false, blockers: [{ key: 'hs.approval', label: 'HS code approval required', required: true }], draft };
    }
    await this.prisma.customsClearanceRequest.update({
      where: { id: customsRequestId },
      data: { declarationPrepStatus: 'validated' },
    });
    return { valid: true, blockers: [], draft };
  }

  async markBayanReady(user: User, customsRequestId: string) {
    const validation = await this.validateDraft(user, customsRequestId);
    if (!validation.valid) return validation;
    await this.prisma.customsClearanceRequest.update({
      where: { id: customsRequestId },
      data: { declarationPrepStatus: 'bayan_ready', bayanReadyAt: new Date(), status: 'declaration_prepared' },
    });
    return { valid: true, bayanView: await this.getBayanView(user, customsRequestId) };
  }

  async recordBayanSubmission(
    user: User,
    customsRequestId: string,
    input: {
      bayanDeclarationNumber: string;
      bayanDeclarationDate?: string;
      customsDutyAmount?: number;
      customsPaymentStatus?: string;
      customsReleaseStatus?: string;
      bayanNotes?: string;
    },
  ) {
    await this.access.assertCustomsAccess(user, customsRequestId);
    return this.prisma.customsClearanceRequest.update({
      where: { id: customsRequestId },
      data: {
        bayanDeclarationNumber: input.bayanDeclarationNumber,
        declarationNumber: input.bayanDeclarationNumber,
        bayanDeclarationDate: input.bayanDeclarationDate ? new Date(input.bayanDeclarationDate) : new Date(),
        customsDutyAmount: input.customsDutyAmount,
        customsPaymentStatus: input.customsPaymentStatus,
        customsReleaseStatus: input.customsReleaseStatus,
        bayanNotes: input.bayanNotes,
      },
    });
  }

  async getPreparationSheetPdf(user: User, customsRequestId: string) {
    const bayan = await this.getBayanView(user, customsRequestId);
    const lines: string[] = ['Transit Logistic — Customs Preparation Sheet', `Generated: ${new Date().toISOString()}`, '---'];
    for (const section of bayan.sections) {
      lines.push(section.title.toUpperCase());
      for (const f of section.fields ?? []) {
        if (f.value) lines.push(`${f.label}: ${f.value}`);
      }
      for (const line of section.lines ?? []) {
        lines.push(`Line ${line.lineNumber}`);
        for (const f of line.fields) {
          if (f.value) lines.push(`  ${f.label}: ${f.value}`);
        }
      }
      lines.push('---');
    }
    if (bayan.summaryText) lines.push(bayan.summaryText);
    return { buffer: this.buildSimplePdf(lines), filename: `customs-prep-${customsRequestId.slice(0, 8)}.pdf` };
  }

  private buildSimplePdf(lines: string[]): Buffer {
    const escaped = lines.map((l) => l.replace(/[\\()]/g, '\\$&')).join('\\n');
    const content = `BT /F1 9 Tf 40 780 Td (${escaped}) Tj ET`;
    const pdf = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length ${content.length} >>stream
${content}
endstream endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
trailer<< /Size 6 /Root 1 0 R >>
startxref
400
%%EOF`;
    return Buffer.from(pdf);
  }

  async getBayanView(user: User, customsRequestId: string) {
    const draft = await this.getDraft(user, customsRequestId);
    const m = draft.merged;
    const fieldMeta = this.fieldMetaMap(draft.fields);
    const containers = (m['shipment.containerNumbers'] ?? '').split(/[,;\s]+/).map((c) => c.trim()).filter(Boolean);
    const seals = (m['shipment.sealNumbers'] ?? '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);

    const sections = [
      {
        id: 'header',
        title: 'Declaration Header',
        fields: [
          { label: 'Transaction Type', value: draft.request.transactionType, copyKey: 'transactionType', reviewStatus: 'CONFIRMED_FROM_DOCUMENT' },
          { label: 'Entry/Exit Port', value: draft.request.customsEntryExitPort ?? m['customs.entryExitPort'] ?? '', copyKey: 'entryExitPort', reviewStatus: fieldMeta['customs.entryExitPort']?.reviewStatus ?? 'MANUALLY_OVERRIDDEN' },
          { label: 'BL Number', value: m['shipment.billOfLadingNumber'] ?? draft.request.billOfLadingNumber ?? '', copyKey: 'blNumber', reviewStatus: fieldMeta['shipment.billOfLadingNumber']?.reviewStatus },
          { label: 'AWB', value: m['shipment.airWaybillNumber'] ?? '', copyKey: 'awb', reviewStatus: fieldMeta['shipment.airWaybillNumber']?.reviewStatus },
          { label: 'Vessel', value: m['shipment.vessel'] ?? draft.request.vesselName ?? '', copyKey: 'vessel', reviewStatus: fieldMeta['shipment.vessel']?.reviewStatus },
          { label: 'Voyage', value: m['shipment.voyage'] ?? draft.request.voyageNumber ?? '', copyKey: 'voyage', reviewStatus: fieldMeta['shipment.voyage']?.reviewStatus },
        ],
      },
      {
        id: 'parties',
        title: 'Parties',
        fields: [
          { label: 'Consignee', value: draft.request.consigneeName ?? m['parties.consignee'] ?? '', copyKey: 'consignee', reviewStatus: fieldMeta['parties.consignee']?.reviewStatus },
          { label: 'Exporter / Seller', value: m['parties.exporter'] ?? m['parties.seller'] ?? '', copyKey: 'exporter', reviewStatus: fieldMeta['parties.seller']?.reviewStatus },
          { label: 'Importer / Buyer', value: m['parties.importer'] ?? m['parties.buyer'] ?? '', copyKey: 'importer', reviewStatus: fieldMeta['parties.buyer']?.reviewStatus },
          { label: 'Notify Party', value: m['parties.notifyParty'] ?? '', copyKey: 'notifyParty', reviewStatus: fieldMeta['parties.notifyParty']?.reviewStatus },
        ],
      },
      {
        id: 'commercial',
        title: 'Commercial',
        fields: [
          { label: 'Invoice Number', value: m['commercial.invoiceNumber'] ?? '', copyKey: 'invoiceNumber', reviewStatus: fieldMeta['commercial.invoiceNumber']?.reviewStatus },
          { label: 'Invoice Date', value: m['commercial.invoiceDate'] ?? '', copyKey: 'invoiceDate', reviewStatus: fieldMeta['commercial.invoiceDate']?.reviewStatus },
          { label: 'Invoice Total', value: m['commercial.invoiceTotal'] ?? '', copyKey: 'invoiceTotal', reviewStatus: fieldMeta['commercial.invoiceTotal']?.reviewStatus },
          { label: 'Currency', value: m['commercial.currency'] ?? 'OMR', copyKey: 'currency', reviewStatus: fieldMeta['commercial.currency']?.reviewStatus },
          { label: 'Incoterm', value: m['commercial.incoterm'] ?? '', copyKey: 'incoterm', reviewStatus: fieldMeta['commercial.incoterm']?.reviewStatus },
          { label: 'Country of Origin', value: m['commercial.countryOfOrigin'] ?? draft.request.countryOfOrigin ?? '', copyKey: 'countryOfOrigin', reviewStatus: fieldMeta['commercial.countryOfOrigin']?.reviewStatus },
          { label: 'Package Count', value: m['cargo.packageCount'] ?? '', copyKey: 'packageCount', reviewStatus: fieldMeta['cargo.packageCount']?.reviewStatus },
          { label: 'Package Type', value: m['cargo.packageType'] ?? '', copyKey: 'packageType', reviewStatus: fieldMeta['cargo.packageType']?.reviewStatus },
          { label: 'Gross Weight (kg)', value: m['cargo.grossWeightKg'] ?? '', copyKey: 'grossWeight', reviewStatus: fieldMeta['cargo.grossWeightKg']?.reviewStatus },
          { label: 'Net Weight (kg)', value: m['cargo.netWeightKg'] ?? '', copyKey: 'netWeight', reviewStatus: fieldMeta['cargo.netWeightKg']?.reviewStatus },
        ],
      },
      {
        id: 'shipment',
        title: 'Shipment',
        fields: [
          { label: 'Port of Loading', value: m['shipment.portOfLoading'] ?? draft.request.portOfLoading ?? '', copyKey: 'portOfLoading', reviewStatus: fieldMeta['shipment.portOfLoading']?.reviewStatus },
          { label: 'Port of Discharge', value: m['shipment.portOfDischarge'] ?? draft.request.portOfDischarge ?? '', copyKey: 'portOfDischarge', reviewStatus: fieldMeta['shipment.portOfDischarge']?.reviewStatus },
          { label: 'Carrier', value: m['shipment.carrier'] ?? draft.request.shippingLine ?? '', copyKey: 'carrier', reviewStatus: fieldMeta['shipment.carrier']?.reviewStatus },
        ],
        containers: containers.map((value, i) => ({ label: `Container ${i + 1}`, value, copyKey: `container${i + 1}`, reviewStatus: fieldMeta['shipment.containerNumbers']?.reviewStatus })),
        seals: seals.map((value, i) => ({ label: `Seal ${i + 1}`, value, copyKey: `seal${i + 1}`, reviewStatus: fieldMeta['shipment.sealNumbers']?.reviewStatus })),
      },
      {
        id: 'cargoLines',
        title: 'Goods Lines',
        lines: draft.cargoLines.map((line, index) => ({
          lineNumber: index + 1,
          fields: [
            { label: 'Description', value: line.description, copyKey: `line${index + 1}.description`, reviewStatus: 'CONFIRMED_FROM_DOCUMENT' },
            { label: 'HS Code', value: line.approvedHsCode ?? line.hsCode ?? '', copyKey: `line${index + 1}.hsCode`, reviewStatus: line.approvedHsCode ? 'MANUALLY_OVERRIDDEN' : 'NEEDS_REVIEW' },
            { label: 'Quantity', value: line.quantity?.toString() ?? '', copyKey: `line${index + 1}.quantity`, reviewStatus: 'CONFIRMED_FROM_DOCUMENT' },
            { label: 'Unit', value: line.unitOfMeasure ?? '', copyKey: `line${index + 1}.unit`, reviewStatus: 'CONFIRMED_FROM_DOCUMENT' },
            { label: 'Unit Price', value: line.unitPrice?.toString() ?? '', copyKey: `line${index + 1}.unitPrice`, reviewStatus: 'CONFIRMED_FROM_DOCUMENT' },
            { label: 'Value', value: line.cargoValue?.toString() ?? '', copyKey: `line${index + 1}.value`, reviewStatus: 'CONFIRMED_FROM_DOCUMENT' },
            { label: 'Gross Weight (kg)', value: line.grossWeightKg?.toString() ?? '', copyKey: `line${index + 1}.grossWeight`, reviewStatus: 'CONFIRMED_FROM_DOCUMENT' },
            { label: 'Net Weight (kg)', value: line.netWeightKg?.toString() ?? '', copyKey: `line${index + 1}.netWeight`, reviewStatus: 'CONFIRMED_FROM_DOCUMENT' },
            { label: 'Packages', value: line.packageCount?.toString() ?? '', copyKey: `line${index + 1}.packages`, reviewStatus: 'CONFIRMED_FROM_DOCUMENT' },
            { label: 'VIN / Chassis', value: line.vin ?? '', copyKey: `line${index + 1}.vin`, reviewStatus: 'CONFIRMED_FROM_DOCUMENT' },
          ],
        })),
      },
    ];

    const summaryText = sections
      .flatMap((s) => [
        ...(s.fields ?? []).map((f) => (f.value ? `${f.label}: ${f.value}` : null)),
        ...((s as { containers?: Array<{ label: string; value: string }> }).containers ?? []).map((f) => `${f.label}: ${f.value}`),
        ...((s as { seals?: Array<{ label: string; value: string }> }).seals ?? []).map((f) => `${f.label}: ${f.value}`),
        ...(s.lines ?? []).flatMap((l) => l.fields.map((f) => (f.value ? `Line ${l.lineNumber} ${f.label}: ${f.value}` : null))),
      ])
      .filter(Boolean)
      .join('\n');

    return { sections, summaryText };
  }

  private fieldMetaMap(fields: Array<{ fieldKey: string; reviewStatus: string; sourceDocument?: { category: string } | null }>) {
    const map: Record<string, { reviewStatus?: string; sourceCategory?: string }> = {};
    for (const f of fields) {
      map[f.fieldKey] = { reviewStatus: f.reviewStatus, sourceCategory: f.sourceDocument?.category };
    }
    return map;
  }

  async searchConsignees(q: string) {
    return this.prisma.savedConsignee.findMany({
      where: q ? { companyName: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: [{ usageCount: 'desc' }, { companyName: 'asc' }],
      take: 10,
    });
  }

  async saveConsignee(user: User, input: { companyName: string; companyNameAr?: string; crNumber?: string; address?: string; contactPhone?: string; contactEmail?: string }) {
    return this.prisma.savedConsignee.create({
      data: { ...input, createdById: user.id },
    });
  }

  private async loadRequest(customsRequestId: string) {
    return this.prisma.customsClearanceRequest.findUniqueOrThrow({
      where: { id: customsRequestId },
      include: {
        extractedFields: {
          include: { sourceDocument: { select: { id: true, category: true, originalName: true } } },
          orderBy: { fieldKey: 'asc' },
        },
        fieldDiscrepancies: { orderBy: { createdAt: 'desc' } },
        cargoLines: { orderBy: { sortOrder: 'asc' }, include: { hsSuggestions: { orderBy: { sortOrder: 'asc' } } } },
        documents: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  private serializeRequest(request: Awaited<ReturnType<typeof this.loadRequest>>) {
    return {
      id: request.id,
      referenceNumber: request.referenceNumber,
      transactionType: request.transactionType,
      status: request.status,
      declarationPrepStatus: request.declarationPrepStatus,
      customsEntryExitPort: request.customsEntryExitPort,
      consigneeName: request.consigneeName,
      consigneeConfirmed: request.consigneeConfirmed,
      billOfLadingNumber: request.billOfLadingNumber,
      portOfLoading: request.portOfLoading,
      portOfDischarge: request.portOfDischarge,
      vesselName: request.vesselName,
      voyageNumber: request.voyageNumber,
      shippingLine: request.shippingLine,
      countryOfOrigin: request.countryOfOrigin,
      bayanReadyAt: request.bayanReadyAt,
      bayanDeclarationNumber: request.bayanDeclarationNumber,
      bayanDeclarationDate: request.bayanDeclarationDate,
      customsDutyAmount: request.customsDutyAmount,
      customsPaymentStatus: request.customsPaymentStatus,
      customsReleaseStatus: request.customsReleaseStatus,
      bayanNotes: request.bayanNotes,
    };
  }

  private mergeFields(fields: Array<{ fieldKey: string; displayValue: string | null; reviewStatus: string; sourceDocumentId: string | null; sourceDocument?: { category: string; originalName: string | null } | null }>) {
    const merged: Record<string, string> = {};
    const meta: Record<string, { sourceDocumentId?: string | null; sourceCategory?: string; reviewStatus?: string }> = {};
    for (const key of MERGEABLE_FIELD_KEYS) {
      const candidates = fields.filter((f) => f.fieldKey === key && f.displayValue);
      if (candidates.length === 0) continue;
      const preferred = candidates.find((c) => c.reviewStatus === 'CONFIRMED_FROM_DOCUMENT') ?? candidates.find((c) => c.reviewStatus === 'MANUALLY_OVERRIDDEN') ?? candidates[0];
      if (preferred?.displayValue) {
        merged[key] = preferred.displayValue;
        meta[key] = {
          sourceDocumentId: preferred.sourceDocumentId,
          sourceCategory: preferred.sourceDocument?.category,
          reviewStatus: preferred.reviewStatus,
        };
      }
    }
    return merged;
  }

  private computeMissingFields(
    request: Awaited<ReturnType<typeof this.loadRequest>>,
    merged: Record<string, string>,
  ) {
    const missing: Array<{ key: string; label: string; labelAr: string; required: boolean; reason?: string }> = [];
    if (!request.customsEntryExitPort && !merged['customs.entryExitPort']) {
      missing.push({ key: 'customs.entryExitPort', label: 'Customs entry/exit port', labelAr: 'منفذ الدخول/الخروج', required: true });
    }
    const consigneeExtractions = request.extractedFields.filter((f) => f.fieldKey === 'parties.consignee' && f.displayValue);
    const uniqueConsignees = [...new Set(consigneeExtractions.map((f) => f.displayValue!))];
    const consignee = request.consigneeName ?? merged['parties.consignee'] ?? uniqueConsignees[0];

    if (!consignee) {
      missing.push({ key: 'parties.consignee', label: 'Recipient / Consignee', labelAr: 'اسم المستلم', required: true });
    } else if (uniqueConsignees.length > 1) {
      missing.push({ key: 'parties.consignee', label: 'Recipient / Consignee', labelAr: 'اسم المستلم', required: true, reason: 'discrepancy' });
    }
    return missing;
  }

  private async autoConfirmConsignee(customsRequestId: string) {
    const request = await this.loadRequest(customsRequestId);
    const merged = this.mergeFields(request.extractedFields);
    const consigneeExtractions = request.extractedFields.filter((f) => f.fieldKey === 'parties.consignee' && f.displayValue);
    const uniqueConsignees = [...new Set(consigneeExtractions.map((f) => f.displayValue!))];
    if (uniqueConsignees.length === 1 && !request.consigneeConfirmed) {
      await this.prisma.customsClearanceRequest.update({
        where: { id: customsRequestId },
        data: { consigneeName: request.consigneeName ?? uniqueConsignees[0] ?? merged['parties.consignee'], consigneeConfirmed: true },
      });
    }
  }

  private async detectDiscrepancies(customsRequestId: string) {
    const fields = await this.prisma.declarationExtractedField.findMany({ where: { customsRequestId } });
    await this.prisma.fieldDiscrepancy.deleteMany({ where: { customsRequestId, resolved: false } });
    const byKey = new Map<string, typeof fields>();
    for (const f of fields) {
      if (!f.displayValue) continue;
      const list = byKey.get(f.fieldKey) ?? [];
      list.push(f);
      byKey.set(f.fieldKey, list);
    }
    for (const [fieldKey, list] of byKey) {
      const unique = [...new Set(list.map((f) => f.displayValue))];
      if (unique.length <= 1) continue;
      await this.prisma.fieldDiscrepancy.create({
        data: {
          customsRequestId,
          fieldKey,
          values: list.map((f) => ({
            value: f.displayValue,
            sourceDocumentId: f.sourceDocumentId,
            reviewStatus: f.reviewStatus,
          })),
        },
      });
    }
  }

  private async applyMergedToRequest(customsRequestId: string) {
    const request = await this.loadRequest(customsRequestId);
    const merged = this.mergeFields(request.extractedFields);
    await this.prisma.customsClearanceRequest.update({
      where: { id: customsRequestId },
      data: {
        billOfLadingNumber: merged['shipment.billOfLadingNumber'] ?? undefined,
        bookingNumber: merged['shipment.bookingNumber'] ?? undefined,
        shippingLine: merged['shipment.carrier'] ?? undefined,
        vesselName: merged['shipment.vessel'] ?? undefined,
        voyageNumber: merged['shipment.voyage'] ?? undefined,
        portOfLoading: merged['shipment.portOfLoading'] ?? undefined,
        portOfDischarge: merged['shipment.portOfDischarge'] ?? undefined,
        shipmentReference: merged['shipment.shipmentReference'] ?? undefined,
        countryOfOrigin: merged['commercial.countryOfOrigin']?.slice(0, 2) ?? undefined,
        consigneeName: request.consigneeName ?? merged['parties.consignee'] ?? undefined,
      },
    });
  }

  private async syncCargoLines(customsRequestId: string) {
    const fields = await this.prisma.declarationExtractedField.findMany({
      where: { customsRequestId, fieldKey: { startsWith: 'cargo.line.' } },
    });
    const lineMap = new Map<number, CargoLineDraft>();
    for (const f of fields) {
      if (f.cargoLineIndex == null || !f.displayValue) continue;
      const line = lineMap.get(f.cargoLineIndex) ?? { description: '' };
      const suffix = f.fieldKey.split('.').pop();
      switch (suffix) {
        case 'description':
          line.description = f.displayValue;
          break;
        case 'quantity':
          line.quantity = Number(f.displayValue);
          break;
        case 'unitOfMeasure':
          line.unitOfMeasure = f.displayValue;
          break;
        case 'unitPrice':
          line.unitPrice = Number(f.displayValue);
          break;
        case 'totalValue':
          line.cargoValue = Number(f.displayValue);
          break;
        case 'grossWeightKg':
          line.grossWeightKg = Number(f.displayValue);
          break;
        case 'netWeightKg':
          line.netWeightKg = Number(f.displayValue);
          break;
        case 'packageCount':
          line.packageCount = Number(f.displayValue);
          break;
        case 'packageType':
          line.packageType = f.displayValue;
          break;
        case 'volumeCbm':
          line.volumeCbm = Number(f.displayValue);
          break;
        default:
          break;
      }
      lineMap.set(f.cargoLineIndex, line);
    }
    const vehicleFields = await this.prisma.declarationExtractedField.findMany({
      where: { customsRequestId, fieldGroup: 'vehicle' },
    });
    const vehicle: Partial<CargoLineDraft> = {};
    for (const f of vehicleFields) {
      if (!f.displayValue) continue;
      if (f.fieldKey === 'vehicle.vin') vehicle.vin = f.displayValue;
      if (f.fieldKey === 'vehicle.make') vehicle.vehicleMake = f.displayValue;
      if (f.fieldKey === 'vehicle.model') vehicle.vehicleModel = f.displayValue;
      if (f.fieldKey === 'vehicle.year') vehicle.vehicleYear = Number(f.displayValue);
      if (f.fieldKey === 'cargo.grossWeightKg') vehicle.grossWeightKg = Number(f.displayValue);
    }

    await this.prisma.customsCargoLine.deleteMany({ where: { customsRequestId } });
    const lines = [...lineMap.entries()].sort(([a], [b]) => a - b).map(([, line], sortOrder) => ({ ...line, sortOrder }));
    if (lines.length === 0 && Object.keys(vehicle).length > 0) {
      lines.push({ description: `${vehicle.vehicleMake ?? ''} ${vehicle.vehicleModel ?? ''}`.trim() || 'Vehicle', ...vehicle, sortOrder: 0, isVehicleCargo: true } as never);
    }
    for (const [index, line] of lines.entries()) {
      if (!line.description) continue;
      await this.prisma.customsCargoLine.create({
        data: {
          customsRequestId,
          description: line.description,
          quantity: line.quantity,
          unitOfMeasure: line.unitOfMeasure,
          unitPrice: line.unitPrice,
          cargoValue: line.cargoValue,
          packageCount: line.packageCount,
          packageType: line.packageType,
          grossWeightKg: line.grossWeightKg,
          netWeightKg: line.netWeightKg,
          volumeCbm: line.volumeCbm,
          currency: line.currency ?? 'OMR',
          vin: line.vin ?? vehicle.vin,
          vehicleMake: line.vehicleMake ?? vehicle.vehicleMake,
          vehicleModel: line.vehicleModel ?? vehicle.vehicleModel,
          vehicleYear: line.vehicleYear ?? vehicle.vehicleYear,
          isVehicleCargo: Boolean(line.vin ?? vehicle.vin),
          sortOrder: index,
        },
      });
    }
  }

  private async upsertManualField(customsRequestId: string, fieldKey: string, value: string, userId: string) {
    const existing = await this.prisma.declarationExtractedField.findFirst({
      where: { customsRequestId, fieldKey, reviewStatus: 'MANUALLY_OVERRIDDEN' },
    });
    if (existing) {
      await this.prisma.declarationExtractedField.update({
        where: { id: existing.id },
        data: { displayValue: value, normalizedValue: value, reviewedById: userId, reviewedAt: new Date() },
      });
      return;
    }
    await this.prisma.declarationExtractedField.create({
      data: {
        customsRequestId,
        fieldKey,
        fieldGroup: fieldKey.split('.')[0] ?? 'customs',
        displayValue: value,
        normalizedValue: value,
        reviewStatus: 'MANUALLY_OVERRIDDEN',
        confidence: 1,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
    });
  }
}
