import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { User } from '@/types/user';

import { PrismaService } from '../../database/prisma.service';

const PUBLIC_LISTING_WHERE = {
  listingStatus: 'approved' as const,
  isListingEnabled: true,
};

const FAVORITE_INCLUDE = {
  truckListing: {
    include: {
      images: { where: { isCover: true }, take: 1 },
      fleetOwner: { select: { id: true, companyName: true, kycStatus: true } },
      serviceAreas: {
        take: 2,
        include: {
          geoRegion: { select: { id: true, nameEn: true, nameAr: true, type: true } },
        },
      },
    },
  },
};

@Injectable()
export class MarketplaceFavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: User) {
    const favorites = await this.prisma.truckFavorite.findMany({
      where: { userId: user.id },
      include: FAVORITE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return favorites.map((f: { truckListing: unknown }) => f.truckListing);
  }

  async listIds(user: User): Promise<string[]> {
    const rows = await this.prisma.truckFavorite.findMany({
      where: { userId: user.id },
      select: { truckListingId: true },
    });
    return rows.map((r: { truckListingId: string }) => r.truckListingId);
  }

  async add(user: User, listingId: string) {
    const listing = await this.prisma.truckListing.findFirst({
      where: { id: listingId, ...PUBLIC_LISTING_WHERE },
    });

    if (!listing) {
      throw new NotFoundException({
        code: 'LISTING_NOT_FOUND',
        message_en: 'Truck listing not found.',
        message_ar: 'إعلان الشاحنة غير موجود.',
      });
    }

    try {
      await this.prisma.truckFavorite.create({
        data: { userId: user.id, truckListingId: listingId },
      });
    } catch {
      throw new ConflictException({
        code: 'ALREADY_FAVORITED',
        message_en: 'This truck is already in your favorites.',
        message_ar: 'هذه الشاحنة موجودة في المفضلة بالفعل.',
      });
    }

    return { favorited: true, truckListingId: listingId };
  }

  async remove(user: User, listingId: string) {
    await this.prisma.truckFavorite.deleteMany({
      where: { userId: user.id, truckListingId: listingId },
    });
    return { favorited: false, truckListingId: listingId };
  }
}
