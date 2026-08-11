import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../database/prisma.service';

import { LogisticsAccessService } from './logistics-access.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';

type UploadFile = { buffer: Buffer; mimetype: string; size: number; originalname?: string };

@Injectable()
export class LogisticsConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LogisticsAccessService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationDeliveryService,
  ) {}

  async getOrCreate(
    user: User,
    input: { logisticsOrderId?: string; customsRequestId?: string; freightRequestId?: string; quoteId?: string },
  ) {
    let customerId = user.id;
    if (input.customsRequestId) {
      const req = await this.access.assertCustomsAccess(user, input.customsRequestId);
      customerId = req.customerId;
    }
    if (input.freightRequestId) {
      const req = await this.access.assertFreightAccess(user, input.freightRequestId);
      customerId = req.customerId;
    }
    if (input.logisticsOrderId) {
      const order = await this.access.assertOrderAccess(user, input.logisticsOrderId);
      customerId = order.customerId;
    }

    let conversation = await this.prisma.logisticsConversation.findFirst({
      where: {
        customerId,
        logisticsOrderId: input.logisticsOrderId ?? undefined,
        customsRequestId: input.customsRequestId ?? undefined,
        freightRequestId: input.freightRequestId ?? undefined,
        quoteId: input.quoteId ?? undefined,
      },
    });

    if (!conversation) {
      conversation = await this.prisma.logisticsConversation.create({
        data: {
          customerId,
          logisticsOrderId: input.logisticsOrderId,
          customsRequestId: input.customsRequestId,
          freightRequestId: input.freightRequestId,
          quoteId: input.quoteId,
          lastMessageAt: new Date(),
        },
      });
    }

    return conversation;
  }

  async listMessages(user: User, conversationId: string) {
    await this.assertAccess(user, conversationId);
    const messages = await this.prisma.logisticsMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { sender: { select: { id: true, email: true, role: true } } },
    });

    if (user.role === UserRole.CUSTOMER) {
      await this.prisma.logisticsMessage.updateMany({
        where: { conversationId, readAt: null, senderId: { not: user.id } },
        data: { readAt: new Date() },
      });
    }

    return messages;
  }

  async sendMessage(user: User, conversationId: string, body: string, file?: UploadFile) {
    await this.assertAccess(user, conversationId);

    let attachmentKey: string | undefined;
    let attachmentOriginalName: string | undefined;
    let attachmentMimeType: string | undefined;

    if (file) {
      const detected = this.storage.validateAndDetect(
        { buffer: file.buffer, mimetype: file.mimetype, size: file.size, originalName: file.originalname },
        { maxBytes: 8 * 1024 * 1024, allowedKinds: ['application/pdf', 'image/jpeg', 'image/png'] },
      );
      const stored = await this.storage.store(
        `logistics/conversations/${conversationId}/attachments`,
        { buffer: file.buffer, mimetype: detected, size: file.size, originalName: file.originalname },
        { visibility: 'private', allowedKinds: ['application/pdf', 'image/jpeg', 'image/png'] },
      );
      attachmentKey = stored.key;
      attachmentOriginalName = file.originalname;
      attachmentMimeType = stored.mimeType;
    }

    const message = await this.prisma.logisticsMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        body: body || (file ? '(attachment)' : ''),
        attachmentKey,
        attachmentOriginalName,
        attachmentMimeType,
      },
      include: { sender: { select: { id: true, email: true, role: true } } },
    });

    await this.prisma.logisticsConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    const conversation = await this.prisma.logisticsConversation.findUnique({
      where: { id: conversationId },
      include: {
        logisticsOrder: { select: { referenceNumber: true } },
        customsRequest: { select: { referenceNumber: true } },
        freightRequest: { select: { referenceNumber: true } },
      },
    });

    if (conversation && user.id !== conversation.customerId) {
      const ref =
        conversation.logisticsOrder?.referenceNumber ??
        conversation.customsRequest?.referenceNumber ??
        conversation.freightRequest?.referenceNumber ??
        'TL';
      void this.notifications.safeNotifyLogisticsMessage({
        conversationId,
        recipientUserId: conversation.customerId,
        senderUserId: user.id,
        orderReference: ref,
        conversationPath: `/${user.locale ?? 'ar'}/logistics/conversations/${conversationId}`,
      });
    }

    return message;
  }

  async downloadAttachment(user: User, messageId: string) {
    const message = await this.prisma.logisticsMessage.findUnique({ where: { id: messageId } });
    if (!message?.attachmentKey) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Attachment not found.', message_ar: 'المرفق غير موجود.' });
    }

    await this.assertAccess(user, message.conversationId);
    const file = await this.storage.read(message.attachmentKey);
    return {
      buffer: file.buffer,
      mimeType: message.attachmentMimeType ?? file.mimeType,
      filename: message.attachmentOriginalName ?? 'attachment',
    };
  }

  private async assertAccess(user: User, conversationId: string) {
    const conversation = await this.prisma.logisticsConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Conversation not found.', message_ar: 'المحادثة غير موجودة.' });
    }
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.CUSTOMER && conversation.customerId === user.id) return;
    throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
  }
}
