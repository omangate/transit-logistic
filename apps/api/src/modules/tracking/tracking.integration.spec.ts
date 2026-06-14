import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ShipmentStatus } from '@prisma/client';
import type { User } from '@prisma/client';

import type { PrismaService } from '../../database/prisma.service';
import type { ShipmentAccessService } from '../shipments/shipment-access.service';

import type { TrackingCacheService } from './tracking-cache.service';
import type { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';

describe('TrackingService integration', () => {
  const driver: User = {
    id: 'driver-1',
    email: 'driver@example.com',
    phone: null,
    passwordHash: 'hash',
    role: 'driver',
    locale: 'en',
    isActive: true,
    isVerified: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const shipmentId = '11111111-1111-1111-1111-111111111111';
  const stopId = '22222222-2222-2222-2222-222222222222';

  const access = {
    assertCanView: jest.fn(),
  };

  const cache = {
    setLivePosition: jest.fn(),
    getLivePosition: jest.fn(),
  };

  const gateway = {
    publishPosition: jest.fn(),
  };

  const config = {
    get: jest.fn().mockReturnValue(500),
  };

  const tx = {
    trackingPoint: {
      create: jest.fn(),
    },
    shipmentStop: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    geofenceEvent: {
      create: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    trackingPoint: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    geofenceEvent: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  let service: TrackingService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new TrackingService(
      prisma as unknown as PrismaService,
      access as unknown as ShipmentAccessService,
      config as unknown as ConfigService,
      cache as unknown as TrackingCacheService,
      gateway as unknown as TrackingGateway,
    );

    access.assertCanView.mockResolvedValue({
      id: shipmentId,
      driverId: driver.id,
      status: ShipmentStatus.in_transit,
    });

    tx.trackingPoint.create.mockResolvedValue({
      id: BigInt(1),
      shipmentId,
      latitude: '24.7136000',
      longitude: '46.6753000',
      speed: '30.00',
      heading: null,
      recordedAt: new Date('2026-06-07T10:00:00.000Z'),
      createdAt: new Date('2026-06-07T10:00:00.000Z'),
    });

    tx.shipmentStop.findMany.mockResolvedValue([
      {
        id: stopId,
        shipmentId,
        sequence: 1,
        address: 'Pickup',
        city: 'Riyadh',
        latitude: '24.7136000',
        longitude: '46.6753000',
        stopType: 'pickup',
        arrivedAt: null,
        createdAt: new Date(),
      },
    ]);
  });

  it('records a point, updates stop arrival, caches position, and publishes live update', async () => {
    const result = await service.recordPoint(driver, shipmentId, {
      latitude: 24.7136,
      longitude: 46.6753,
      speed: 30,
    });

    expect(tx.trackingPoint.create).toHaveBeenCalled();
    expect(tx.shipmentStop.update).toHaveBeenCalledWith({
      where: { id: stopId },
      data: { arrivedAt: expect.any(Date) },
    });
    expect(tx.geofenceEvent.create).toHaveBeenCalledWith({
      data: {
        shipmentId,
        eventType: 'arrived_pickup',
        latitude: 24.7136,
        longitude: 46.6753,
      },
    });
    expect(cache.setLivePosition).toHaveBeenCalledWith(shipmentId, result);
    expect(gateway.publishPosition).toHaveBeenCalledWith(shipmentId, result);
    expect(result.shipmentId).toBe(shipmentId);
  });

  it('serves live position from Redis cache before hitting the database', async () => {
    const cached = {
      id: '9',
      shipmentId,
      latitude: '24.7000000',
      longitude: '46.6000000',
      speed: null,
      heading: null,
      recordedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    cache.getLivePosition.mockResolvedValue(cached);

    const result = await service.getLivePosition(driver, shipmentId);

    expect(result).toEqual(cached);
    expect(prisma.trackingPoint.findFirst).not.toHaveBeenCalled();
  });

  it('does not duplicate arrivedAt updates for stops already marked arrived', async () => {
    tx.shipmentStop.findMany.mockResolvedValue([
      {
        id: stopId,
        shipmentId,
        sequence: 1,
        address: 'Pickup',
        city: 'Riyadh',
        latitude: '24.7136000',
        longitude: '46.6753000',
        stopType: 'pickup',
        arrivedAt: new Date('2026-06-07T09:00:00.000Z'),
        createdAt: new Date(),
      },
    ]);

    await service.recordPoint(driver, shipmentId, {
      latitude: 24.7136,
      longitude: 46.6753,
    });

    expect(tx.shipmentStop.update).not.toHaveBeenCalled();
    expect(tx.geofenceEvent.create).not.toHaveBeenCalled();
  });

  it('rejects tracking when shipment is not in an active status', async () => {
    access.assertCanView.mockResolvedValue({
      id: shipmentId,
      driverId: driver.id,
      status: ShipmentStatus.delivered,
    });

    await expect(
      service.recordPoint(driver, shipmentId, {
        latitude: 24.7136,
        longitude: 46.6753,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
