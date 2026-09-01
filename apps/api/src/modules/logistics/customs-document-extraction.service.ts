import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LogisticsDocument, LogisticsDocumentCategory } from '@prisma/client';
import pdfParse from 'pdf-parse';

import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../database/prisma.service';

import { DECLARATION_FIELD_GROUPS, type ExtractedFieldInput } from './customs-field-keys';
import { mergeAiFields, parseDocumentFields, type PageText, type ParsedField } from './document-field-parser';

@Injectable()
export class CustomsDocumentExtractionService {
  private readonly logger = new Logger(CustomsDocumentExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async extractDocument(documentId: string, customsRequestId: string) {
    const doc = await this.prisma.logisticsDocument.findUniqueOrThrow({ where: { id: documentId } });
    const extraction = await this.prisma.documentExtraction.create({
      data: {
        logisticsDocumentId: documentId,
        customsRequestId,
        status: 'processing',
        detectedCategory: doc.category,
        startedAt: new Date(),
      },
    });

    try {
      const fields = await this.runExtraction(doc);
      await this.prisma.declarationExtractedField.deleteMany({
        where: { customsRequestId, sourceDocumentId: documentId },
      });
      await this.prisma.declarationExtractedField.createMany({
        data: fields.map((f) => ({
          customsRequestId,
          fieldKey: f.fieldKey,
          fieldGroup: f.fieldGroup,
          displayValue: f.displayValue,
          normalizedValue: f.normalizedValue ?? f.displayValue,
          confidence: f.confidence ?? 0.85,
          reviewStatus: f.reviewStatus ?? ((f.confidence ?? 0.85) >= 0.9 ? 'CONFIRMED_FROM_DOCUMENT' : 'NEEDS_REVIEW'),
          extractionMethod: f.extractionMethod,
          evidenceSnippet: f.evidenceSnippet,
          sourceDocumentId: documentId,
          sourcePage: f.sourcePage,
          sourceExtractionId: extraction.id,
          cargoLineIndex: f.cargoLineIndex,
        })),
      });

      const failed = fields.some((f) => f.reviewStatus === 'EXTRACTION_FAILED' || f.fieldKey === 'extraction.status');
      await this.prisma.documentExtraction.update({
        where: { id: extraction.id },
        data: {
          status: failed ? 'failed' : 'completed',
          completedAt: new Date(),
          errorMessage: failed ? 'No structured fields extracted from document' : undefined,
          rawPayload: { fieldCount: fields.length, category: doc.category, methods: [...new Set(fields.map((f) => f.extractionMethod))] },
        },
      });

      return { extractionId: extraction.id, fieldCount: fields.length, failed };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extraction failed';
      this.logger.warn(`Extraction failed for ${documentId}: ${message}`);
      await this.prisma.documentExtraction.update({
        where: { id: extraction.id },
        data: { status: 'failed', errorMessage: message, completedAt: new Date() },
      });
      await this.prisma.declarationExtractedField.create({
        data: {
          customsRequestId,
          fieldKey: 'extraction.status',
          fieldGroup: DECLARATION_FIELD_GROUPS.document,
          displayValue: 'EXTRACTION_FAILED',
          normalizedValue: 'EXTRACTION_FAILED',
          reviewStatus: 'EXTRACTION_FAILED',
          confidence: 0,
          extractionMethod: 'error',
          sourceDocumentId: documentId,
          sourceExtractionId: extraction.id,
        },
      });
      throw err;
    }
  }

  async extractAllForRequest(customsRequestId: string) {
    const docs = await this.prisma.logisticsDocument.findMany({
      where: { customsRequestId },
      orderBy: { createdAt: 'asc' },
    });
    const results = [];
    for (const doc of docs) {
      results.push(await this.extractDocument(doc.id, customsRequestId));
    }
    return results;
  }

  private async runExtraction(doc: LogisticsDocument): Promise<ParsedField[]> {
    if (!doc.storageKey) {
      return this.failedFields('missing_storage');
    }

    const { buffer } = await this.storage.read(doc.storageKey);
    const mime = doc.mimeType ?? '';
    let pages: PageText[] = [];

    if (mime.includes('pdf') || doc.originalName?.toLowerCase().endsWith('.pdf')) {
      pages = await this.extractPdfPages(buffer);
    } else if (mime.startsWith('image/') || /\.(jpe?g|png)$/i.test(doc.originalName ?? '')) {
      const aiPages = await this.extractImageWithVision(buffer, mime, doc.category);
      if (aiPages.length) pages = aiPages;
    } else {
      const text = buffer.toString('utf8').trim();
      if (text) pages = [{ page: 1, text }];
    }

    if (!pages.some((p) => p.text.trim())) {
      return this.failedFields('no_text');
    }

    const heuristic = parseDocumentFields(doc.category, pages);
    if (heuristic.some((f) => f.fieldKey === 'extraction.status')) {
      const aiOnly = await this.tryAiExtraction(doc.category, pages);
      if (aiOnly.length && !aiOnly.some((f) => f.fieldKey === 'extraction.status')) return aiOnly;
      return heuristic;
    }

    const aiFields = await this.tryAiExtraction(doc.category, pages);
    return aiFields.length ? mergeAiFields(heuristic, aiFields) : heuristic;
  }

  private async extractPdfPages(buffer: Buffer): Promise<PageText[]> {
    try {
      const parsed = await pdfParse(buffer);
      const text = parsed.text?.trim() ?? '';
      if (text) return [{ page: 1, text }];
    } catch (err) {
      this.logger.warn(`PDF parse failed: ${err instanceof Error ? err.message : err}`);
    }
    const fallback = this.extractPdfTextFallback(buffer);
    if (fallback.trim()) return [{ page: 1, text: fallback }];
    return [];
  }

  private extractPdfTextFallback(buffer: Buffer): string {
    const raw = buffer.toString('latin1');
    const parts: string[] = [];
    for (const match of raw.matchAll(/\(([^\\)]{2,240})\)/g)) {
      const segment = match[1]?.replace(/\\n/g, '\n').replace(/\\r/g, '\r').trim();
      if (segment && /[A-Za-z0-9]/.test(segment)) parts.push(segment);
    }
    return parts.join('\n');
  }

