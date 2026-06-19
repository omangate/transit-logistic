import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ShipmentStatus } from '@transit-logistic/shared';

import { Public } from '../../common/decorators/public.decorator';
/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { PrismaService } from '../../database/prisma.service';

import { TrackingCacheService } from './tracking-cache.service';

const LIVE_STATUSES = new Set<ShipmentStatus>([
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ASSIGNED,
]);

@Controller('public/track')
export class PublicTrackingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: TrackingCacheService,
  ) {}

  @Get(':referenceNumber')
  @Public()
  async track(@Param('referenceNumber') referenceNumber: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { referenceNumber },
      include: {
        stops: { orderBy: { sequence: 'asc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        priceCalculation: true,
      },
    });

    if (!shipment || shipment.status === ShipmentStatus.DRAFT) {
      throw new NotFoundException({
        code: 'TRACKING_NOT_FOUND',
        message_en: 'Tracking number not found.',
        message_ar: 'رقم التتبع غير موجود.',
      });
    }

    const pickup = shipment.stops.find((stop) => stop.stopType === 'pickup') ?? shipment.stops[0];
    const delivery =
      shipment.stops.find((stop) => stop.stopType === 'delivery') ?? shipment.stops.at(-1);

    let livePosition: {
      latitude: number;
      longitude: number;
      speed: number | null;
      recordedAt: string;
    } | null = null;

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
      referenceNumber: shipment.referenceNumber,
      status: shipment.status,
      cargoDescription: shipment.cargoDescription,
      scheduledAt: shipment.scheduledAt,
      pickedUpAt: shipment.pickedUpAt,
      deliveredAt: shipment.deliveredAt,
      estimatedDeliveryAt: shipment.scheduledAt,
      pickup: pickup
        ? {
            address: pickup.address,
            city: pickup.city,
            latitude: pickup.latitude,
            longitude: pickup.longitude,
          }
        : null,
      delivery: delivery
        ? {
            address: delivery.address,
            city: delivery.city,
            latitude: delivery.latitude,
            longitude: delivery.longitude,
          }
        : null,
      livePosition,
      timeline: shipment.statusHistory.map((entry) => ({
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        createdAt: entry.createdAt,
        note: entry.note,
      })),
    };
  }
}
