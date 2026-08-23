import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@/types/user';

/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../database/prisma.service';
import { ShipmentAccessService } from '../shipments/shipment-access.service';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type UploadedFile = {
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ShipmentAccessService,
    private readonly storage: StorageService,
  ) {}

  async uploadShipmentDocument(
    user: User,
    shipmentId: string,
    documentType: string,
    file: UploadedFile,
  ) {
    await this.access.assertCanView(user, shipmentId);

    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message_en: 'A file is required.',
        message_ar: 'الملف مطلوب.',
      });
    }

    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'FILE_TYPE_NOT_ALLOWED',
        message_en: 'Only PDF and image files are allowed.',
        message_ar: 'يُسمح فقط بملفات PDF والصور.',
      });
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message_en: 'File must be 5 MB or smaller.',
        message_ar: 'يجب ألا يتجاوز حجم الملف 5 ميجابايت.',
      });
    }

    const stored = await this.storage.store(
      `shipments/${shipmentId}`,
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
      },
      {
        maxBytes: MAX_FILE_BYTES,
        allowedKinds: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        visibility: 'private',
      },
    );

    const fileUrl = stored.url;

    return this.prisma.shipmentDocument.create({
      data: {
        shipmentId,
        documentType,
        fileUrl,
      },
    });
  }

  async listShipmentDocuments(user: User, shipmentId: string) {
    await this.access.assertCanView(user, shipmentId);

    return this.prisma.shipmentDocument.findMany({
      where: { shipmentId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getShipmentDocument(user: User, shipmentId: string, documentId: string) {
    await this.access.assertCanView(user, shipmentId);

    const document = await this.prisma.shipmentDocument.findFirst({
      where: { id: documentId, shipmentId },
    });

    if (!document) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message_en: 'Document not found.',
        message_ar: 'المستند غير موجود.',
      });
    }

    return document;
  }

}
