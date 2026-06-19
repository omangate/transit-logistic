import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ShipmentStatus } from '@transit-logistic/shared';
import type { User } from '@/types/user';

import type { PrismaService } from '../../database/prisma.service';
import type { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import type { ShipmentAccessService } from '../shipments/shipment-access.service';

import type { TrackingCacheService } from './tracking-cache.service';
import type { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
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

  const notificationDelivery = {
    safeNotifyTrackingAlert: jest.fn(),
  };

  const prisma = {
    $transaction: jest.fn(),
    trackingPoint: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    geofenceEvent: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const config = {
    get: jest.fn().mockReturnValue(500),
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
      notificationDelivery as unknown as NotificationDeliveryService,
    );
  });

  it('rejects tracking points from non-assigned drivers', async () => {
    access.assertCanView.mockResolvedValue({
      id: 'shipment-1',
      driverId: 'other-driver',
      status: ShipmentStatus.IN_TRANSIT,
    });

    await expect(
      service.recordPoint(driver, 'shipment-1', {
        latitude: 24.7136,
        longitude: 46.6753,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects tracking points when shipment is not active', async () => {
    access.assertCanView.mockResolvedValue({
      id: 'shipment-1',
      driverId: driver.id,
      status: ShipmentStatus.DELIVERED,
    });

    await expect(
      service.recordPoint(driver, 'shipment-1', {
        latitude: 24.7136,
        longitude: 46.6753,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns null when no live tracking point exists', async () => {
    access.assertCanView.mockResolvedValue({ id: 'shipment-1' });
    cache.getLivePosition.mockResolvedValue(null);
    prisma.trackingPoint.findFirst.mockResolvedValue(null);

    const result = await service.getLivePosition(driver, 'shipment-1');

    expect(result).toBeNull();
  });
});
