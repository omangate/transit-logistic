import { Injectable } from '@nestjs/common';
import type { GeoRegionType, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class GeographyService {
  constructor(private readonly prisma: PrismaService) {}

  listCountries() {
    return this.prisma.country.findMany({
      where: { isActive: true },
      orderBy: { nameEn: 'asc' },
    });
  }

  getCountry(code: string) {
    return this.prisma.country.findUniqueOrThrow({ where: { code } });
  }

  listRegions(query: {
    countryCode?: string;
    type?: GeoRegionType;
    parentId?: string;
    governorateId?: string;
  }) {
    const where: Prisma.GeoRegionWhereInput = { isActive: true };

    if (query.countryCode) where.countryCode = query.countryCode;
    if (query.type) where.type = query.type;
    if (query.parentId) where.parentId = query.parentId;
    if (query.governorateId) where.parentId = query.governorateId;

    return this.prisma.geoRegion.findMany({
      where,
      orderBy: [{ type: 'asc' }, { nameEn: 'asc' }],
      include: {
        children: {
          where: { isActive: true },
          orderBy: { nameEn: 'asc' },
        },
      },
    });
  }

  async searchRegions(countryCode: string, q: string, limit = 20) {
    return this.prisma.geoRegion.findMany({
      where: {
        countryCode,
        isActive: true,
        OR: [
          { nameEn: { contains: q, mode: 'insensitive' } },
          { nameAr: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { nameEn: 'asc' },
    });
  }

  getRegion(id: string) {
    return this.prisma.geoRegion.findUniqueOrThrow({
      where: { id },
      include: {
        parent: true,
        children: { where: { isActive: true }, orderBy: { nameEn: 'asc' } },
      },
    });
  }

  listGovernorates(countryCode = 'OM') {
    return this.prisma.geoRegion.findMany({
      where: { countryCode, type: 'governorate', isActive: true },
      orderBy: { nameEn: 'asc' },
      include: {
        children: {
          where: { type: 'wilayat', isActive: true },
          orderBy: { nameEn: 'asc' },
        },
      },
    });
  }

  async searchPorts(q: string, limit = 20) {
    const query = q.trim();
    if (query.length < 2) {
      return [];
    }

    const { INTERNATIONAL_PORTS } = await import('./international-ports.constants');
    const normalized = query.toUpperCase();

    const staticMatches = INTERNATIONAL_PORTS.filter(
      (port) =>
        port.unlocode.includes(normalized) ||
        port.nameEn.toLowerCase().includes(query.toLowerCase()) ||
        port.nameAr.includes(query) ||
        port.country.toLowerCase().includes(query.toLowerCase()),
    ).slice(0, limit);

    const dbPorts = await this.prisma.geoRegion.findMany({
      where: {
        type: 'port',
        isActive: true,
        OR: [
          { nameEn: { contains: query, mode: 'insensitive' } },
          { nameAr: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { nameEn: 'asc' },
    });

    const dbMapped = dbPorts.map((port) => ({
      unlocode: port.code.toUpperCase(),
      nameEn: port.nameEn,
      nameAr: port.nameAr,
      countryCode: port.countryCode,
      source: 'database' as const,
      latitude: port.latitude ? Number(port.latitude) : undefined,
      longitude: port.longitude ? Number(port.longitude) : undefined,
    }));

    const staticMapped = staticMatches.map((port) => ({
      unlocode: port.unlocode,
      nameEn: port.nameEn,
      nameAr: port.nameAr,
      countryCode: port.countryCode,
      country: port.country,
      source: 'reference' as const,
    }));

    const seen = new Set<string>();
    return [...dbMapped, ...staticMapped].filter((port) => {
      if (seen.has(port.unlocode)) return false;
      seen.add(port.unlocode);
      return true;
    }).slice(0, limit);
  }
}
