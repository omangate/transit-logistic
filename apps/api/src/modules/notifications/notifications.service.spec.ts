import { NotFoundException } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import type { User } from '@prisma/client';

import type { PrismaService } from '../../database/prisma.service';

import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const user: User = {
    id: 'user-1',
    email: 'user@example.com',
    phone: null,
    passwordHash: 'hash',
    role: 'customer',
    locale: 'en',
    isActive: true,
    isVerified: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const notification = {
    id: 'notification-1',
    userId: user.id,
    channel: NotificationChannel.in_app,
    titleEn: 'Shipment update',
    titleAr: 'تحديث الشحنة',
    bodyEn: 'Shipment TL-001 is now assigned.',
    bodyAr: 'أصبحت الشحنة TL-001 معينة.',
    data: { type: 'shipment_status' },
    isRead: false,
    readAt: null,
    createdAt: new Date(),
  };

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
  };

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  it('lists notifications for the current user', async () => {
    prisma.$transaction.mockResolvedValue([[notification], 1]);

    const result = await service.list(user, { page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.title).toBe('Shipment update');
    expect(result.meta.total).toBe(1);
  });

  it('returns unread count', async () => {
    prisma.notification.count.mockResolvedValue(3);

    const result = await service.getUnreadCount(user);

    expect(result).toEqual({ unreadCount: 3 });
  });

  it('marks a notification as read', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    prisma.notification.findFirst.mockResolvedValue({
      ...notification,
      isRead: true,
      readAt: new Date(),
    });

    const result = await service.markAsRead(user, notification.id);

    expect(result.isRead).toBe(true);
  });

  it('throws when notification does not belong to the user', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.getById(user, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates in-app notifications', async () => {
    prisma.notification.create.mockResolvedValue(notification);

    const result = await service.createInApp({
      userId: user.id,
      titleEn: 'Wallet transaction',
      titleAr: 'معاملة المحفظة',
      bodyEn: 'Credit posted.',
      bodyAr: 'تم إضافة رصيد.',
      data: { type: 'wallet_transaction' },
    });

    expect(result.id).toBe(notification.id);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        channel: NotificationChannel.in_app,
      }),
    });
  });
});
