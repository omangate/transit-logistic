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
}
