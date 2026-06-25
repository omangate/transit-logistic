import type { PrismaClient } from '@prisma/client';

import { OMAN_COUNTRY, OMAN_REGIONS } from '../data/oman-geography';

type RegionNode = (typeof OMAN_REGIONS)[number];

async function seedRegionTree(
  prisma: PrismaClient,
  node: RegionNode,
  countryCode: string,
  parentId?: string,
): Promise<void> {
  const created = await prisma.geoRegion.upsert({
    where: { countryCode_code: { countryCode, code: node.code } },
    create: {
      countryCode,
      type: node.type,
      code: node.code,
      nameEn: node.nameEn,
      nameAr: node.nameAr,
      parentId,
      latitude: node.latitude,
      longitude: node.longitude,
    },
    update: {
      nameEn: node.nameEn,
      nameAr: node.nameAr,
      parentId,
      latitude: node.latitude,
      longitude: node.longitude,
      type: node.type,
    },
  });

  if ('children' in node && node.children) {
    for (const child of node.children) {
      await seedRegionTree(prisma, child, countryCode, created.id);
    }
  }
}

export async function seedOmanGeography(prisma: PrismaClient): Promise<void> {
  await prisma.country.upsert({
    where: { code: OMAN_COUNTRY.code },
    create: {
      code: OMAN_COUNTRY.code,
      nameEn: OMAN_COUNTRY.nameEn,
      nameAr: OMAN_COUNTRY.nameAr,
      defaultCurrency: OMAN_COUNTRY.defaultCurrency,
      centerLatitude: OMAN_COUNTRY.centerLatitude,
      centerLongitude: OMAN_COUNTRY.centerLongitude,
      defaultZoom: OMAN_COUNTRY.defaultZoom,
    },
    update: {
      nameEn: OMAN_COUNTRY.nameEn,
      nameAr: OMAN_COUNTRY.nameAr,
      defaultCurrency: OMAN_COUNTRY.defaultCurrency,
      centerLatitude: OMAN_COUNTRY.centerLatitude,
      centerLongitude: OMAN_COUNTRY.centerLongitude,
      defaultZoom: OMAN_COUNTRY.defaultZoom,
    },
  });

  for (const region of OMAN_REGIONS) {
    await seedRegionTree(prisma, region, OMAN_COUNTRY.code);
  }
}
