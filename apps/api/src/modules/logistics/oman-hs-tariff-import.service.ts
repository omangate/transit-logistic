import { Injectable } from '@nestjs/common';
import type { User } from '@/types/user';
import * as XLSX from 'xlsx';

import { PrismaService } from '../../database/prisma.service';

export type HsImportRecord = {
  hsCode: string;
  descriptionEn: string;
  descriptionAr: string;
  chapter?: string;
  heading?: string;
  subheading?: string;
  dutyRate?: string;
  unitOfMeasure?: string;
  permitRequired?: boolean;
  restrictionNote?: string;
  keywords?: string[];
  tariffVersion?: string;
  tariffYear?: number;
  officialSource?: string;
  officialSourceUrl?: string;
  isOfficialSource?: boolean;
  isVerified?: boolean;
};

const OFFICIAL_SOURCE = 'Royal Oman Customs — GCC Unified Tariff';
const OFFICIAL_SOURCE_URL = 'https://www.customs.gov.om/esw/jsf/secure/esw/common/PublicHSCodeSearch.xhtml';

@Injectable()
export class OmanHsTariffImportService {
  constructor(private readonly prisma: PrismaService) {}

  async getDatasetStats() {
    const [total, official, verified, activeVersion] = await Promise.all([
      this.prisma.omanHsTariffEntry.count({ where: { isActive: true } }),
      this.prisma.omanHsTariffEntry.count({ where: { isActive: true, isOfficialSource: true } }),
      this.prisma.omanHsTariffEntry.count({ where: { isActive: true, isVerified: true } }),
      this.prisma.omanHsTariffEntry.findFirst({
        where: { isActive: true },
        orderBy: { importedAt: 'desc' },
        select: { tariffVersion: true, tariffYear: true, officialSource: true, officialSourceUrl: true, importedAt: true, lastVerifiedAt: true },
      }),
    ]);
    const lastImport = await this.prisma.omanHsTariffImportBatch.findFirst({ orderBy: { createdAt: 'desc' } });
    return {
      totalRecords: total,
      officialRecords: official,
      unverifiedRecords: total - verified,
      activeTariffVersion: activeVersion?.tariffVersion ?? null,
      tariffYear: activeVersion?.tariffYear ?? null,
      officialSource: activeVersion?.officialSource ?? OFFICIAL_SOURCE,
      officialSourceUrl: activeVersion?.officialSourceUrl ?? OFFICIAL_SOURCE_URL,
      lastImportAt: lastImport?.createdAt ?? activeVersion?.importedAt ?? null,
      lastVerifiedAt: activeVersion?.lastVerifiedAt ?? null,
      datasetComplete: official >= 1000,
      completenessMessage: official >= 1000 ? null : 'Official tariff dataset incomplete — import official GCC Unified Tariff via Admin → Customs → Oman HS Tariff',
    };
  }

  async listBatches() {
    return this.prisma.omanHsTariffImportBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  }

