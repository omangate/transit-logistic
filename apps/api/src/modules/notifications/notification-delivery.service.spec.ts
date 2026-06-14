import { BadRequestException } from '@nestjs/common';
import { ShipmentStatus, WalletTransactionType } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';

import type { PrismaService } from '../../database/prisma.service';

import { NotificationDeliveryService } from './notification-delivery.service';
import { NOTIFICATION_TYPES } from './notification.types';
import type { NotificationsService } from './notifications.service';

describe('NotificationDeliveryService', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
    },
  };

  const notifications = {
    createManyInApp: jest.fn(),
  };

  let service: NotificationDeliveryService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([]);
    service = new NotificationDeliveryService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      { sendWelcome: jest.fn() } as never,
      { getSection: jest.fn().mockResolvedValue({ email: false }) } as never,
    );
    notifications.createManyInApp.mockResolvedValue({ createdCount: 1 });
  });

  it('delivers shipment status notifications to shipment participants', async () => {
    const result = await service.notifyShipmentStatusChange({
      shipmentId: 'shipment-1',
      referenceNumber: 'TL-001',
      customerId: 'customer-1',
      driverId: 'driver-1',
      fleetOwnerUserId: 'fleet-1',
      fromStatus: ShipmentStatus.pending_assignment,
      toStatus: ShipmentStatus.assigned,
    });

    expect(result.delivered).toBe(1);
    expect(notifications.createManyInApp).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'customer-1' }),
      expect.objectContaining({ userId: 'driver-1' }),
      expect.objectContaining({ userId: 'fleet-1' }),
    ]);
  });

  it('delivers wallet transaction notifications', async () => {
    const result = await service.notifyWalletTransaction({
      userId: 'user-1',
      transactionId: 'tx-1',
      transactionType: WalletTransactionType.adjustment,
      amount: '50.00',
      balanceAfter: '150.00',
      referenceType: 'admin_adjustment',
    });

    expect(result.delivered).toBe(1);
    expect(notifications.createManyInApp).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'user-1',
        data: expect.objectContaining({
          type: NOTIFICATION_TYPES.WALLET_TRANSACTION,
          transactionId: 'tx-1',
        }),
      }),
    ]);
  });

  it('broadcasts admin notifications to active users by role', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'driver-1' }, { id: 'driver-2' }]);
    notifications.createManyInApp.mockResolvedValue({ createdCount: 2 });

    const result = await service.broadcast({
      titleEn: 'Maintenance',
      titleAr: 'صيانة',
      bodyEn: 'Scheduled downtime tonight.',
      bodyAr: 'صيانة مجدولة الليلة.',
      roles: [UserRole.DRIVER],
    });

    expect(result.delivered).toBe(2);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [{ role: { in: [UserRole.DRIVER] } }],
      },
      select: { id: true },
    });
  });

  it('rejects broadcasts without recipients', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await expect(
      service.broadcast({
        titleEn: 'Test',
        titleAr: 'اختبار',
        bodyEn: 'Body',
        bodyAr: 'نص',
        roles: [UserRole.ADMIN],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
