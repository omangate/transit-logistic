import { randomBytes } from 'node:crypto';
import { createReadStream as createReadStreamSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { detectFileKind, extensionForKind, type DetectedFileKind } from './file-magic.util';

export type StoredFileInput = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalName?: string;
};

export type StoreOptions = {
  maxBytes?: number;
  allowedKinds?: DetectedFileKind[];
  visibility?: 'public' | 'private';
};

export type StoredFileResult = {
  url: string;
  key: string;
  provider: 'local' | 's3';
  mimeType: string;
  size: number;
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadRoot: string;
  private readonly provider: 'local' | 's3';
  private readonly s3Bucket?: string;
  private readonly s3PublicBaseUrl?: string;

  constructor(private readonly config: ConfigService) {
    this.uploadRoot = this.config.get<string>('app.uploadDir', join(process.cwd(), 'uploads'));
    this.provider = this.config.get<string>('storage.provider', 'local') === 's3' ? 's3' : 'local';
    this.s3Bucket = this.config.get<string>('storage.s3.bucket');
    this.s3PublicBaseUrl = this.config.get<string>('storage.s3.publicBaseUrl');
  }

  validateAndDetect(file: StoredFileInput | undefined, options: StoreOptions = {}) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message_en: 'A file is required.',
        message_ar: 'الملف مطلوب.',
      });
    }

    const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message_en: `File must be ${Math.floor(maxBytes / (1024 * 1024))} MB or smaller.`,
        message_ar: `يجب ألا يتجاوز حجم الملف ${Math.floor(maxBytes / (1024 * 1024))} ميجابايت.`,
      });
    }

    const detected = detectFileKind(file.buffer);
    if (!detected) {
      throw new BadRequestException({
        code: 'FILE_TYPE_NOT_ALLOWED',
        message_en: 'Unrecognized or unsupported file type.',
        message_ar: 'نوع الملف غير معروف أو غير مدعوم.',
      });
    }

    if (options.allowedKinds && !options.allowedKinds.includes(detected)) {
      throw new BadRequestException({
        code: 'FILE_TYPE_NOT_ALLOWED',
        message_en: 'File type is not allowed for this upload.',
        message_ar: 'نوع الملف غير مسموح لهذا الرفع.',
      });
    }

    return detected;
  }

  async store(relativeDir: string, file: StoredFileInput, options: StoreOptions = {}): Promise<StoredFileResult> {
    const detected = this.validateAndDetect(file, options);
    const ext = extensionForKind(detected);
    const filename = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
    const visibility = options.visibility ?? 'public';
    const prefix = visibility === 'private' ? 'private' : 'public';
    const normalizedDir = `${prefix}/${relativeDir.replace(/\\/g, '/').replace(/^\/+/, '')}`;
    const key = `${normalizedDir}/${filename}`;

    if (this.provider === 's3' && this.s3Bucket) {
      const uploaded = await this.storeS3(key, file.buffer, detected, visibility);
      return {
        url: uploaded.url,
        key,
        provider: 's3',
        mimeType: detected,
        size: file.buffer.length,
      };
    }

    const absoluteDir = join(this.uploadRoot, normalizedDir);
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(join(absoluteDir, filename), file.buffer);

    const url =
      visibility === 'private'
        ? `/api/v1/files/${encodeURIComponent(key)}`
        : `/uploads/${key}`;

    return { url, key, provider: 'local', mimeType: detected, size: file.buffer.length };
  }

  async storeBuffer(
    relativeDir: string,
    buffer: Buffer,
    mimeType: DetectedFileKind,
    options: StoreOptions = {},
  ): Promise<StoredFileResult> {
    return this.store(
      relativeDir,
      { buffer, mimetype: mimeType, size: buffer.length },
      { ...options, allowedKinds: options.allowedKinds ?? [mimeType] },
    );
  }

  async read(key: string): Promise<{ buffer: Buffer; mimeType: string }> {
    if (this.provider === 's3' && this.s3Bucket) {
      return this.readS3(key);
    }

    const absolutePath = join(this.uploadRoot, key);
    try {
      const buffer = await readFile(absolutePath);
      const detected = detectFileKind(buffer) ?? 'application/octet-stream';
      return { buffer, mimeType: detected };
    } catch {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message_en: 'File not found.',
        message_ar: 'الملف غير موجود.',
      });
    }
  }

  createReadStream(key: string) {
    const absolutePath = join(this.uploadRoot, key);
    return createReadStreamSync(absolutePath);
  }

  async delete(key: string) {
    if (this.provider === 's3' && this.s3Bucket) {
      await this.deleteS3(key);
      return;
    }
    try {
      await unlink(join(this.uploadRoot, key));
    } catch {
      this.logger.warn(`Failed to delete local file ${key}`);
    }
  }

  publicUrlForKey(key: string) {
    if (this.provider === 's3' && this.s3PublicBaseUrl) {
      return `${this.s3PublicBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    if (key.startsWith('private/')) {
      return `/api/v1/files/${encodeURIComponent(key)}`;
    }
    return `/uploads/${key}`;
  }

  private async storeS3(
    key: string,
    buffer: Buffer,
    contentType: string,
    visibility: 'public' | 'private',
  ) {
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: this.config.get<string>('storage.s3.region', 'auto'),
        endpoint: this.config.get<string>('storage.s3.endpoint'),
        credentials: {
          accessKeyId: this.config.get<string>('storage.s3.accessKeyId', ''),
          secretAccessKey: this.config.get<string>('storage.s3.secretAccessKey', ''),
        },
        forcePathStyle: this.config.get<boolean>('storage.s3.forcePathStyle', true),
      });

      await client.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket!,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ACL: visibility === 'public' ? 'public-read' : 'private',
        }),
      );

      const url =
        visibility === 'public' && this.s3PublicBaseUrl
          ? `${this.s3PublicBaseUrl.replace(/\/$/, '')}/${key}`
          : `/api/v1/files/${encodeURIComponent(key)}`;

      return { url };
    } catch (error) {
      this.logger.error(`S3 upload failed, falling back to local: ${String(error)}`);
      const absoluteDir = join(this.uploadRoot, key.split('/').slice(0, -1).join('/'));
      await mkdir(absoluteDir, { recursive: true });
      await writeFile(join(this.uploadRoot, key), buffer);
      return {
        url: visibility === 'private' ? `/api/v1/files/${encodeURIComponent(key)}` : `/uploads/${key}`,
      };
    }
  }

  private async readS3(key: string) {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: this.config.get<string>('storage.s3.region', 'auto'),
      endpoint: this.config.get<string>('storage.s3.endpoint'),
      credentials: {
        accessKeyId: this.config.get<string>('storage.s3.accessKeyId', ''),
        secretAccessKey: this.config.get<string>('storage.s3.secretAccessKey', ''),
      },
      forcePathStyle: this.config.get<boolean>('storage.s3.forcePathStyle', true),
    });
    const result = await client.send(
      new GetObjectCommand({ Bucket: this.s3Bucket!, Key: key }),
    );
    const bytes = await result.Body!.transformToByteArray();
    const buffer = Buffer.from(bytes);
    return { buffer, mimeType: result.ContentType ?? detectFileKind(buffer) ?? 'application/octet-stream' };
  }

  private async deleteS3(key: string) {
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: this.config.get<string>('storage.s3.region', 'auto'),
      endpoint: this.config.get<string>('storage.s3.endpoint'),
      credentials: {
        accessKeyId: this.config.get<string>('storage.s3.accessKeyId', ''),
        secretAccessKey: this.config.get<string>('storage.s3.secretAccessKey', ''),
      },
      forcePathStyle: this.config.get<boolean>('storage.s3.forcePathStyle', true),
    });
    await client.send(new DeleteObjectCommand({ Bucket: this.s3Bucket!, Key: key }));
  }
}