  private async extractImageWithVision(buffer: Buffer, mime: string, category: LogisticsDocumentCategory): Promise<PageText[]> {
    const apiKey = this.config.get<string>('ai.openaiApiKey');
    if (!apiKey) return [];

    try {
      const b64 = buffer.toString('base64');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.get<string>('ai.model', 'gpt-4o-mini'),
          messages: [
            {
              role: 'system',
              content:
                'Extract all readable text from this customs/shipping document image. Return plain text only, preserving labels and values.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: `Document category: ${category}` },
                { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
              ],
            },
          ],
        }),
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content?.trim();
      return text ? [{ page: 1, text }] : [];
    } catch {
      return [];
    }
  }

  private async tryAiExtraction(category: LogisticsDocumentCategory, pages: PageText[]): Promise<ParsedField[]> {
    const apiKey = this.config.get<string>('ai.openaiApiKey');
    if (!apiKey) return [];

    const textSample = pages.map((p) => `--- Page ${p.page} ---\n${p.text}`).join('\n\n').slice(0, 12000);
    if (!textSample.trim()) return [];

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.get<string>('ai.model', 'gpt-4o-mini'),
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `Extract customs declaration fields from document text. Return JSON { "fields": [{ "fieldKey", "fieldGroup", "displayValue", "confidence", "sourcePage", "evidenceSnippet", "cargoLineIndex?" }] }.
Use keys: parties.seller, parties.buyer, parties.consignee, parties.notifyParty, commercial.invoiceNumber, commercial.invoiceDate, commercial.invoiceTotal, commercial.currency, commercial.incoterm, commercial.countryOfOrigin, commercial.countryOfExport, cargo.line.N.description, cargo.line.N.quantity, cargo.line.N.unitOfMeasure, cargo.line.N.totalValue, cargo.line.N.grossWeightKg, cargo.packageCount, cargo.packageType, cargo.grossWeightKg, cargo.netWeightKg, shipment.billOfLadingNumber, shipment.containerNumbers, shipment.sealNumbers, shipment.vessel, shipment.voyage, shipment.portOfLoading, shipment.portOfDischarge, vehicle.vin.
Only include values explicitly present in the text. Never invent values.`,
            },
            { role: 'user', content: `Document category: ${category}\n\n${textSample}` },
          ],
        }),
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (!content) return [];
      const parsed = JSON.parse(content) as { fields?: Array<ExtractedFieldInput & { evidenceSnippet?: string }> };
      return (parsed.fields ?? [])
        .filter((f) => f.fieldKey && f.displayValue)
        .map((f) => ({
          ...f,
          extractionMethod: 'openai_structured',
          evidenceSnippet: f.evidenceSnippet,
          reviewStatus: (f.confidence ?? 0.85) >= 0.92 ? 'CONFIRMED_FROM_DOCUMENT' as const : 'NEEDS_REVIEW' as const,
        }));
    } catch {
      return [];
    }
  }

  private failedFields(reason: string): ParsedField[] {
    return [
      {
        fieldKey: 'extraction.status',
        fieldGroup: DECLARATION_FIELD_GROUPS.document,
        displayValue: 'EXTRACTION_FAILED',
        reviewStatus: 'EXTRACTION_FAILED',
        confidence: 0,
        sourcePage: 1,
        extractionMethod: reason,
      },
    ];
  }
}
