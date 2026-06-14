/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ShipmentStatus, type UserRole, type WalletTransactionType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';

import type { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import {
  buildNewShipmentAdminNotification,
  buildPaymentSuccessNotification,
  buildRegistrationNotification,
  buildShipmentCreatedNotification,
  buildShipmentStatusNotification,
  buildTrackingAlertNotification,
  buildWalletTransactionNotification,
} from './notification-templates';
import {
  NOTIFICATION_TYPES,
  type CreateInAppNotificationInput,
  type NewShipmentNotificationData,
  type ShipmentStatusNotificationData,
  type WalletTransactionNotificationData,
} from './notification.types';
import { NotificationsService } from './notifications.service';

export interface ShipmentStatusChangeContext {
  shipmentId: string;
  referenceNumber: string;
  customerId: string;
  driverId?: string | null;
  fleetOwnerUserId?: string | null;
  fromStatus: ShipmentStatus | null;
  toStatus: ShipmentStatus;
}

export interface WalletTransactionContext {
  userId: string;
  transactionId: string;
  transactionType: WalletTransactionType;
  amount: string;
  balanceAfter: string;
  referenceType?: string | null;
  referenceId?: string | null;
}

export interface NewShipmentAdminContext {
  shipmentId: string;
  referenceNumber: string;
  customerId: string;
}

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly settings: SettingsService,
  ) {}

  async notifyRegistrationSuccess(input: { userId: string; email: string; name: string; locale: 'en' | 'ar' }) {
    const content = buildRegistrationNotification(input.name);
    return this.deliverToUsers(
      [input.userId],
      content,
      { type: NOTIFICATION_TYPES.REGISTRATION_SUCCESS },
      [{ email: input.email, locale: input.locale, kind: 'welcome' as const, name: input.name }],
    );
  }

  async safeNotifyRegistrationSuccess(input: { userId: string; email: string; name: string; locale: 'en' | 'ar' }) {
    try {
      return await this.notifyRegistrationSuccess(input);
    } catch (error) {
      this.logger.error('Failed registration notification', error instanceof Error ? error.stack : undefined);
      return { delivered: 0 };
    }
  }

  async notifyShipmentCreated(input: { userId: string; email: string; referenceNumber: string; locale: 'en' | 'ar' }) {
    const content = buildShipmentCreatedNotification(input.referenceNumber);
    return this.deliverToUsers(
      [input.userId],
      content,
      { type: NOTIFICATION_TYPES.SHIPMENT_CREATED, referenceNumber: input.referenceNumber },
      [{ email: input.email, locale: input.locale, kind: 'shipment_created' as const, reference: input.referenceNumber }],
    );
  }

  async safeNotifyShipmentCreated(input: { userId: string; email: string; referenceNumber: string; locale: 'en' | 'ar' }) {
    try {
      return await this.notifyShipmentCreated(input);
    } catch (error) {
      this.logger.error('Failed shipment created notification', error instanceof Error ? error.stack : undefined);
      return { delivered: 0 };
    }
  }

  async notifyPaymentSuccess(input: {
    userId: string;
    referenceNumber: string;
    amount: string;
    currency: string;
  }) {
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) {
      return { delivered: 0 };
    }

    const content = buildPaymentSuccessNotification(input.referenceNumber, input.amount, input.currency);
    return this.deliverToUsers(
      [input.userId],
      content,
      {
        type: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
        referenceNumber: input.referenceNumber,
        amount: input.amount,
        currency: input.currency,
      },
      [{
        email: user.email,
        locale: user.locale as 'en' | 'ar',
        kind: 'payment' as const,
        reference: input.referenceNumber,
        amount: input.amount,
        currency: input.currency,
      }],
    );
  }

  async safeNotifyPaymentSuccess(input: {
    userId: string;
    referenceNumber: string;
    amount: string;
    currency: string;
  }) {
    try {
      return await this.notifyPaymentSuccess(input);
    } catch (error) {
      this.logger.error('Failed payment notification', error instanceof Error ? error.stack : undefined);
      return { delivered: 0 };
    }
  }

  async safeNotifyTrackingAlert(input: {
    shipmentId: string;
    referenceNumber: string;
    customerId: string;
    fleetOwnerUserId?: string | null;
    alertType: string;
  }) {
    try {
      const content = buildTrackingAlertNotification(input.referenceNumber, input.alertType);
      const recipients = [input.customerId, input.fleetOwnerUserId].filter(
        (value): value is string => Boolean(value),
      );

      return this.deliverToUsers(recipients, content, {
        type: NOTIFICATION_TYPES.TRACKING_ALERT,
        shipmentId: input.shipmentId,
        referenceNumber: input.referenceNumber,
        alertType: input.alertType,
      });
    } catch (error) {
      this.logger.error('Failed tracking alert notification', error instanceof Error ? error.stack : undefined);
      return { delivered: 0 };
    }
  }

  async notifyShipmentStatusChange(context: ShipmentStatusChangeContext) {
    const recipients = this.resolveShipmentRecipients(context);
    if (recipients.length === 0) {
      return { delivered: 0 };
    }

    const content = buildShipmentStatusNotification(context.referenceNumber, context.toStatus);
    const data: ShipmentStatusNotificationData = {
      type: NOTIFICATION_TYPES.SHIPMENT_STATUS,
      shipmentId: context.shipmentId,
      referenceNumber: context.referenceNumber,
      fromStatus: context.fromStatus,
      toStatus: context.toStatus,
    };

    const users = await this.prisma.user.findMany({
      where: { id: { in: recipients } },
      select: { id: true, email: true, locale: true, role: true },
    });

    const emailJobs = users
      .filter((user) => user.role === 'customer')
      .map((user) => ({
        email: user.email,
        locale: user.locale as 'en' | 'ar',
        kind: this.resolveEmailKindForStatus(context.toStatus),
        reference: context.referenceNumber,
        statusLabel: content.bodyEn.split(' is now ')[1] ?? context.toStatus,
      }));

    return this.deliverToUsers(recipients, content, data, emailJobs);
  }

  async notifyWalletTransaction(context: WalletTransactionContext) {
    const content = buildWalletTransactionNotification(
      context.transactionType,
      context.amount,
      context.balanceAfter,
    );

    const data: WalletTransactionNotificationData = {
      type: NOTIFICATION_TYPES.WALLET_TRANSACTION,
      transactionId: context.transactionId,
      transactionType: context.transactionType,
      amount: context.amount,
      balanceAfter: context.balanceAfter,
      referenceType: context.referenceType,
      referenceId: context.referenceId,
    };

    return this.deliverToUsers([context.userId], content, data);
  }

  async broadcast(dto: BroadcastNotificationDto) {
    const userIds = await this.resolveBroadcastRecipients(dto);

    if (userIds.length === 0) {
      throw new BadRequestException({
        code: 'NO_RECIPIENTS',
        message_en: 'No active recipients matched the broadcast criteria.',
        message_ar: 'لم يتم العثور على مستلمين نشطين يطابقون معايير البث.',
      });
    }

    const broadcastId = randomUUID();
    const inputs: CreateInAppNotificationInput[] = userIds.map((userId) => ({
      userId,
      titleEn: dto.titleEn,
      titleAr: dto.titleAr,
      bodyEn: dto.bodyEn,
      bodyAr: dto.bodyAr,
      data: {
        type: NOTIFICATION_TYPES.ADMIN_BROADCAST,
        broadcastId,
        ...(dto.data ?? {}),
      },
    }));

    const result = await this.notifications.createManyInApp(inputs);
    return { delivered: result.createdCount, broadcastId };
  }

  async safeNotifyShipmentStatusChange(context: ShipmentStatusChangeContext) {
    try {
      return await this.notifyShipmentStatusChange(context);
    } catch (error) {
      this.logger.error(
        `Failed to deliver shipment status notifications for ${context.shipmentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { delivered: 0 };
    }
  }

  async notifyAdminsNewShipment(context: NewShipmentAdminContext) {
    const admins = await this.prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    });

    if (admins.length === 0) {
      return { delivered: 0 };
    }

    const content = buildNewShipmentAdminNotification(context.referenceNumber);
    const data: NewShipmentNotificationData = {
      type: NOTIFICATION_TYPES.NEW_SHIPMENT,
      shipmentId: context.shipmentId,
      referenceNumber: context.referenceNumber,
      customerId: context.customerId,
    };

    return this.deliverToUsers(
      admins.map((admin) => admin.id),
      content,
      data,
    );
  }

  async safeNotifyAdminsNewShipment(context: NewShipmentAdminContext) {
    try {
      return await this.notifyAdminsNewShipment(context);
    } catch (error) {
      this.logger.error(
        `Failed to deliver new shipment notifications for ${context.shipmentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { delivered: 0 };
    }
  }

  async safeNotifyWalletTransaction(context: WalletTransactionContext) {
    try {
      return await this.notifyWalletTransaction(context);
    } catch (error) {
      this.logger.error(
        `Failed to deliver wallet notification for user ${context.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { delivered: 0 };
    }
  }

  private resolveEmailKindForStatus(status: ShipmentStatus) {
    if (status === ShipmentStatus.assigned) {
      return 'assignment' as const;
    }

    if (status === ShipmentStatus.delivered || status === ShipmentStatus.completed) {
      return 'delivery' as const;
    }

    return 'status' as const;
  }

  private resolveShipmentRecipients(context: ShipmentStatusChangeContext): string[] {
    const recipients = new Set<string>([context.customerId]);

    if (context.driverId) {
      recipients.add(context.driverId);
    }

    if (context.fleetOwnerUserId) {
      recipients.add(context.fleetOwnerUserId);
    }

    if (context.toStatus === ShipmentStatus.pending_assignment) {
      return [context.customerId];
    }

    return [...recipients];
  }

  private async resolveBroadcastRecipients(dto: BroadcastNotificationDto): Promise<string[]> {
    const hasRoles = Boolean(dto.roles?.length);
    const hasUserIds = Boolean(dto.userIds?.length);

    if (!hasRoles && !hasUserIds) {
      throw new BadRequestException({
        code: 'INVALID_BROADCAST',
        message_en: 'Either roles or userIds must be provided.',
        message_ar: 'يجب توفير الأدوار أو معرفات المستخدمين.',
      });
    }

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          ...(hasRoles ? [{ role: { in: dto.roles as UserRole[] } }] : []),
          ...(hasUserIds ? [{ id: { in: dto.userIds } }] : []),
        ],
      },
      select: { id: true },
    });

    return users.map((user) => user.id);
  }

  private async deliverToUsers(
    userIds: string[],
    content: { titleEn: string; titleAr: string; bodyEn: string; bodyAr: string },
    data: CreateInAppNotificationInput['data'],
    emailJobs: Array<{
      email: string;
      locale: 'en' | 'ar';
      kind: 'welcome' | 'shipment_created' | 'payment' | 'assignment' | 'status' | 'delivery';
      name?: string;
      reference?: string;
      amount?: string;
      currency?: string;
      statusLabel?: string;
    }> = [],
  ) {
    const uniqueUserIds = [...new Set(userIds)];
    const inputs: CreateInAppNotificationInput[] = uniqueUserIds.map((userId) => ({
      userId,
      ...content,
      data,
    }));

    const result = await this.notifications.createManyInApp(inputs);

    const notificationSettings = await this.settings.getSection('notifications');
    if (notificationSettings.email) {
      for (const job of emailJobs) {
        void this.sendEmailJob(job);
      }
    }

    return { delivered: result.createdCount };
  }

  private async sendEmailJob(job: {
    email: string;
    locale: 'en' | 'ar';
    kind: 'welcome' | 'shipment_created' | 'payment' | 'assignment' | 'status' | 'delivery';
    name?: string;
    reference?: string;
    amount?: string;
    currency?: string;
    statusLabel?: string;
  }) {
    try {
      switch (job.kind) {
        case 'welcome':
          await this.email.sendWelcome({ to: job.email, name: job.name ?? 'Customer', locale: job.locale });
          break;
        case 'shipment_created':
          await this.email.sendShipmentCreated({ to: job.email, reference: job.reference ?? '', locale: job.locale });
          break;
        case 'payment':
          await this.email.sendPaymentConfirmation({
            to: job.email,
            reference: job.reference ?? '',
            amount: job.amount ?? '0',
            currency: job.currency ?? 'OMR',
            locale: job.locale,
          });
          break;
        case 'assignment':
          await this.email.sendAssignment({ to: job.email, reference: job.reference ?? '', locale: job.locale });
          break;
        case 'delivery':
          await this.email.sendDeliveryConfirmation({ to: job.email, reference: job.reference ?? '', locale: job.locale });
          break;
        case 'status':
          await this.email.sendStatusUpdate({
            to: job.email,
            reference: job.reference ?? '',
            statusLabel: job.statusLabel ?? 'updated',
            locale: job.locale,
          });
          break;
        default:
          break;
      }
    } catch (error) {
      this.logger.error(`Email delivery failed for ${job.email}`, error instanceof Error ? error.stack : undefined);
    }
  }
}
