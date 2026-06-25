/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import type { User } from '@/types/user';

import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import type { CreateShipmentRequestDto } from './dto/shipment-request.dto';

const PUBLIC_LISTING_WHERE: Prisma.TruckListingWhereInput = {
  listingStatus: 'approved',
  isListingEnabled: true,
};

@Injectable()
export class ShipmentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: User, dto: CreateShipmentRequestDto) {
    const referenceNumber = `SR-${randomBytes(4).toString('hex').toUpperCase()}`;

    const request = await this.prisma.shipmentRequest.create({
      data: {
        referenceNumber,
        customerId: user.id,
        pickupAddress: dto.pickupAddress,
        pickupGeoRegionId: dto.pickupGeoRegionId,
        pickupLatitude: dto.pickupLatitude,
        pickupLongitude: dto.pickupLongitude,
        deliveryAddress: dto.deliveryAddress,
        deliveryGeoRegionId: dto.deliveryGeoRegionId,
        deliveryLatitude: dto.deliveryLatitude,
        deliveryLongitude: dto.deliveryLongitude,
        cargoType: dto.cargoType ?? 'dry',
        weightKg: dto.weightKg,
        preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : undefined,
        notes: dto.notes,
        requiredVehicleType: dto.requiredVehicleType,
        requiresRefrigerated: dto.requiresRefrigerated ?? false,
        requiresCrossBorder: dto.requiresCrossBorder ?? false,
        requiresContainer: dto.requiresContainer ?? false,
        status: 'open',
      },
    });

    const matches = await this.findMatchingListings(request);
    const matchRecords = await this.prisma.shipmentRequestMatch.createMany({
      data: matches.map((listing) => ({
        shipmentRequestId: request.id,
        fleetOwnerId: listing.fleetOwnerId,
        truckListingId: listing.id,
      })),
      skipDuplicates: true,
    });

    if (matchRecords.count > 0) {
      await this.prisma.shipmentRequest.update({
        where: { id: request.id },
        data: { status: 'matched' },
      });
    }

    await this.notifyFleetOwners(request, matches);

    return {
      ...request,
      status: matchRecords.count > 0 ? 'matched' : request.status,
      matchCount: matchRecords.count,
    };
  }

  listForCustomer(user: User) {
    return this.prisma.shipmentRequest.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        pickupRegion: true,
        deliveryRegion: true,
        matches: { include: { fleetOwner: { select: { companyName: true } } } },
      },
    });
  }

  async listForFleet(user: User) {
    const fleetOwner = await this.prisma.fleetOwner.findUnique({
      where: { userId: user.id },
    });
    if (!fleetOwner) return [];

    return this.prisma.shipmentRequestMatch.findMany({
      where: { fleetOwnerId: fleetOwner.id },
      include: {
        shipmentRequest: {
          include: {
            pickupRegion: true,
            deliveryRegion: true,
            customer: {
              select: { customerProfile: { select: { fullName: true } } },
            },
          },
        },
      },
      orderBy: { notifiedAt: 'desc' },
    });
  }

  private async findMatchingListings(request: {
    id: string;
    pickupGeoRegionId: string | null;
    deliveryGeoRegionId: string | null;
    weightKg: Prisma.Decimal | null;
    requiredVehicleType: string | null;
    requiresRefrigerated: boolean;
    requiresCrossBorder: boolean;
    requiresContainer: boolean;
  }) {
    const regionIds = [request.pickupGeoRegionId, request.deliveryGeoRegionId].filter(
      (id): id is string => Boolean(id),
    );

    const parentIds =
      regionIds.length > 0
        ? await this.prisma.geoRegion.findMany({
            where: { id: { in: regionIds } },
            select: { id: true, parentId: true },
          })
        : [];

    const expandedRegionIds = new Set<string>(regionIds);
    for (const r of parentIds) {
      expandedRegionIds.add(r.id);
      if (r.parentId) expandedRegionIds.add(r.parentId);
    }

    const where: Prisma.TruckListingWhereInput = { ...PUBLIC_LISTING_WHERE };

    if (request.requiredVehicleType) {
      where.vehicleType = request.requiredVehicleType as Prisma.EnumVehicleTypeFilter['equals'];
    }
    if (request.requiresRefrigerated) where.refrigeratedSupport = true;
    if (request.requiresCrossBorder) where.crossBorderSupport = true;
    if (request.requiresContainer) where.containerTransportSupport = true;
    if (request.weightKg) {
      where.OR = [{ capacityKg: null }, { capacityKg: { gte: request.weightKg } }];
    }

    if (expandedRegionIds.size > 0) {
      where.serviceAreas = {
        some: { geoRegionId: { in: [...expandedRegionIds] } },
      };
    }

    return this.prisma.truckListing.findMany({
      where,
      select: { id: true, fleetOwnerId: true, name: true },
    });
  }

  private async notifyFleetOwners(
    request: { id: string; referenceNumber: string; pickupAddress: string; deliveryAddress: string },
    listings: Array<{ fleetOwnerId: string; name: string }>,
  ) {
    const fleetOwnerIds = [...new Set(listings.map((l) => l.fleetOwnerId))];
    if (fleetOwnerIds.length === 0) return;

    const fleetOwners = await this.prisma.fleetOwner.findMany({
      where: { id: { in: fleetOwnerIds } },
      select: { userId: true },
    });

    await this.notifications.createManyInApp(
      fleetOwners.map((fo) => ({
        userId: fo.userId,
        titleEn: 'New shipment request',
        titleAr: 'طلب شحنة جديد',
        bodyEn: `Request ${request.referenceNumber}: ${request.pickupAddress} → ${request.deliveryAddress}`,
        bodyAr: `طلب ${request.referenceNumber}: ${request.pickupAddress} → ${request.deliveryAddress}`,
        data: { shipmentRequestId: request.id, type: 'shipment_request' },
      })),
    );
  }
}