  async importRecords(user: User | null, records: HsImportRecord[], meta: { fileName?: string; fileFormat: string; tariffVersion?: string; tariffYear?: number; notes?: string; archivePrevious?: boolean }) {
    const batch = await this.prisma.omanHsTariffImportBatch.create({
      data: {
        fileName: meta.fileName,
        fileFormat: meta.fileFormat,
        tariffVersion: meta.tariffVersion ?? 'GCC-2025',
        tariffYear: meta.tariffYear ?? 2025,
        officialSource: OFFICIAL_SOURCE,
        officialSourceUrl: OFFICIAL_SOURCE_URL,
        importedById: user?.id,
        notes: meta.notes,
      },
    });

    if (meta.archivePrevious && meta.tariffVersion) {
      await this.prisma.omanHsTariffEntry.updateMany({
        where: { tariffVersion: { not: meta.tariffVersion }, isActive: true },
        data: { isActive: false },
      });
    }

    let officialCount = 0;
    for (const rec of records) {
      if (!rec.hsCode?.trim() || !rec.descriptionEn?.trim()) continue;
      const hsCode = rec.hsCode.replace(/\D/g, '').slice(0, 12);
      if (hsCode.length < 4) continue;
      const isOfficial = rec.isOfficialSource ?? true;
      if (isOfficial) officialCount += 1;
      await this.prisma.omanHsTariffEntry.upsert({
        where: { hsCode_tariffVersion: { hsCode, tariffVersion: meta.tariffVersion ?? batch.tariffVersion ?? 'GCC-2025' } },
        create: {
          hsCode,
          descriptionEn: rec.descriptionEn.trim(),
          descriptionAr: rec.descriptionAr?.trim() || rec.descriptionEn.trim(),
          chapter: rec.chapter ?? hsCode.slice(0, 2),
          heading: rec.heading ?? hsCode.slice(0, 4),
          subheading: rec.subheading ?? hsCode.slice(0, 6),
          dutyRate: rec.dutyRate,
          unitOfMeasure: rec.unitOfMeasure,
          permitRequired: rec.permitRequired ?? false,
          restrictionNote: rec.restrictionNote,
          keywords: rec.keywords ?? [],
          tariffVersion: meta.tariffVersion ?? batch.tariffVersion ?? 'GCC-2025',
          tariffYear: meta.tariffYear ?? batch.tariffYear ?? 2025,
          officialSource: rec.officialSource ?? OFFICIAL_SOURCE,
          officialSourceUrl: rec.officialSourceUrl ?? OFFICIAL_SOURCE_URL,
          isOfficialSource: isOfficial,
          isVerified: rec.isVerified ?? isOfficial,
          isActive: true,
          importBatchId: batch.id,
          lastVerifiedAt: isOfficial ? new Date() : undefined,
        },
        update: {
          descriptionEn: rec.descriptionEn.trim(),
          descriptionAr: rec.descriptionAr?.trim() || rec.descriptionEn.trim(),
          chapter: rec.chapter ?? hsCode.slice(0, 2),
          heading: rec.heading ?? hsCode.slice(0, 4),
          subheading: rec.subheading ?? hsCode.slice(0, 6),
          dutyRate: rec.dutyRate,
          unitOfMeasure: rec.unitOfMeasure,
          permitRequired: rec.permitRequired ?? false,
          restrictionNote: rec.restrictionNote,
          keywords: rec.keywords ?? [],
          isOfficialSource: isOfficial,
          isVerified: rec.isVerified ?? isOfficial,
          isActive: true,
          importBatchId: batch.id,
          lastVerifiedAt: isOfficial ? new Date() : undefined,
        },
      });
    }

    return this.prisma.omanHsTariffImportBatch.update({
      where: { id: batch.id },
      data: { recordCount: records.length, officialCount },
    });
  }

  parseFile(buffer: Buffer, fileName: string): HsImportRecord[] {
    const ext = fileName.toLowerCase();
    if (ext.endsWith('.json')) {
      const parsed = JSON.parse(buffer.toString('utf8')) as { records?: HsImportRecord[] } | HsImportRecord[];
      return Array.isArray(parsed) ? parsed : (parsed.records ?? []);
    }
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const sheet = wb.Sheets[sheetName]!;
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    return rows.map((row) => ({
      hsCode: String(row.hsCode ?? row.HSCode ?? row['HS Code'] ?? row.code ?? '').trim(),
      descriptionEn: String(row.descriptionEn ?? row.description_en ?? row.Description ?? row.description ?? '').trim(),
      descriptionAr: String(row.descriptionAr ?? row.description_ar ?? row['Description AR'] ?? row.descriptionAr ?? '').trim(),
      chapter: row.chapter ? String(row.chapter) : undefined,
      heading: row.heading ? String(row.heading) : undefined,
      subheading: row.subheading ? String(row.subheading) : undefined,
      dutyRate: row.dutyRate ?? row.duty_rate ?? row['Duty Rate'] ? String(row.dutyRate ?? row.duty_rate ?? row['Duty Rate']) : undefined,
      unitOfMeasure: row.unitOfMeasure ?? row.unit ? String(row.unitOfMeasure ?? row.unit) : undefined,
      permitRequired: ['true', '1', 'yes', 'y'].includes(String(row.permitRequired ?? row.permit_required ?? '').toLowerCase()),
      restrictionNote: row.restrictionNote ?? row.restriction_note ? String(row.restrictionNote ?? row.restriction_note) : undefined,
      keywords: row.keywords ? String(row.keywords).split(/[,;|]/).map((k) => k.trim()).filter(Boolean) : undefined,
      tariffVersion: row.tariffVersion ? String(row.tariffVersion) : undefined,
      tariffYear: row.tariffYear ? Number(row.tariffYear) : undefined,
      isOfficialSource: row.isOfficialSource !== 'false',
      isVerified: row.isVerified !== 'false',
    }));
  }
}
