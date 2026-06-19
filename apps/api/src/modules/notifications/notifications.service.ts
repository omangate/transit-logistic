/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { NotificationChannel } from '@transit-logistic/shared';
import type { User } from '@/types/user';

import { PrismaService } from '../../database/prisma.service';

import type { NotificationQueryDto } from './dto/notification-query.dto';
import type { CreateInAppNotificationInput } from './notification.types';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: User, query: NotificationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      channel: NotificationChannel.IN_APP,
    };

    if (query.unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications.map((notification) => this.toResponse(notification, user.locale)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUnreadCount(user: User) {
    const count = await this.prisma.notification.count({
      where: {
        userId: user.id,
        channel: NotificationChannel.IN_APP,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  async getById(user: User, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
        channel: NotificationChannel.IN_APP,
      },
    });

    if (!notification) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message_en: 'Notification not found.',
        message_ar: 'الإشعار غير موجود.',
      });
    }

    return this.toResponse(notification, user.locale);
  }

  async markAsRead(user: User, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: user.id,
        channel: NotificationChannel.IN_APP,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      const existing = await this.prisma.notification.findFirst({
        where: { id: notificationId, userId: user.id },
      });

      if (!existing) {
        throw new NotFoundException({
          code: 'NOTIFICATION_NOT_FOUND',
          message_en: 'Notification not found.',
          message_ar: 'الإشعار غير موجود.',
        });
      }

      return this.toResponse(existing, user.locale);
    }

    return this.getById(user, notificationId);
  }

  async markManyAsRead(user: User, notificationIds: string[]) {
    const result = await this.prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId: user.id,
        channel: NotificationChannel.IN_APP,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updatedCount: result.count };
  }

  async markAllAsRead(user: User) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId: user.id,
        channel: NotificationChannel.IN_APP,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updatedCount: result.count };
  }

  async createInApp(input: CreateInAppNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        channel: NotificationChannel.IN_APP,
        titleEn: input.titleEn,
        titleAr: input.titleAr,
        bodyEn: input.bodyEn,
        bodyAr: input.bodyAr,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
      },
    });

    return notification;
  }

  async createManyInApp(inputs: CreateInAppNotificationInput[]) {
    if (inputs.length === 0) {
      return { createdCount: 0 };
    }

    const result = await this.prisma.notification.createMany({
      data: inputs.map((input) => ({
        userId: input.userId,
        channel: NotificationChannel.IN_APP,
        titleEn: input.titleEn,
        titleAr: input.titleAr,
        bodyEn: input.bodyEn,
        bodyAr: input.bodyAr,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
      })),
    });

    return { createdCount: result.count };
  }

  private toResponse(
    notification: {
      id: string;
      channel: NotificationChannel;
      titleEn: string;
      titleAr: string;
      bodyEn: string;
      bodyAr: string;
      data: Prisma.JsonValue;
      isRead: boolean;
      readAt: Date | null;
      createdAt: Date;
    },
    locale: string,
  ) {
    const useArabic = locale === 'ar';

    return {
      id: notification.id,
      channel: notification.channel,
      title: useArabic ? notification.titleAr : notification.titleEn,
      body: useArabic ? notification.bodyAr : notification.bodyEn,
      titleEn: notification.titleEn,
      titleAr: notification.titleAr,
      bodyEn: notification.bodyEn,
      bodyAr: notification.bodyAr,
      data: notification.data,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
