import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';

import { FleetOwnershipService } from './fleet-ownership.service';

const ALLOWED_TYPES = new Set([
  'vehicle_registration',
  'insurance',
  'company_registration',
  'driver_license',
  'vehicle_inspection',
  'permit',
  'other',
]);

type UploadFile = { buffer: Buffer; mimetype: string; size: number; originalname?: string };

@Injectable()
export class FleetDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ownership: FleetOwnershipService,
    private readonly notifications: NotificationDeliveryService,
  ) {}

  async listForFleet(user: User) {
    const fleetOwner = await this.ownership.requireFleetOwner(user);
    return this.prisma.fleetOwnerDocument.findMany({
      where: { fleetOwnerId: fleetOwner.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(user: User, file: UploadFile, documentType: string, expiresAt?: string) {
    const fleetOwner = await this.ownership.requireFleetOwner(user);
    const type = documentType?.trim() || 'other';
    if (!ALLOWED_TYPES.has(type)) {
      throw new NotFoundException({ code: 'INVALID_TYPE', message_en: 'Invalid document type.', message_ar: 'نوع المستند غير صالح.' });
    }

    const stored = await this.storage.store(
      `fleet/${fleetOwner.id}/documents`,
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
        originalName: file.originalname,
      },
      {
        maxBytes: 12 * 1024 * 1024,
        allowedKinds: ['application/pdf', 'image/jpeg', 'image/png'],
        visibility: 'private',
      },
    );

    const doc = await this.prisma.fleetOwnerDocument.create({
      data: {
        fleetOwnerId: fleetOwner.id,
        documentType: type,
        fileUrl: stored.url,
        storageKey: stored.key,
        originalName: file.originalname,
        mimeType: stored.mimeType,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: 'pending',
      },
    });

    await this.prisma.fleetOwnerDocument.update({
      where: { id: doc.id },
      data: { fileUrl: `/api/v1/fleet/documents/${doc.id}/download` },
    });

    void this.notifications.safeNotifyDocumentUploaded(user.id, doc.id);
    return { ...doc, fileUrl: `/api/v1/fleet/documents/${doc.id}/download` };
  }

  async download(user: User, documentId: string) {
    const doc = await this.prisma.fleetOwnerDocument.findUnique({ where: { id: documentId } });
    if (!doc?.storageKey) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Document not found.', message_ar: 'المستند غير موجود.' });
    }

    if (user.role !== UserRole.ADMIN) {
      const fleetOwner = await this.ownership.resolveFleetOwnerScope(user);
      if (!fleetOwner || fleetOwner.id !== doc.fleetOwnerId) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
      }
    }

    const file = await this.storage.read(doc.storageKey);
    return {
      buffer: file.buffer,
      mimeType: file.mimeType,
      filename: doc.originalName ?? 'document',
    };
  }

  async listPendingForAdmin() {
    return this.prisma.fleetOwnerDocument.findMany({
      where: { status: 'pending' },
      include: { fleetOwner: { select: { companyName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewDocument(
    user: User,
    documentId: string,
    status: 'approved' | 'rejected' | 'expired',
    reviewNote?: string,
  ) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Admin only.', message_ar: 'للمسؤول فقط.' });
    }

    const doc = await this.prisma.fleetOwnerDocument.update({
      where: { id: documentId },
      data: { status, reviewNote, reviewedAt: new Date() },
      include: { fleetOwner: { select: { userId: true } } },
    });

    void this.notifications.safeNotifyDocumentReviewed(doc.fleetOwner.userId, status, reviewNote);
    return doc;
  }
}
