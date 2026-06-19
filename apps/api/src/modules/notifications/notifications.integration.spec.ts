import {
  NotificationChannel,
  ShipmentStatus,
  WalletTransactionType,
} from '@transit-logistic/shared';

import type { PrismaService } from '../../database/prisma.service';

import { NotificationDeliveryService } from './notification-delivery.service';
import { NOTIFICATION_TYPES } from './notification.types';
import { NotificationsService } from './notifications.service';

describe('Notifications integration', () => {
  const prisma = {
    $transaction: jest.fn(),
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  let notificationsService: NotificationsService;
  let deliveryService: NotificationDeliveryService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([]);
    notificationsService = new NotificationsService(prisma as unknown as PrismaService);
    deliveryService = new NotificationDeliveryService(
      prisma as unknown as PrismaService,
      notificationsService,
      { sendWelcome: jest.fn() } as never,
      { getSection: jest.fn().mockResolvedValue({ email: false }) } as never,
    );
  });

  it('persists shipment and wallet notifications end-to-end', async () => {
    const stored: Array<Record<string, unknown>> = [];

    prisma.notification.createMany.mockImplementation(async ({ data }) => {
      stored.push(...data);
      return { count: data.length };
    });

    await deliveryService.notifyShipmentStatusChange({
      shipmentId: 'shipment-1',
      referenceNumber: 'TL-100',
      customerId: 'customer-1',
      driverId: 'driver-1',
      fleetOwnerUserId: 'fleet-1',
      fromStatus: ShipmentStatus.ASSIGNED,
      toStatus: ShipmentStatus.PICKED_UP,
    });

    await deliveryService.notifyWalletTransaction({
      userId: 'customer-1',
      transactionId: 'tx-1',
      transactionType: WalletTransactionType.SHIPMENT_PAYMENT,
      amount: '120.00',
      balanceAfter: '380.00',
      referenceType: 'shipment',
      referenceId: 'shipment-1',
    });

    expect(stored).toHaveLength(4);
    expect(stored[0]).toMatchObject({
      userId: 'customer-1',
      channel: NotificationChannel.IN_APP,
    });
    expect(stored[3]).toMatchObject({
      userId: 'customer-1',
      data: expect.objectContaining({
        type: NOTIFICATION_TYPES.WALLET_TRANSACTION,
        transactionId: 'tx-1',
      }),
    });
  });

  it('marks notifications as read and returns unread count', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      phone: null,
      passwordHash: 'hash',
      role: 'customer' as const,
      locale: 'en' as const,
      isActive: true,
      isVerified: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.notification.count.mockResolvedValue(2);
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });

    const unread = await notificationsService.getUnreadCount(user);
    const marked = await notificationsService.markAllAsRead(user);

    expect(unread).toEqual({ unreadCount: 2 });
    expect(marked).toEqual({ updatedCount: 2 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        channel: NotificationChannel.IN_APP,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: expect.any(Date),
      },
    });
  });
});
