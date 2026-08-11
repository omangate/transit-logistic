/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ShipmentStatus, UserRole, WalletTransactionType } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import {
  documentRejectedEmail,
  passwordResetEmail,
  paymentEmail,
  resolveWebAppUrl,
} from '../email/email-templates';
import { TransactionalEmailService } from '../email/transactional-email.service';
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
    private readonly transactionalEmail: TransactionalEmailService,
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

  async safeNotifyPasswordReset(input: {
    userId: string;
    email: string;
    resetUrl: string;
    locale: 'en' | 'ar';
  }) {
    try {
      const subject =
        input.locale === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset your password';
      const html = passwordResetEmail({ locale: input.locale, resetUrl: input.resetUrl });

      void this.transactionalEmail.sendTransactional({
        userId: input.userId,
        to: input.email,
        locale: input.locale,
        event: 'auth.password_reset',
        eventKey: `password-reset:${input.userId}:${Date.now()}`,
        subject,
        html,
        force: true,
      });

      await this.notifications.createInApp({
        userId: input.userId,
        titleEn: 'Password reset requested',
        titleAr: 'طلب إعادة تعيين كلمة المرور',
        bodyEn: 'If you did not request this, ignore this message.',
        bodyAr: 'إذا لم تطلب ذلك، تجاهل هذه الرسالة.',
        data: { type: 'password_reset' },
      });
      return { delivered: true };
    } catch (error) {
      this.logger.warn(`Password reset notification failed: ${String(error)}`);
      return { delivered: false };
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
    const result = await this.deliverToUsers(
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

    void this.safeNotifyPaymentEvent({
      userId: input.userId,
      kind: 'received',
      reference: input.referenceNumber,
      amount: input.amount,
      currency: input.currency,
      eventKey: `payment:${input.referenceNumber}:received`,
    });

    return result;
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
    if (status === ShipmentStatus.ASSIGNED) {
      return 'assignment' as const;
    }

    if (status === ShipmentStatus.DELIVERED || status === ShipmentStatus.COMPLETED) {
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

    if (context.toStatus === ShipmentStatus.PENDING_ASSIGNMENT) {
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

  async safeNotifyUploadCompleted(userId: string, listingId: string, kind: 'images' | 'video') {
    try {
      await this.notifications.createInApp({
        userId,
        titleEn: kind === 'video' ? 'Video uploaded' : 'Photos uploaded',
        titleAr: kind === 'video' ? 'تم رفع الفيديو' : 'تم رفع الصور',
        bodyEn: 'Your listing media was uploaded successfully.',
        bodyAr: 'تم رفع وسائط الإعلان بنجاح.',
        data: { type: NOTIFICATION_TYPES.UPLOAD_COMPLETED, listingId, kind },
      });
    } catch (error) {
      this.logger.warn(`Upload notification failed: ${String(error)}`);
    }
  }

  async safeNotifyDocumentUploaded(userId: string, documentId: string, category?: string) {
    try {
      await this.notifications.createInApp({
        userId,
        titleEn: 'Document uploaded',
        titleAr: 'تم رفع المستند',
        bodyEn: category ? `${category} uploaded and pending review.` : 'Your document is pending review.',
        bodyAr: 'مستندك قيد المراجعة.',
        data: { type: NOTIFICATION_TYPES.UPLOAD_COMPLETED, documentId, category },
      });
    } catch (error) {
      this.logger.warn(`Document upload notification failed: ${String(error)}`);
    }
  }

  async safeNotifyDocumentReviewed(userId: string, documentId: string, status: string, reviewNote?: string) {
    try {
      await this.notifications.createInApp({
        userId,
        titleEn: `Document ${status}`,
        titleAr: status === 'approved' ? 'تم اعتماد المستند' : 'تم رفض المستند',
        bodyEn: reviewNote ?? `Your document was ${status}.`,
        bodyAr: reviewNote ?? (status === 'approved' ? 'تم اعتماد مستندك.' : 'تم رفض مستندك.'),
        data: { type: NOTIFICATION_TYPES.DOCUMENT_REVIEWED, documentId, status, reviewNote },
      });

      if (status !== 'rejected') return;

      const doc = await this.prisma.logisticsDocument.findUnique({
        where: { id: documentId },
        include: {
          customsRequest: { select: { id: true, referenceNumber: true } },
          freightRequest: { select: { id: true, referenceNumber: true } },
        },
      });
      if (!doc) return;

      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, locale: true } });
      if (!user) return;

      const locale = (user.locale as 'en' | 'ar') ?? 'ar';
      const reference = doc.customsRequest?.referenceNumber ?? doc.freightRequest?.referenceNumber ?? documentId;
      const path = doc.customsRequestId
        ? `/${locale}/logistics/customs/${doc.customsRequestId}`
        : doc.freightRequestId
          ? `/${locale}/logistics/freight/${doc.freightRequestId}`
          : `/${locale}/logistics`;

      const html = documentRejectedEmail({
        locale,
        documentName: doc.category.replace(/_/g, ' '),
        reference,
        reason: reviewNote,
        uploadUrl: resolveWebAppUrl(path),
      });

      void this.transactionalEmail.sendTransactional({
        userId,
        to: user.email,
        locale,
        event: 'document.rejected',
        eventKey: `document:${documentId}:rejected`,
        entityType: 'logistics_document',
        entityId: documentId,
        subject: locale === 'ar' ? 'تم رفض المستند' : 'Document rejected',
        html,
        force: true,
      });
    } catch (error) {
      this.logger.warn(`Document review notification failed: ${String(error)}`);
    }
  }

  async safeNotifyDocumentMissing(input: {
    userId: string;
    documentName: string;
    reference: string;
    entityType: string;
    entityId: string;
    dueDate?: Date;
    uploadPath: string;
  }) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, locale: true } });
      if (!user) return;

      const locale = (user.locale as 'en' | 'ar') ?? 'ar';
      const { documentRequestEmail } = await import('../email/email-templates');
      const html = documentRequestEmail({
        locale,
        documentName: input.documentName,
        reference: input.reference,
        dueDate: input.dueDate,
        uploadUrl: resolveWebAppUrl(input.uploadPath),
      });

      void this.transactionalEmail.sendTransactional({
        userId: input.userId,
        to: user.email,
        locale,
        event: 'document.missing',
        eventKey: `document-missing:${input.entityType}:${input.entityId}:${input.documentName}`,
        entityType: input.entityType,
        entityId: input.entityId,
        subject: locale === 'ar' ? 'مستند مطلوب' : 'Document required',
        html,
        force: true,
      });
    } catch (error) {
      this.logger.warn(`Document missing notification failed: ${String(error)}`);
    }
  }

  async safeNotifyCustomsStatusChanged(userId: string, requestId: string, status: string) {
    try {
      await this.notifications.createInApp({
        userId,
        titleEn: 'Customs status updated',
        titleAr: 'تحديث حالة التخليص الجمركي',
        bodyEn: `Your customs request status is now: ${status.replace(/_/g, ' ')}.`,
        bodyAr: `حالة طلب التخليص الجمركي: ${status.replace(/_/g, ' ')}.`,
        data: { type: NOTIFICATION_TYPES.CUSTOMS_STATUS, requestId, status },
      });

      const request = await this.prisma.customsClearanceRequest.findUnique({
        where: { id: requestId },
        include: {
          logisticsOrder: { select: { referenceNumber: true } },
          customer: { select: { locale: true } },
        },
      });
      if (!request) return;

      const locale = (request.customer.locale as 'en' | 'ar') ?? 'ar';
      void this.transactionalEmail.sendWorkflowStatusEmail({
        userId,
        domain: 'customs',
        status,
        entityType: 'customs_clearance',
        entityId: requestId,
        eventKey: `customs:${requestId}:${status}`,
        locale,
        path: `/${locale}/logistics/customs/${requestId}`,
        context: {
          orderReference: request.referenceNumber,
          customerReference: request.customerReference ?? undefined,
          status: status.replace(/_/g, ' '),
          occurredAt: new Date(),
        },
      });

      if (status === 'submitted') {
        void this.safeNotifyAdminsOperational({
          event: 'admin.new_customs_request',
          titleEn: 'New customs request',
          titleAr: 'طلب تخليص جمركي جديد',
          bodyEn: `Request ${request.referenceNumber} was submitted.`,
          bodyAr: `تم إرسال الطلب ${request.referenceNumber}.`,
          path: `/admin/logistics/customs/${requestId}`,
        });
      }
    } catch (error) {
      this.logger.warn(`Customs status notification failed: ${String(error)}`);
    }
  }

  async safeNotifyCustomsCreated(userId: string, requestId: string, referenceNumber: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
      const locale = (user?.locale as 'en' | 'ar') ?? 'ar';
      void this.transactionalEmail.sendWorkflowStatusEmail({
        userId,
        domain: 'customs',
        status: 'draft',
        entityType: 'customs_clearance',
        entityId: requestId,
        eventKey: `customs:${requestId}:created`,
        locale,
        path: `/${locale}/logistics/customs/${requestId}`,
        context: { orderReference: referenceNumber, occurredAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(`Customs created notification failed: ${String(error)}`);
    }
  }

  async safeNotifyFreightStatusChanged(userId: string, requestId: string, status: string) {
    try {
      await this.notifications.createInApp({
        userId,
        titleEn: 'Freight status updated',
        titleAr: 'تحديث حالة الشحن',
        bodyEn: `Your freight request status is now: ${status.replace(/_/g, ' ')}.`,
        bodyAr: `حالة طلب الشحن: ${status.replace(/_/g, ' ')}.`,
        data: { type: NOTIFICATION_TYPES.FREIGHT_STATUS, requestId, status },
      });

      const request = await this.prisma.freightForwardingRequest.findUnique({
        where: { id: requestId },
        include: {
          logisticsOrder: { select: { referenceNumber: true } },
          customer: { select: { locale: true } },
        },
      });
      if (!request) return;

      const locale = (request.customer.locale as 'en' | 'ar') ?? 'ar';
      void this.transactionalEmail.sendWorkflowStatusEmail({
        userId,
        domain: 'freight',
        status,
        entityType: 'freight_request',
        entityId: requestId,
        eventKey: `freight:${requestId}:${status}`,
        locale,
        path: `/${locale}/logistics/freight/${requestId}`,
        context: {
          orderReference: request.referenceNumber,
          status: status.replace(/_/g, ' '),
          occurredAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Freight status notification failed: ${String(error)}`);
    }
  }

  async safeNotifyFreightCreated(userId: string, requestId: string, referenceNumber: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
      const locale = (user?.locale as 'en' | 'ar') ?? 'ar';
      void this.transactionalEmail.sendWorkflowStatusEmail({
        userId,
        domain: 'freight',
        status: 'draft',
        entityType: 'freight_request',
        entityId: requestId,
        eventKey: `freight:${requestId}:created`,
        locale,
        path: `/${locale}/logistics/freight/${requestId}`,
        context: { orderReference: referenceNumber, occurredAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(`Freight created notification failed: ${String(error)}`);
    }
  }

  async safeNotifyLogisticsQuoteIssued(userId: string, quoteId: string) {
    try {
      await this.notifications.createInApp({
        userId,
        titleEn: 'New logistics quotation',
        titleAr: 'عرض سعر لوجستي جديد',
        bodyEn: 'A quotation is ready for your review.',
        bodyAr: 'عرض السعر جاهز للمراجعة.',
        data: { type: NOTIFICATION_TYPES.LOGISTICS_QUOTE, quoteId },
      });

      await this.sendLogisticsQuoteEmail(userId, quoteId, 'issued');
    } catch (error) {
      this.logger.warn(`Logistics quote notification failed: ${String(error)}`);
    }
  }

  async safeNotifyLogisticsQuoteAmended(userId: string, quoteId: string, previousQuoteId: string) {
    try {
      await this.notifications.createInApp({
        userId,
        titleEn: 'Quotation amended',
        titleAr: 'تم تعديل عرض السعر',
        bodyEn: 'An updated quotation is ready for your review.',
        bodyAr: 'عرض سعر محدّث جاهز للمراجعة.',
        data: { type: NOTIFICATION_TYPES.LOGISTICS_QUOTE, quoteId, previousQuoteId, amended: true },
      });

      await this.sendLogisticsQuoteEmail(userId, quoteId, 'amended', previousQuoteId);
    } catch (error) {
      this.logger.warn(`Logistics quote amended notification failed: ${String(error)}`);
    }
  }

  private async sendLogisticsQuoteEmail(
    userId: string,
    quoteId: string,
    kind: 'issued' | 'amended',
    previousQuoteId?: string,
  ) {
    const quote = await this.prisma.logisticsQuote.findUnique({
      where: { id: quoteId },
      include: {
        customsRequest: { select: { referenceNumber: true, id: true } },
        freightRequest: { select: { referenceNumber: true, id: true } },
        logisticsOrder: { select: { referenceNumber: true } },
      },
    });
    if (!quote) return;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
    const locale = (user?.locale as 'en' | 'ar') ?? 'ar';
    const ref =
      quote.logisticsOrder?.referenceNumber ??
      quote.customsRequest?.referenceNumber ??
      quote.freightRequest?.referenceNumber ??
      quoteId;

    const isCustoms = Boolean(quote.customsRequestId);
    const event =
      kind === 'amended'
        ? isCustoms
          ? 'customs.quote_amended'
          : 'freight.quote_amended'
        : isCustoms
          ? 'customs.quote_issued'
          : 'freight.quote_issued';

    void this.transactionalEmail.sendMilestone({
      userId,
      event,
      eventKey: `quote:${quoteId}:${kind}:v${quote.version}${previousQuoteId ? `:${previousQuoteId}` : ''}`,
      entityType: 'logistics_quote',
      entityId: quoteId,
      locale,
      context: {
        orderReference: ref,
        service: isCustoms ? (locale === 'ar' ? 'التخليص الجمركي' : 'Customs Clearance') : locale === 'ar' ? 'الشحن الدولي' : 'Freight Forwarding',
        status: kind === 'amended' ? (locale === 'ar' ? 'عرض معدّل' : 'Amended quote') : locale === 'ar' ? 'عرض سعر' : 'Quotation sent',
        explanation:
          kind === 'amended'
            ? locale === 'ar'
              ? 'تم تعديل عرض السعر. يرجى مراجعة النسخة المحدّثة.'
              : 'Your quotation has been amended. Please review the updated version.'
            : locale === 'ar'
              ? 'عرض السعر جاهز للمراجعة.'
              : 'Your quotation is ready for review.',
        nextAction:
          locale === 'ar' ? 'راجع واقبل عرض السعر.' : 'Review and accept the quotation.',
        occurredAt: new Date(),
      },
      actionUrl: resolveWebAppUrl(
        quote.customsRequestId
          ? `/${locale}/customs/requests/${quote.customsRequestId}`
          : quote.freightRequestId
            ? `/${locale}/freight/shipments/${quote.freightRequestId}`
            : quote.logisticsOrderId
              ? `/${locale}/logistics/orders/${quote.logisticsOrderId}`
              : `/${locale}/logistics`,
      ),
    });
  }

  async safeNotifyDriverJob(input: {
    driverUserId: string;
    shipmentId: string;
    referenceNumber: string;
    event: 'assigned' | 'changed' | 'cancelled' | 'pickup_instructions' | 'delivery_instructions';
    instructions?: string;
    statusLabel?: string;
  }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: input.driverUserId },
        select: { email: true, locale: true },
      });
      if (!user) return;

      const locale = (user.locale as 'en' | 'ar') ?? 'ar';
      const { driverJobEmail } = await import('../email/email-templates');

      const titles: Record<typeof input.event, { en: string; ar: string }> = {
        assigned: { en: 'New job assigned', ar: 'مهمة جديدة' },
        changed: { en: 'Job updated', ar: 'تحديث المهمة' },
        cancelled: { en: 'Job cancelled', ar: 'تم إلغاء المهمة' },
        pickup_instructions: { en: 'Pickup instructions', ar: 'تعليمات الاستلام' },
        delivery_instructions: { en: 'Delivery instructions', ar: 'تعليمات التسليم' },
      };

      const html = driverJobEmail({
        locale,
        title: titles[input.event][locale === 'ar' ? 'ar' : 'en'],
        reference: input.referenceNumber,
        instructions: input.instructions,
        statusLabel: input.statusLabel,
        actionUrl: resolveWebAppUrl(`/${locale}/driver/dashboard`),
      });

      void this.transactionalEmail.sendTransactional({
        userId: input.driverUserId,
        to: user.email,
        locale,
        event: `driver.job_${input.event}`,
        eventKey: `driver:${input.shipmentId}:${input.event}:${input.statusLabel ?? 'default'}`,
        entityType: 'shipment',
        entityId: input.shipmentId,
        subject: `${titles[input.event][locale === 'ar' ? 'ar' : 'en']} — ${input.referenceNumber}`,
        html,
        force: input.event === 'cancelled',
      });
    } catch (error) {
      this.logger.warn(`Driver job notification failed: ${String(error)}`);
    }
  }

  async safeNotifyBookingEvent(input: {
    customerId: string;
    fleetOwnerId: string;
    bookingId: string;
    event: 'created' | 'confirmed' | 'cancelled';
    reference?: string;
  }) {
    try {
      const booking = await this.prisma.truckBooking.findUnique({
        where: { id: input.bookingId },
        include: {
          truckListing: { select: { name: true } },
          customer: { select: { locale: true, email: true } },
          fleetOwner: { select: { userId: true, user: { select: { locale: true } } } },
        },
      });
      if (!booking) return;

      const ref = input.reference ?? booking.truckListing.name;
      const customerLocale = (booking.customer.locale as 'en' | 'ar') ?? 'ar';
      const fleetUserId = booking.fleetOwner.userId;

      const events: Record<typeof input.event, { customer: string; fleet: string; critical?: boolean }> = {
        created: { customer: 'booking.created', fleet: 'booking.new_request' },
        confirmed: { customer: 'booking.confirmed', fleet: 'booking.confirmed' },
        cancelled: { customer: 'booking.cancelled', fleet: 'booking.cancelled', critical: true },
      };

      const map = events[input.event];
      const notifyUser = async (userId: string, emailEvent: string, locale: 'en' | 'ar') => {
        void this.transactionalEmail.sendMilestone({
          userId,
          event: emailEvent,
          eventKey: `booking:${input.bookingId}:${input.event}:${userId}`,
          entityType: 'truck_booking',
          entityId: input.bookingId,
          locale,
          context: {
            orderReference: ref,
            service: locale === 'ar' ? 'حجز شاحنة' : 'Truck booking',
            status: input.event,
            occurredAt: new Date(),
          },
          actionUrl: resolveWebAppUrl(`/${locale}/bookings/${input.bookingId}`),
          force: map.critical,
        });
      };

      await notifyUser(input.customerId, map.customer, customerLocale);
      const fleetLocale = (booking.fleetOwner.user.locale as 'en' | 'ar') ?? 'ar';
      await notifyUser(fleetUserId, map.fleet, fleetLocale);
    } catch (error) {
      this.logger.warn(`Booking notification failed: ${String(error)}`);
    }
  }

  async safeNotifyMarketplaceQuote(input: {
    quoteId: string;
    customerId: string;
    fleetOwnerUserId: string;
    event: 'created' | 'fleet_responded' | 'countered' | 'accepted' | 'declined' | 'cancelled';
    listingName: string;
  }) {
    try {
      const [customer, fleet] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: input.customerId }, select: { locale: true } }),
        this.prisma.user.findUnique({ where: { id: input.fleetOwnerUserId }, select: { locale: true } }),
      ]);

      const customerLocale = (customer?.locale as 'en' | 'ar') ?? 'ar';
      const fleetLocale = (fleet?.locale as 'en' | 'ar') ?? 'ar';

      const customerEvents = new Set(['fleet_responded', 'countered', 'accepted']);
      const fleetEvents = new Set(['created', 'accepted', 'cancelled']);

      if (customerEvents.has(input.event)) {
        void this.transactionalEmail.sendMilestone({
          userId: input.customerId,
          event: `marketplace.quote_${input.event}`,
          eventKey: `marketplace:${input.quoteId}:${input.event}:customer`,
          entityType: 'truck_quote',
          entityId: input.quoteId,
          locale: customerLocale,
          context: {
            orderReference: input.listingName,
            service: customerLocale === 'ar' ? 'سوق الشاحنات' : 'Truck marketplace',
            status: input.event,
            occurredAt: new Date(),
          },
          actionUrl: resolveWebAppUrl(`/${customerLocale}/marketplace/quotes/${input.quoteId}`),
        });
      }

      if (fleetEvents.has(input.event)) {
        void this.transactionalEmail.sendMilestone({
          userId: input.fleetOwnerUserId,
          event: `marketplace.quote_${input.event}`,
          eventKey: `marketplace:${input.quoteId}:${input.event}:fleet`,
          entityType: 'truck_quote',
          entityId: input.quoteId,
          locale: fleetLocale,
          context: {
            orderReference: input.listingName,
            service: fleetLocale === 'ar' ? 'سوق الشاحنات' : 'Truck marketplace',
            status: input.event,
            occurredAt: new Date(),
          },
          actionUrl: resolveWebAppUrl(`/${fleetLocale}/fleet/quotes/${input.quoteId}`),
        });
      }
    } catch (error) {
      this.logger.warn(`Marketplace quote notification failed: ${String(error)}`);
    }
  }

  async safeNotifyLogisticsMessage(input: {
    conversationId: string;
    recipientUserId: string;
    senderUserId: string;
    orderReference: string;
    conversationPath: string;
  }) {
    try {
      if (input.recipientUserId === input.senderUserId) return;

      const user = await this.prisma.user.findUnique({
        where: { id: input.recipientUserId },
        select: { locale: true },
      });
      const locale = (user?.locale as 'en' | 'ar') ?? 'ar';

      void this.transactionalEmail.sendMessageEmailThrottled({
        userId: input.recipientUserId,
        conversationKey: input.conversationId,
        orderReference: input.orderReference,
        conversationUrl: resolveWebAppUrl(input.conversationPath),
        locale,
        eventKey: `message:${input.conversationId}:${input.recipientUserId}:${Math.floor(Date.now() / 300_000)}`,
      });
    } catch (error) {
      this.logger.warn(`Logistics message notification failed: ${String(error)}`);
    }
  }

  async safeNotifyMessagingMessage(input: {
    conversationId: string;
    recipientUserId: string;
    senderUserId: string;
    reference: string;
    conversationPath: string;
  }) {
    return this.safeNotifyLogisticsMessage({
      conversationId: input.conversationId,
      recipientUserId: input.recipientUserId,
      senderUserId: input.senderUserId,
      orderReference: input.reference,
      conversationPath: input.conversationPath,
    });
  }

  async safeNotifyPaymentEvent(input: {
    userId: string;
    kind: 'requested' | 'received' | 'failed' | 'refund_initiated' | 'refund_completed' | 'invoice' | 'receipt';
    reference: string;
    amount: string;
    currency: string;
    description?: string;
    actionPath?: string;
    eventKey?: string;
  }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, locale: true },
      });
      if (!user) return;

      const locale = (user.locale as 'en' | 'ar') ?? 'ar';
      const html = paymentEmail({
        locale,
        kind: input.kind,
        reference: input.reference,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        actionUrl: input.actionPath ? resolveWebAppUrl(input.actionPath) : undefined,
      });

      void this.transactionalEmail.sendTransactional({
        userId: input.userId,
        to: user.email,
        locale,
        event: `payment.${input.kind === 'invoice' ? 'invoice_issued' : input.kind === 'receipt' ? 'receipt_issued' : input.kind}`,
        eventKey: input.eventKey ?? `payment:${input.reference}:${input.kind}`,
        entityType: 'payment',
        entityId: input.reference,
        subject:
          locale === 'ar'
            ? `إشعار دفع — ${input.reference}`
            : `Payment notice — ${input.reference}`,
        html,
        force: true,
      });
    } catch (error) {
      this.logger.warn(`Payment email notification failed: ${String(error)}`);
    }
  }

  async safeNotifyAdminsOperational(input: {
    event: string;
    titleEn: string;
    titleAr: string;
    bodyEn: string;
    bodyAr: string;
    path?: string;
  }) {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: 'admin', isActive: true },
        select: { id: true, email: true, locale: true, emailPreferences: true },
      });

      for (const admin of admins) {
        const locale = (admin.locale as 'en' | 'ar') ?? 'ar';
        const { adminOperationalAlertEmail } = await import('../email/email-templates');
        const html = adminOperationalAlertEmail({
          locale,
          title: locale === 'ar' ? input.titleAr : input.titleEn,
          body: locale === 'ar' ? input.bodyAr : input.bodyEn,
          actionUrl: input.path ? resolveWebAppUrl(input.path) : undefined,
        });

        void this.transactionalEmail.sendTransactional({
          userId: admin.id,
          to: admin.email,
          locale,
          event: 'admin.operational_alert',
          eventKey: `${input.event}:${admin.id}:${Date.now()}`,
          subject: locale === 'ar' ? input.titleAr : input.titleEn,
          html,
        });
      }
    } catch (error) {
      this.logger.warn(`Admin operational notification failed: ${String(error)}`);
    }
  }
}
