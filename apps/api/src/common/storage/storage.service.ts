import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
]);

export type StoredFileInput = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalName?: string;
};

export type StoredFileResult = {
  url: string;
  key: string;
  provider: 'local' | 's3';
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadRoot: string;
  private readonly provider: 'local' | 's3';

  constructor(private readonly config: ConfigService) {
    this.uploadRoot = this.config.get<string>('app.uploadDir', join(process.cwd(), 'uploads'));
    const configured = this.config.get<string>('storage.provider', 'local');
    this.provider = configured === 's3' ? 's3' : 'local';
  }

  validateFile(file: StoredFileInput | undefined, maxBytes = MAX_FILE_BYTES) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message_en: 'A file is required.',
        message_ar: 'الملف مطلوب.',
      });
    }

    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'FILE_TYPE_NOT_ALLOWED',
        message_en: 'File type is not allowed.',
        message_ar: 'نوع الملف غير مسموح.',
      });
    }

    if (file.size > maxBytes) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message_en: `File must be ${Math.floor(maxBytes / (1024 * 1024))} MB or smaller.`,
        message_ar: `يجب ألا يتجاوز حجم الملف ${Math.floor(maxBytes / (1024 * 1024))} ميجابايت.`,
      });
    }
  }

  async store(relativeDir: string, file: StoredFileInput): Promise<StoredFileResult> {
    this.validateFile(file);

    const ext = this.extensionForMime(file.mimetype);
    const filename = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;
    const normalizedDir = relativeDir.replace(/\\/g, '/').replace(/^\/+/, '');
    const key = `${normalizedDir}/${filename}`;

    if (this.provider === 's3') {
      this.logger.warn(
        'S3 storage selected but credentials not configured; falling back to local disk.',
      );
    }

    const absoluteDir = join(this.uploadRoot, normalizedDir);
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(join(absoluteDir, filename), file.buffer);

    return {
      url: `/uploads/${key}`,
      key,
      provider: 'local',
    };
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
      case 'video/mp4':
        return '.mp4';
      default:
        return '.bin';
    }
  }
}
