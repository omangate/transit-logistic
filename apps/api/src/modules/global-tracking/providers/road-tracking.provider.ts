import { GlobalTrackingSearchType, ShipmentStatus, TrackingMode } from '@transit-logistic/shared';
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { TrackingCacheService } from '../../tracking/tracking-cache.service';
import type { UnifiedTrackingResult } from '../global-tracking.types';

const LIVE_STATUSES = new Set<ShipmentStatus>([
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ASSIGNED,
]);

@Injectable()
export class RoadTrackingProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: TrackingCacheService,
  ) {}

  async track(input: {
    searchType: GlobalTrackingSearchType;
    searchValue: string;
    requesterUserId?: string;
  }): Promise<UnifiedTrackingResult> {
    const reference = input.searchValue.trim();
    const shipment = await this.prisma.shipment.findUnique({
      where: { referenceNumber: reference },
      include: {
        stops: { orderBy: { sequence: 'asc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        driver: { select: { id: true, email: true } },
        fleetOwner: { select: { id: true, userId: true, companyName: true } },
        vehicle: { select: { plateNumber: true, vehicleType: true } },
      },
    }) ?? (reference.length === 36
      ? await this.prisma.shipment.findUnique({
          where: { id: reference },
          include: {
            stops: { orderBy: { sequence: 'asc' } },
            statusHistory: { orderBy: { createdAt: 'asc' } },
            driver: { select: { id: true, email: true } },
            fleetOwner: { select: { id: true, userId: true, companyName: true } },
            vehicle: { select: { plateNumber: true, vehicleType: true } },
          },
        })
      : null);

    if (!shipment || shipment.status === ShipmentStatus.DRAFT) {
      throw new NotFoundException({
        code: 'TRACKING_NOT_FOUND',
        message_en: 'Road shipment not found for this reference.',
        message_ar: 'لم يتم العثور على شحنة برية لهذا المرجع.',
      });
    }

    if (!input.requesterUserId) {
      throw new NotFoundException({
        code: 'TRACKING_NOT_FOUND',
        message_en: 'Sign in to track road shipments.',
        message_ar: 'سجّل الدخول لتتبع الشحنات البرية.',
      });
    }

    if (
      shipment.customerId !== input.requesterUserId &&
      shipment.driverId !== input.requesterUserId &&
      shipment.fleetOwner?.userId !== input.requesterUserId
    ) {
      const user = await this.prisma.user.findUnique({
        where: { id: input.requesterUserId },
        select: { role: true },
      });
      if (user?.role !== 'admin') {
        throw new NotFoundException({
          code: 'TRACKING_NOT_FOUND',
          message_en: 'Tracking number not found.',
          message_ar: 'رقم التتبع غير موجود.',
        });
      }
    }

    const pickup = shipment.stops.find((stop) => stop.stopType === 'pickup') ?? shipment.stops[0];
    const delivery =
      shipment.stops.find((stop) => stop.stopType === 'delivery') ?? shipment.stops.at(-1);

    let livePosition:
      | {
          latitude: number;
          longitude: number;
          speed?: number | null;
          recordedAt: string;
        }
      | undefined;

    if (LIVE_STATUSES.has(shipment.status)) {
      const cached = await this.cache.getLivePosition(shipment.id);
      if (cached) {
        livePosition = {
          latitude: Number(cached.latitude),
          longitude: Number(cached.longitude),
          speed: cached.speed ? Number(cached.speed) : null,
          recordedAt: cached.recordedAt,
        };
      }
    }

    return {
      mode: TrackingMode.ROAD,
      reference: shipment.referenceNumber,
      searchType: input.searchType,
      providerName: shipment.fleetOwner?.companyName ?? 'Transit Logistic',
      currentStatus: shipment.status.replace(/_/g, ' '),
      lastUpdate: shipment.updatedAt.toISOString(),
      eta: shipment.scheduledAt?.toISOString(),
      dataQuality: livePosition ? 'live' : 'manual',
      entityId: shipment.id,
      entityType: 'shipment',
      origin: pickup
        ? {
            name: pickup.address,
            city: pickup.city,
            latitude: Number(pickup.latitude),
            longitude: Number(pickup.longitude),
          }
        : undefined,
      destination: delivery
        ? {
            name: delivery.address,
            city: delivery.city,
            latitude: Number(delivery.latitude),
            longitude: Number(delivery.longitude),
          }
        : undefined,
      events: shipment.statusHistory.map((entry) => ({
        eventType: entry.toStatus,
        eventDateTime: entry.createdAt.toISOString(),
        description: entry.note ?? entry.toStatus.replace(/_/g, ' '),
        source: 'manual_ops',
      })),
      road: {
        fleetCompany: shipment.fleetOwner?.companyName ?? undefined,
        driverName: shipment.driver?.email ?? undefined,
        truckIdentifier: shipment.vehicle?.plateNumber ?? undefined,
        pickup: pickup
          ? { name: pickup.address, city: pickup.city, latitude: Number(pickup.latitude), longitude: Number(pickup.longitude) }
          : undefined,
        delivery: delivery
          ? { name: delivery.address, city: delivery.city, latitude: Number(delivery.latitude), longitude: Number(delivery.longitude) }
          : undefined,
        livePosition,
      },
    };
  }
}
