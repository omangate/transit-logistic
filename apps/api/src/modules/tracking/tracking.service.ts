/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShipmentStatus } from '@transit-logistic/shared';
import type { Prisma } from '@prisma/client';
import type { User } from '@/types/user';

import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import { ShipmentAccessService } from '../shipments/shipment-access.service';

import type { RecordTrackingPointDto } from './dto/record-tracking-point.dto';
import type { TrackingQueryDto } from './dto/tracking-query.dto';
import { isWithinRadiusMeters } from './geofence.util';
import { distanceFromRouteSegmentMeters } from './route-deviation.util';
import { TrackingCacheService } from './tracking-cache.service';
import type { LiveTrackingPosition } from './tracking-live.types';
import { TrackingGateway } from './tracking.gateway';

const TRACKABLE_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.ASSIGNED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
];

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ShipmentAccessService,
    private readonly config: ConfigService,
    private readonly cache: TrackingCacheService,
    private readonly gateway: TrackingGateway,
    private readonly notificationDelivery: NotificationDeliveryService,
  ) {}

  async recordPoint(user: User, shipmentId: string, dto: RecordTrackingPointDto) {
    const shipment = await this.access.assertCanView(user, shipmentId);

    if (shipment.driverId !== user.id) {
      throw new BadRequestException({
        code: 'TRACKING_ACCESS_DENIED',
        message_en: 'Only the assigned driver can record tracking points.',
        message_ar: 'يمكن للسائق المعين فقط تسجيل نقاط التتبع.',
      });
    }

    if (!TRACKABLE_STATUSES.includes(shipment.status)) {
      throw new BadRequestException({
        code: 'TRACKING_NOT_ACTIVE',
        message_en: 'Tracking is only available for active shipments.',
        message_ar: 'التتبع متاح فقط للشحنات النشطة.',
      });
    }

    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();

    const point = await this.prisma.$transaction(async (tx) => {
      const created = await tx.trackingPoint.create({
        data: {
          shipmentId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          speed: dto.speed,
          heading: dto.heading,
          recordedAt,
        },
      });

      await this.processGeofenceArrivals(tx, shipmentId, dto.latitude, dto.longitude);
      await this.processRouteDeviation(tx, shipment, dto.latitude, dto.longitude);

      return created;
    });

    const response = this.toLiveTrackingPosition(point);
    await this.cache.setLivePosition(shipmentId, response);
    this.gateway.publishPosition(shipmentId, response);

    return response;
  }

  async getHistory(user: User, shipmentId: string, query: TrackingQueryDto) {
    await this.access.assertCanView(user, shipmentId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [points, total] = await this.prisma.$transaction([
      this.prisma.trackingPoint.findMany({
        where: { shipmentId },
        orderBy: { recordedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.trackingPoint.count({ where: { shipmentId } }),
    ]);

    return {
      data: points.map((point) => this.toLiveTrackingPosition(point)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getLivePosition(user: User, shipmentId: string) {
    await this.access.assertCanView(user, shipmentId);

    const cached = await this.cache.getLivePosition(shipmentId);
    if (cached) {
      return cached;
    }

    const point = await this.prisma.trackingPoint.findFirst({
      where: { shipmentId },
      orderBy: { recordedAt: 'desc' },
    });

    if (!point) {
      return null;
    }

    const response = this.toLiveTrackingPosition(point);
    await this.cache.setLivePosition(shipmentId, response);

    return response;
  }

  async getGeofenceEvents(user: User, shipmentId: string, query: TrackingQueryDto) {
    await this.access.assertCanView(user, shipmentId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [events, total] = await this.prisma.$transaction([
      this.prisma.geofenceEvent.findMany({
        where: { shipmentId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.geofenceEvent.count({ where: { shipmentId } }),
    ]);

    return {
      data: events.map((event) => ({
        id: event.id,
        shipmentId: event.shipmentId,
        eventType: event.eventType,
        latitude: event.latitude.toString(),
        longitude: event.longitude.toString(),
        createdAt: event.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private async processGeofenceArrivals(
    tx: Prisma.TransactionClient,
    shipmentId: string,
    latitude: number,
    longitude: number,
  ) {
    const radiusMeters = this.config.get<number>('tracking.geofenceRadiusMeters', 500);
    const stops = await tx.shipmentStop.findMany({
      where: { shipmentId },
      orderBy: { sequence: 'asc' },
    });

    for (const stop of stops) {
      const stopLat = Number(stop.latitude);
      const stopLon = Number(stop.longitude);

      if (!isWithinRadiusMeters(latitude, longitude, stopLat, stopLon, radiusMeters)) {
        continue;
      }

      if (!stop.arrivedAt) {
        const arrivedAt = new Date();

        await tx.shipmentStop.update({
          where: { id: stop.id },
          data: { arrivedAt },
        });

        await tx.geofenceEvent.create({
          data: {
            shipmentId,
            eventType: `arrived_${stop.stopType}`,
            latitude,
            longitude,
          },
        });
      }
    }
  }

  private async processRouteDeviation(
    tx: Prisma.TransactionClient,
    shipment: {
      id: string;
      referenceNumber: string;
      customerId: string;
      fleetOwnerId: string | null;
      status: ShipmentStatus;
    },
    latitude: number,
    longitude: number,
  ) {
    if (shipment.status !== ShipmentStatus.IN_TRANSIT) {
      return;
    }

    const stops = await tx.shipmentStop.findMany({
      where: { shipmentId: shipment.id },
      orderBy: { sequence: 'asc' },
    });

    const pickup = stops.find((stop) => stop.stopType === 'pickup') ?? stops[0];
    const delivery = stops.find((stop) => stop.stopType === 'delivery') ?? stops.at(-1);

    if (!pickup || !delivery) {
      return;
    }

    const deviationMeters = distanceFromRouteSegmentMeters(
      latitude,
      longitude,
      Number(pickup.latitude),
      Number(pickup.longitude),
      Number(delivery.latitude),
      Number(delivery.longitude),
    );

    const thresholdMeters = this.config.get<number>('tracking.deviationThresholdM', 3000);
    if (deviationMeters < thresholdMeters) {
      return;
    }

    const recent = await tx.geofenceEvent.findFirst({
      where: {
        shipmentId: shipment.id,
        eventType: 'route_deviation',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recent) {
      return;
    }

    await tx.geofenceEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType: 'route_deviation',
        latitude,
        longitude,
      },
    });

    const fleetOwner = shipment.fleetOwnerId
      ? await tx.fleetOwner.findUnique({
          where: { id: shipment.fleetOwnerId },
          select: { userId: true },
        })
      : null;

    void this.notificationDelivery.safeNotifyTrackingAlert({
      shipmentId: shipment.id,
      referenceNumber: shipment.referenceNumber,
      customerId: shipment.customerId,
      fleetOwnerUserId: fleetOwner?.userId ?? null,
      alertType: 'route_deviation',
    });
  }

  private toLiveTrackingPosition(point: {
    id: bigint;
    shipmentId: string;
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
    speed: Prisma.Decimal | null;
    heading: Prisma.Decimal | null;
    recordedAt: Date;
    createdAt: Date;
  }): LiveTrackingPosition {
    return {
      id: point.id.toString(),
      shipmentId: point.shipmentId,
      latitude: point.latitude.toString(),
      longitude: point.longitude.toString(),
      speed: point.speed?.toString() ?? null,
      heading: point.heading?.toString() ?? null,
      recordedAt: point.recordedAt.toISOString(),
      createdAt: point.createdAt.toISOString(),
    };
  }
}
