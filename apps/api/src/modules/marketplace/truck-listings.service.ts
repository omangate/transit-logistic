/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, TruckListingStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';
import { FleetOwnershipService } from '../fleet/fleet-ownership.service';

import type {
  CreateTruckListingDto,
  CreateTruckReviewDto,
  MarketplaceBrowseQueryDto,
  UpdateTruckListingDto,
} from './dto/marketplace.dto';

const PUBLIC_LISTING_WHERE: Prisma.TruckListingWhereInput = {
  listingStatus: 'approved',
  isListingEnabled: true,
};

const LISTING_INCLUDE = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  serviceAreas: {
    include: {
      geoRegion: {
        select: { id: true, code: true, type: true, nameEn: true, nameAr: true, parentId: true },
      },
    },
  },
  fleetOwner: {
    select: {
      id: true,
      companyName: true,
      kycStatus: true,
    },
  },
  _count: { select: { reviews: true, quoteRequests: true } },
} satisfies Prisma.TruckListingInclude;

function omitPlatePublic<T extends { plateNumber?: string | null }>(listing: T) {
  const { plateNumber: _removed, ...rest } = listing;
  return rest;
}

function buildSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${base || 'truck'}-${randomBytes(3).toString('hex')}`;
}

@Injectable()
export class TruckListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: FleetOwnershipService,
  ) {}

  async createForFleet(user: User, dto: CreateTruckListingDto) {
    const fleetOwner = await this.ownership.resolveFleetOwnerForCreate(user);

    if (dto.vehicleId) {
      await this.ownership.assertVehicleOwnership(user, dto.vehicleId);
      const existing = await this.prisma.truckListing.findUnique({
        where: { vehicleId: dto.vehicleId },
      });
      if (existing) {
        throw new ConflictException({
          code: 'LISTING_EXISTS',
          message_en: 'This vehicle already has a marketplace listing.',
          message_ar: 'هذه المركبة لديها إعلان في السوق بالفعل.',
        });
      }
    }

    const { galleryImages, serviceAreaIds, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.truckListing.create({
        data: {
          fleetOwnerId: fleetOwner.id,
          vehicleId: dto.vehicleId,
          slug: buildSlug(dto.name),
          name: data.name,
          brand: data.brand,
          model: data.model,
          year: data.year,
          vehicleCategory: data.vehicleCategory,
          vehicleType: data.vehicleType,
          capacityKg: data.capacityKg,
          capacityCbm: data.capacityCbm,
          lengthM: data.lengthM,
          widthM: data.widthM,
          heightM: data.heightM,
          cargoType: data.cargoType ?? 'dry',
          shippingMethod: data.shippingMethod ?? 'standard',
          crossBorderSupport: data.crossBorderSupport ?? false,
          refrigeratedSupport: data.refrigeratedSupport ?? false,
          hazardousMaterialsSupport: data.hazardousMaterialsSupport ?? false,
          containerTransportSupport: data.containerTransportSupport ?? false,
          insuranceCoverage: data.insuranceCoverage ?? false,
          operatingCountries: data.operatingCountries ?? ['OM'],
          plateNumber: data.plateNumber,
          videoUrl: data.videoUrl,
          description: data.description,
          coverImageUrl: data.coverImageUrl,
          pricePerKm: data.pricePerKm,
          dailyRentalPrice: data.dailyRentalPrice,
          weeklyRentalPrice: data.weeklyRentalPrice,
          monthlyRentalPrice: data.monthlyRentalPrice,
          withDriverAvailable: data.withDriverAvailable ?? true,
          withoutDriverAvailable: data.withoutDriverAvailable ?? true,
          minRentalDays: data.minRentalDays,
          listingStatus: 'draft',
        },
      });

      if (serviceAreaIds?.length) {
        await tx.truckListingServiceArea.createMany({
          data: serviceAreaIds.map((geoRegionId) => ({
            truckListingId: listing.id,
            geoRegionId,
          })),
        });
      }

      if (galleryImages?.length) {
        await tx.truckListingImage.createMany({
          data: galleryImages.map((url, index) => ({
            truckListingId: listing.id,
            url,
            sortOrder: index,
            isCover: index === 0 && !data.coverImageUrl,
          })),
        });
      }

      return tx.truckListing.findUniqueOrThrow({
        where: { id: listing.id },
        include: LISTING_INCLUDE,
      });
    });
  }

  async findAllForFleet(user: User) {
    const fleetOwner = await this.ownership.resolveFleetOwnerScope(user);
    const where: Prisma.TruckListingWhereInput = fleetOwner
      ? { fleetOwnerId: fleetOwner.id }
      : {};

    return this.prisma.truckListing.findMany({
      where,
      include: LISTING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForFleet(user: User, id: string) {
    await this.assertListingOwnership(user, id);
    return this.prisma.truckListing.findUniqueOrThrow({
      where: { id },
      include: {
        ...LISTING_INCLUDE,
        reviews: {
          where: { isVisible: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async updateForFleet(user: User, id: string, dto: UpdateTruckListingDto) {
    await this.assertListingOwnership(user, id);
    const { galleryImages, serviceAreaIds, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.truckListing.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.brand !== undefined ? { brand: data.brand } : {}),
          ...(data.model !== undefined ? { model: data.model } : {}),
          ...(data.year !== undefined ? { year: data.year } : {}),
          ...(data.vehicleCategory !== undefined
            ? { vehicleCategory: data.vehicleCategory }
            : {}),
          ...(data.vehicleType !== undefined ? { vehicleType: data.vehicleType } : {}),
          ...(data.capacityKg !== undefined ? { capacityKg: data.capacityKg } : {}),
          ...(data.capacityCbm !== undefined ? { capacityCbm: data.capacityCbm } : {}),
          ...(data.lengthM !== undefined ? { lengthM: data.lengthM } : {}),
          ...(data.widthM !== undefined ? { widthM: data.widthM } : {}),
          ...(data.heightM !== undefined ? { heightM: data.heightM } : {}),
          ...(data.cargoType !== undefined ? { cargoType: data.cargoType } : {}),
          ...(data.shippingMethod !== undefined
            ? { shippingMethod: data.shippingMethod }
            : {}),
          ...(data.crossBorderSupport !== undefined
            ? { crossBorderSupport: data.crossBorderSupport }
            : {}),
          ...(data.refrigeratedSupport !== undefined
            ? { refrigeratedSupport: data.refrigeratedSupport }
            : {}),
          ...(data.hazardousMaterialsSupport !== undefined
            ? { hazardousMaterialsSupport: data.hazardousMaterialsSupport }
            : {}),
          ...(data.containerTransportSupport !== undefined
            ? { containerTransportSupport: data.containerTransportSupport }
            : {}),
          ...(data.insuranceCoverage !== undefined
            ? { insuranceCoverage: data.insuranceCoverage }
            : {}),
          ...(data.operatingCountries !== undefined
            ? { operatingCountries: data.operatingCountries }
            : {}),
          ...(data.plateNumber !== undefined ? { plateNumber: data.plateNumber } : {}),
          ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.coverImageUrl !== undefined
            ? { coverImageUrl: data.coverImageUrl }
            : {}),
          ...(data.pricePerKm !== undefined ? { pricePerKm: data.pricePerKm } : {}),
          ...(data.dailyRentalPrice !== undefined ? { dailyRentalPrice: data.dailyRentalPrice } : {}),
          ...(data.weeklyRentalPrice !== undefined ? { weeklyRentalPrice: data.weeklyRentalPrice } : {}),
          ...(data.monthlyRentalPrice !== undefined ? { monthlyRentalPrice: data.monthlyRentalPrice } : {}),
          ...(data.withDriverAvailable !== undefined
            ? { withDriverAvailable: data.withDriverAvailable }
            : {}),
          ...(data.withoutDriverAvailable !== undefined
            ? { withoutDriverAvailable: data.withoutDriverAvailable }
            : {}),
          ...(data.minRentalDays !== undefined ? { minRentalDays: data.minRentalDays } : {}),
          ...(data.availabilityStatus !== undefined
            ? { availabilityStatus: data.availabilityStatus }
            : {}),
          ...(data.isListingEnabled !== undefined
            ? { isListingEnabled: data.isListingEnabled }
            : {}),
        },
      });

      if (serviceAreaIds) {
        await tx.truckListingServiceArea.deleteMany({ where: { truckListingId: id } });
        if (serviceAreaIds.length) {
          await tx.truckListingServiceArea.createMany({
            data: serviceAreaIds.map((geoRegionId) => ({ truckListingId: id, geoRegionId })),
          });
        }
      }

      if (galleryImages) {
        await tx.truckListingImage.deleteMany({ where: { truckListingId: id } });
        if (galleryImages.length) {
          await tx.truckListingImage.createMany({
            data: galleryImages.map((url, index) => ({
              truckListingId: id,
              url,
              sortOrder: index,
              isCover: url === listing.coverImageUrl,
            })),
          });
        }
      }

      return tx.truckListing.findUniqueOrThrow({
        where: { id },
        include: LISTING_INCLUDE,
      });
    });
  }

  async submitForApproval(user: User, id: string) {
    await this.assertListingOwnership(user, id);
    const listing = await this.prisma.truckListing.findUniqueOrThrow({ where: { id } });

    if (listing.listingStatus !== 'draft' && listing.listingStatus !== 'rejected') {
      throw new ConflictException({
        code: 'INVALID_STATUS',
        message_en: 'Only draft or rejected listings can be submitted for approval.',
        message_ar: 'يمكن إرسال المسودات أو المرفوضة فقط للموافقة.',
      });
    }

    return this.prisma.truckListing.update({
      where: { id },
      data: { listingStatus: 'pending_approval', rejectionReason: null },
      include: LISTING_INCLUDE,
    });
  }

  async setCoverImage(user: User, id: string, imageUrl: string) {
    await this.assertListingOwnership(user, id);

    await this.prisma.$transaction([
      this.prisma.truckListingImage.updateMany({
        where: { truckListingId: id },
        data: { isCover: false },
      }),
      this.prisma.truckListingImage.updateMany({
        where: { truckListingId: id, url: imageUrl },
        data: { isCover: true },
      }),
      this.prisma.truckListing.update({
        where: { id },
        data: { coverImageUrl: imageUrl },
      }),
    ]);

    return this.findOneForFleet(user, id);
  }

  async browsePublic(query: MarketplaceBrowseQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;

    const where: Prisma.TruckListingWhereInput = { ...PUBLIC_LISTING_WHERE };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { brand: { contains: query.search, mode: 'insensitive' } },
        { model: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.category) where.vehicleCategory = query.category;
    if (query.vehicleType) where.vehicleType = query.vehicleType;
    if (query.country) where.operatingCountries = { has: query.country };
    if (query.crossBorder === true) where.crossBorderSupport = true;
    if (query.refrigerated === true) where.refrigeratedSupport = true;
    if (query.containerTransport === true) where.containerTransportSupport = true;
    if (query.featured === true) where.isFeatured = true;
    if (query.availability) where.availabilityStatus = query.availability;

    const serviceRegionId = query.wilayatId ?? query.governorateId;
    if (serviceRegionId) {
      where.serviceAreas = { some: { geoRegionId: serviceRegionId } };
    }
    if (query.pickupGeoRegionId || query.deliveryGeoRegionId) {
      const regionIds = [query.pickupGeoRegionId, query.deliveryGeoRegionId].filter(Boolean) as string[];
      where.serviceAreas = { some: { geoRegionId: { in: regionIds } } };
    }
    if (query.minCapacityKg !== undefined || query.maxCapacityKg !== undefined) {
      where.capacityKg = {
        ...(query.minCapacityKg !== undefined ? { gte: query.minCapacityKg } : {}),
        ...(query.maxCapacityKg !== undefined ? { lte: query.maxCapacityKg } : {}),
      };
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.pricePerKm = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }
    if (query.minRating !== undefined) {
      where.avgRating = { gte: query.minRating };
    }

    const orderBy = this.resolveSort(query.sort);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.truckListing.findMany({
        where,
        include: {
          images: { where: { isCover: true }, take: 1 },
          fleetOwner: { select: { id: true, companyName: true, kycStatus: true } },
          serviceAreas: {
            take: 3,
            include: {
              geoRegion: {
                select: { id: true, nameEn: true, nameAr: true, type: true },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.truckListing.count({ where }),
    ]);

    return {
      items: items.map((item) => omitPlatePublic(item)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPublicBySlug(slug: string, sessionId?: string) {
    const listing = await this.prisma.truckListing.findFirst({
      where: { slug, ...PUBLIC_LISTING_WHERE },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        fleetOwner: {
          select: {
            id: true,
            companyName: true,
            kycStatus: true,
            _count: { select: { truckListings: true, ratings: true } },
          },
        },
        reviews: {
          where: { isVisible: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            customer: {
              select: {
                customerProfile: { select: { fullName: true } },
              },
            },
          },
        },
        serviceAreas: {
          include: {
            geoRegion: {
              select: { id: true, nameEn: true, nameAr: true, type: true, latitude: true, longitude: true },
            },
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException({
        code: 'LISTING_NOT_FOUND',
        message_en: 'Truck listing not found.',
        message_ar: 'إعلان الشاحنة غير موجود.',
      });
    }

    await this.prisma.$transaction([
      this.prisma.truckListing.update({
        where: { id: listing.id },
        data: { viewCount: { increment: 1 } },
      }),
      this.prisma.marketplaceView.create({
        data: { truckListingId: listing.id, sessionId },
      }),
    ]);

    return { ...omitPlatePublic(listing), viewCount: listing.viewCount + 1 };
  }

  async getSimilarTrucks(slug: string, limit = 4) {
    const listing = await this.prisma.truckListing.findFirst({
      where: { slug, ...PUBLIC_LISTING_WHERE },
      select: { id: true, vehicleCategory: true, vehicleType: true },
    });

    if (!listing) {
      throw new NotFoundException({
        code: 'LISTING_NOT_FOUND',
        message_en: 'Truck listing not found.',
        message_ar: 'إعلان الشاحنة غير موجود.',
      });
    }

    const similar = await this.prisma.truckListing.findMany({
      where: {
        ...PUBLIC_LISTING_WHERE,
        id: { not: listing.id },
        OR: [
          { vehicleCategory: listing.vehicleCategory },
          { vehicleType: listing.vehicleType },
        ],
      },
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
      orderBy: [{ avgRating: 'desc' }, { viewCount: 'desc' }],
      take: limit,
    });

    return similar.map((item) => omitPlatePublic(item));
  }

  async getHomeSections() {
    const baseWhere = PUBLIC_LISTING_WHERE;

    const [featured, recent, topRated] = await Promise.all([
      this.prisma.truckListing.findMany({
        where: { ...baseWhere, isFeatured: true },
        include: {
          images: { where: { isCover: true }, take: 1 },
          fleetOwner: { select: { companyName: true } },
          serviceAreas: {
            take: 2,
            include: { geoRegion: { select: { id: true, nameEn: true, nameAr: true, type: true } } },
          },
        },
        orderBy: { avgRating: 'desc' },
        take: 6,
      }),
      this.prisma.truckListing.findMany({
        where: baseWhere,
        include: {
          images: { where: { isCover: true }, take: 1 },
          fleetOwner: { select: { companyName: true } },
          serviceAreas: {
            take: 2,
            include: { geoRegion: { select: { id: true, nameEn: true, nameAr: true, type: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.truckListing.findMany({
        where: { ...baseWhere, reviewCount: { gt: 0 } },
        include: {
          images: { where: { isCover: true }, take: 1 },
          fleetOwner: { select: { companyName: true } },
          serviceAreas: {
            take: 2,
            include: { geoRegion: { select: { id: true, nameEn: true, nameAr: true, type: true } } },
          },
        },
        orderBy: [{ avgRating: 'desc' }, { reviewCount: 'desc' }],
        take: 6,
      }),
    ]);

    const premiumFleets = await this.prisma.fleetOwner.findMany({
      where: {
        truckListings: { some: { ...baseWhere, isFeatured: true } },
      },
      select: {
        id: true,
        companyName: true,
        kycStatus: true,
        truckListings: {
          where: baseWhere,
          take: 1,
          select: { coverImageUrl: true, avgRating: true },
        },
        _count: { select: { truckListings: true } },
      },
      take: 6,
    });

    return { featured, recent, topRated, premiumFleets };
  }

  async createReview(user: User, listingId: string, dto: CreateTruckReviewDto) {
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

    const review = await this.prisma.truckReview.create({
      data: {
        truckListingId: listingId,
        customerId: user.id,
        fleetOwnerId: listing.fleetOwnerId,
        driverId: dto.driverId,
        shipmentId: dto.shipmentId,
        communicationScore: dto.communicationScore,
        deliverySpeedScore: dto.deliverySpeedScore,
        vehicleConditionScore: dto.vehicleConditionScore,
        professionalismScore: dto.professionalismScore,
        overallScore: dto.overallScore,
        comment: dto.comment,
      },
    });

    await this.recalculateListingRating(listingId);
    return review;
  }

  async recalculateListingRating(listingId: string) {
    const agg = await this.prisma.truckReview.aggregate({
      where: { truckListingId: listingId, isVisible: true },
      _avg: { overallScore: true },
      _count: true,
    });

    await this.prisma.truckListing.update({
      where: { id: listingId },
      data: {
        avgRating: agg._avg.overallScore ?? 0,
        reviewCount: agg._count,
      },
    });
  }

  async adminList(status?: TruckListingStatus) {
    return this.prisma.truckListing.findMany({
      where: status ? { listingStatus: status } : undefined,
      include: {
        fleetOwner: { select: { companyName: true } },
        images: { where: { isCover: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminApprove(id: string) {
    return this.prisma.truckListing.update({
      where: { id },
      data: {
        listingStatus: 'approved',
        approvedAt: new Date(),
        rejectionReason: null,
      },
      include: LISTING_INCLUDE,
    });
  }

  async adminReject(id: string, reason: string) {
    return this.prisma.truckListing.update({
      where: { id },
      data: {
        listingStatus: 'rejected',
        rejectionReason: reason,
        isFeatured: false,
      },
      include: LISTING_INCLUDE,
    });
  }

  async adminSuspend(id: string) {
    return this.prisma.truckListing.update({
      where: { id },
      data: { listingStatus: 'suspended', isFeatured: false },
      include: LISTING_INCLUDE,
    });
  }

  async adminSetFeatured(id: string, isFeatured: boolean) {
    return this.prisma.truckListing.update({
      where: { id },
      data: { isFeatured },
      include: LISTING_INCLUDE,
    });
  }

  async adminGetOne(id: string) {
    return this.prisma.truckListing.findUniqueOrThrow({
      where: { id },
      include: LISTING_INCLUDE,
    });
  }

  async adminSetListingEnabled(id: string, isListingEnabled: boolean) {
    return this.prisma.truckListing.update({
      where: { id },
      data: { isListingEnabled },
      include: LISTING_INCLUDE,
    });
  }

  async adminModerateReview(reviewId: string, isVisible: boolean) {
    const review = await this.prisma.truckReview.update({
      where: { id: reviewId },
      data: { isVisible, isModerated: true },
    });
    await this.recalculateListingRating(review.truckListingId);
    return review;
  }

  async getAdminMetrics() {
    const [
      totalTrucks,
      activeTrucks,
      featuredTrucks,
      pendingApprovals,
      marketplaceViews,
      quoteRequests,
      shipmentRequests,
      fleetCompanies,
      customers,
      completedDeliveries,
      mostViewed,
      topFleets,
      popularRoutes,
    ] = await Promise.all([
      this.prisma.truckListing.count(),
      this.prisma.truckListing.count({
        where: { listingStatus: 'approved', isListingEnabled: true },
      }),
      this.prisma.truckListing.count({ where: { isFeatured: true } }),
      this.prisma.truckListing.count({ where: { listingStatus: 'pending_approval' } }),
      this.prisma.marketplaceView.count(),
      this.prisma.truckQuoteRequest.count(),
      this.prisma.shipmentRequest.count(),
      this.prisma.fleetOwner.count(),
      this.prisma.user.count({ where: { role: 'customer' } }),
      this.prisma.truckListing.aggregate({ _sum: { completedDeliveries: true } }),
      this.prisma.truckListing.findMany({
        orderBy: { viewCount: 'desc' },
        take: 5,
        select: { id: true, name: true, slug: true, viewCount: true },
      }),
      this.prisma.fleetOwner.findMany({
        take: 5,
        orderBy: { truckListings: { _count: 'desc' } },
        select: {
          id: true,
          companyName: true,
          _count: { select: { truckListings: true } },
        },
      }),
      this.prisma.shipmentRequest.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          pickupAddress: true,
          deliveryAddress: true,
          pickupRegion: { select: { nameEn: true, nameAr: true } },
          deliveryRegion: { select: { nameEn: true, nameAr: true } },
        },
      }),
    ]);

    return {
      totalTrucks,
      activeTrucks,
      featuredTrucks,
      pendingApprovals,
      marketplaceViews,
      quoteRequests,
      shipmentRequests,
      fleetCompanies,
      customers,
      completedDeliveries: completedDeliveries._sum.completedDeliveries ?? 0,
      mostViewedTrucks: mostViewed,
      mostActiveFleetOwners: topFleets,
      popularRoutes,
    };
  }

  private resolveSort(
    sort?: MarketplaceBrowseQueryDto['sort'],
  ): Prisma.TruckListingOrderByWithRelationInput | Prisma.TruckListingOrderByWithRelationInput[] {
    switch (sort) {
      case 'rating':
        return [{ avgRating: 'desc' }, { reviewCount: 'desc' }];
      case 'deliveries':
        return { completedDeliveries: 'desc' };
      case 'price_asc':
        return { pricePerKm: 'asc' };
      case 'price_desc':
        return { pricePerKm: 'desc' };
      default:
        return { createdAt: 'desc' };
    }
  }

  private async assertListingOwnership(user: User, listingId: string) {
    const listing = await this.prisma.truckListing.findUniqueOrThrow({
      where: { id: listingId },
    });

    if (user.role === UserRole.ADMIN) return;

    const fleetOwner = await this.ownership.resolveFleetOwnerScope(user);
    if (!fleetOwner || listing.fleetOwnerId !== fleetOwner.id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message_en: 'You do not have access to this listing.',
        message_ar: 'ليس لديك صلاحية الوصول إلى هذا الإعلان.',
      });
    }
  }
}
