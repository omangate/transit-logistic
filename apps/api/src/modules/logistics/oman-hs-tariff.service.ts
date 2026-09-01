import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

import { OmanHsTariffImportService } from './oman-hs-tariff-import.service';

@Injectable()
export class OmanHsTariffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importService: OmanHsTariffImportService,
  ) {}

  stats() {
    return this.importService.getDatasetStats();
  }

  async search(query: string, limit = 12, page = 1) {
    const q = query.trim();
    const stats = await this.importService.getDatasetStats();
    if (stats.totalRecords === 0) {
      return { results: [], total: 0, page, datasetIncomplete: true, message: stats.completenessMessage };
    }

    if (!q) {
      const results = await this.prisma.omanHsTariffEntry.findMany({
        where: { isActive: true, isOfficialSource: true },
        orderBy: { hsCode: 'asc' },
        take: limit,
        skip: (page - 1) * limit,
      });
      return { results: results.map((e) => this.formatEntry(e, 0.5, 'browse')), total: stats.totalRecords, page, datasetIncomplete: !stats.datasetComplete };
    }

    const normalized = q.toLowerCase();
    const digits = q.replace(/\D/g, '');
    const entries = await this.prisma.omanHsTariffEntry.findMany({
      where: { isActive: true },
      take: 500,
      orderBy: { hsCode: 'asc' },
    });

    const ranked = entries
      .map((entry) => {
        let score = 0;
        let explanation = '';
        if (digits && entry.hsCode.includes(digits)) {
          score += entry.hsCode === digits ? 10 : entry.hsCode.startsWith(digits) ? 8 : 5;
          explanation = `HS code match: ${entry.hsCode}`;
        }
        if (entry.descriptionEn.toLowerCase().includes(normalized)) {
          score += 4;
          explanation = explanation || `English description contains "${q}"`;
        }
        if (entry.descriptionAr.includes(q)) {
          score += 4;
          explanation = explanation || `Arabic description match`;
        }
        for (const kw of entry.keywords) {
          if (kw.toLowerCase().includes(normalized) || normalized.includes(kw.toLowerCase())) {
            score += 2;
            explanation = explanation || `Keyword: ${kw}`;
          }
        }
        if (entry.chapter === digits.slice(0, 2)) score += 1;
        return { entry, score, explanation };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    const total = ranked.length;
    const pageResults = ranked.slice((page - 1) * limit, page * limit);
    return {
      results: pageResults.map(({ entry, score, explanation }) => this.formatEntry(entry, Math.min(0.99, 0.45 + score * 0.06), explanation)),
      total,
      page,
      datasetIncomplete: !stats.datasetComplete,
      message: stats.datasetComplete ? undefined : stats.completenessMessage,
    };
  }

  async suggestForLine(cargoLineId: string) {
    const line = await this.prisma.customsCargoLine.findUniqueOrThrow({ where: { id: cargoLineId } });
    const { results } = await this.search(line.description, 5);
    await this.prisma.cargoLineHsSuggestion.deleteMany({ where: { cargoLineId } });
    if (results.length === 0) return [];
    await this.prisma.cargoLineHsSuggestion.createMany({
      data: results.map((s, sortOrder) => ({
        cargoLineId,
        hsCode: s.hsCode,
        descriptionEn: s.descriptionEn,
        descriptionAr: s.descriptionAr,
        dutyRate: s.dutyRate,
        permitRequired: s.permitRequired,
        restrictionNote: s.restrictionNote,
        confidence: s.confidence,
        isOfficialSource: s.isOfficialSource,
        matchExplanation: s.matchExplanation,
        tariffVersion: s.tariffVersion,
        officialSourceUrl: s.officialSourceUrl,
        sortOrder,
      })),
    });
    return results;
  }

  async suggestForAllLines(customsRequestId: string) {
    const lines = await this.prisma.customsCargoLine.findMany({ where: { customsRequestId } });
    for (const line of lines) await this.suggestForLine(line.id);
  }

  async suggestionsForRequest(customsRequestId: string) {
    const stats = await this.importService.getDatasetStats();
    const lines = await this.prisma.customsCargoLine.findMany({
      where: { customsRequestId },
      include: { hsSuggestions: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    return {
      datasetIncomplete: !stats.datasetComplete,
      completenessMessage: stats.completenessMessage,
      lines: lines.map((line) => ({
        cargoLineId: line.id,
        description: line.description,
        approvedHsCode: line.approvedHsCode,
        suggestions: line.hsSuggestions,
      })),
    };
  }

  private formatEntry(
    entry: {
      hsCode: string;
      descriptionEn: string;
      descriptionAr: string;
      dutyRate: string | null;
      permitRequired: boolean;
      restrictionNote: string | null;
      tariffVersion: string | null;
      tariffYear: number | null;
      officialSourceUrl: string | null;
      isOfficialSource: boolean;
    },
    confidence: number,
    matchExplanation: string,
  ) {
    return {
      hsCode: entry.hsCode,
      descriptionEn: entry.descriptionEn,
      descriptionAr: entry.descriptionAr,
      dutyRate: entry.dutyRate,
      permitRequired: entry.permitRequired,
      restrictionNote: entry.restrictionNote,
      confidence,
      isOfficialSource: entry.isOfficialSource,
      tariffVersion: entry.tariffVersion,
      tariffYear: entry.tariffYear,
      officialSourceUrl: entry.officialSourceUrl,
      matchExplanation,
    };
  }
}
