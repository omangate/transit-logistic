import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';
import type { LogisticsDocumentCategory } from '@prisma/client';

import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';

import { LogisticsAccessService } from './logistics-access.service';

type UploadFile = { buffer: Buffer; mimetype: string; size: number; originalname?: string };

@Injectable()
export class LogisticsDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: LogisticsAccessService,
    private readonly notifications: NotificationDeliveryService,
  ) {}

  async upload(
    user: User,
    file: UploadFile,
    input: {
      category: LogisticsDocumentCategory;
      logisticsOrderId?: string;
      customsRequestId?: string;
      freightRequestId?: string;
      documentNumber?: string;
      issueDate?: string;
      expiresAt?: string;
      aiSuggestedCategory?: LogisticsDocumentCategory;
    },
  ) {
    if (input.customsRequestId) await this.access.assertCustomsAccess(user, input.customsRequestId);
    if (input.freightRequestId) await this.access.assertFreightAccess(user, input.freightRequestId);
    if (input.logisticsOrderId) await this.access.assertOrderAccess(user, input.logisticsOrderId);

    const detected = this.storage.validateAndDetect(
      { buffer: file.buffer, mimetype: file.mimetype, size: file.size, originalName: file.originalname },
      { maxBytes: 12 * 1024 * 1024, allowedKinds: ['application/pdf', 'image/jpeg', 'image/png'] },
    );

    const stored = await this.storage.store(
      `logistics/${input.customsRequestId ?? input.freightRequestId ?? input.logisticsOrderId ?? 'general'}/documents`,
      { buffer: file.buffer, mimetype: detected, size: file.size, originalName: file.originalname },
      { visibility: 'private', allowedKinds: ['application/pdf', 'image/jpeg', 'image/png'] },
    );

    const doc = await this.prisma.logisticsDocument.create({
      data: {
        logisticsOrderId: input.logisticsOrderId,
        customsRequestId: input.customsRequestId,
        freightRequestId: input.freightRequestId,
        category: input.category,
        documentNumber: input.documentNumber,
        issueDate: input.issueDate ? new Date(input.issueDate) : undefined,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        storageKey: stored.key,
        originalName: file.originalname,
        mimeType: stored.mimeType,
        fileUrl: stored.url,
        aiSuggestedCategory: input.aiSuggestedCategory,
        uploadedById: user.id,
        status: 'pending',
      },
    });

    await this.prisma.documentChecklistItem.updateMany({
      where: {
        documentCategory: input.category,
        OR: [
          { customsRequestId: input.customsRequestId ?? undefined },
          { freightRequestId: input.freightRequestId ?? undefined },
          { logisticsOrderId: input.logisticsOrderId ?? undefined },
        ],
      },
      data: { status: 'uploaded', logisticsDocumentId: doc.id },
    });

    if (input.customsRequestId) {
      const req = await this.prisma.customsClearanceRequest.findUnique({ where: { id: input.customsRequestId } });
      if (req) void this.notifications.safeNotifyDocumentUploaded(req.customerId, doc.id, input.category);
    }

    return doc;
  }

  async download(user: User, documentId: string) {
    const doc = await this.prisma.logisticsDocument.findUnique({ where: { id: documentId } });
    if (!doc?.storageKey) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Document not found.', message_ar: 'المستند غير موجود.' });
    }

    if (doc.customsRequestId) await this.access.assertCustomsAccess(user, doc.customsRequestId);
    else if (doc.freightRequestId) await this.access.assertFreightAccess(user, doc.freightRequestId);
    else if (doc.logisticsOrderId) await this.access.assertOrderAccess(user, doc.logisticsOrderId);
    else if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
    }

    const file = await this.storage.read(doc.storageKey);
    return {
      buffer: file.buffer,
      mimeType: doc.mimeType ?? file.mimeType,
      filename: doc.originalName ?? 'document',
    };
  }

  async review(user: User, documentId: string, status: 'approved' | 'rejected' | 'expired', reviewNote?: string) {
    this.access.assertAdmin(user);
    const doc = await this.prisma.logisticsDocument.update({
      where: { id: documentId },
      data: { status, reviewNote },
    });

    await this.prisma.documentChecklistItem.updateMany({
      where: { logisticsDocumentId: documentId },
      data: { status: status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'expired' },
    });

    if (doc.customsRequestId) {
      const req = await this.prisma.customsClearanceRequest.findUnique({ where: { id: doc.customsRequestId } });
      if (req) void this.notifications.safeNotifyDocumentReviewed(req.customerId, documentId, status);
    }

    return doc;
  }

  async listMissing(user: User, customsRequestId?: string, freightRequestId?: string) {
    if (customsRequestId) await this.access.assertCustomsAccess(user, customsRequestId);
    if (freightRequestId) await this.access.assertFreightAccess(user, freightRequestId);

    return this.prisma.documentChecklistItem.findMany({
      where: {
        customsRequestId,
        freightRequestId,
        status: { in: ['required', 'missing'] },
      },
    });
  }
}
