import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@/types/user';

/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { ConfigService } from '@nestjs/config';
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
  private readonly uploadRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ShipmentAccessService,
    private readonly config: ConfigService,
  ) {
    this.uploadRoot = this.config.get<string>('app.uploadDir', join(process.cwd(), 'uploads'));
  }

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

    const ext = this.extensionForMime(file.mimetype);
    const filename = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
    const relativeDir = join('shipments', shipmentId);
    const absoluteDir = join(this.uploadRoot, relativeDir);
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(join(absoluteDir, filename), file.buffer);

    const fileUrl = `/uploads/${relativeDir.replace(/\\/g, '/')}/${filename}`;

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

  private extensionForMime(mime: string) {
    switch (mime) {
      case 'application/pdf':
        return '.pdf';
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      default:
        return '.bin';
    }
  }
}
