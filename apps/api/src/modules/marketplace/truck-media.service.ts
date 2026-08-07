/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { ImageProcessorService } from '../../common/storage/image-processor.service';
import { StorageService } from '../../common/storage/storage.service';
import { FleetOwnershipService } from '../fleet/fleet-ownership.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import { PrismaService } from '../../database/prisma.service';

const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
};

@Injectable()
export class TruckMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly images: ImageProcessorService,
    private readonly ownership: FleetOwnershipService,
    private readonly notifications: NotificationDeliveryService,
  ) {}

  async uploadImages(user: User, listingId: string, files: UploadFile[]) {
    await this.assertListingOwnership(user, listingId);
    if (!files.length) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message_en: 'No files uploaded.', message_ar: 'لم يتم رفع ملفات.' });
    }

    const existingCount = await this.prisma.truckListingImage.count({ where: { truckListingId: listingId } });
    if (existingCount + files.length > MAX_IMAGES) {
      throw new BadRequestException({
        code: 'TOO_MANY_IMAGES',
        message_en: `Maximum ${MAX_IMAGES} images per listing.`,
        message_ar: `الحد الأقصى ${MAX_IMAGES} صورة لكل إعلان.`,
      });
    }

    const maxSort = await this.prisma.truckListingImage.aggregate({
      where: { truckListingId: listingId },
      _max: { sortOrder: true },
    });
    let sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const created: Array<Awaited<ReturnType<typeof this.prisma.truckListingImage.create>>> = [];
    for (const file of files) {
      const detected = this.storage.validateAndDetect(
        { buffer: file.buffer, mimetype: file.mimetype, size: file.size, originalName: file.originalname },
        {
          maxBytes: MAX_IMAGE_BYTES,
          allowedKinds: ['image/jpeg', 'image/png', 'image/webp'],
        },
      );

      const processed = await this.images.processTruckImage(file.buffer, detected);
      const mainStored = await this.storage.storeBuffer(
        `trucks/${listingId}/images`,
        processed.main,
        processed.mimeType,
        { visibility: 'public' },
      );
      const thumbStored = await this.storage.storeBuffer(
        `trucks/${listingId}/thumbs`,
        processed.thumbnail,
        processed.mimeType,
        { visibility: 'public' },
      );

      const image = await this.prisma.truckListingImage.create({
        data: {
          truckListingId: listingId,
          url: mainStored.url,
          thumbnailUrl: thumbStored.url,
          storageKey: mainStored.key,
          width: processed.width || null,
          height: processed.height || null,
          mimeType: processed.mimeType,
          sortOrder: sortOrder++,
          isCover: existingCount === 0 && created.length === 0,
        },
      });
      created.push(image);
    }

    if (created.length && !(await this.prisma.truckListing.findFirst({ where: { id: listingId, coverImageUrl: { not: null } } }))) {
      await this.prisma.truckListing.update({
        where: { id: listingId },
        data: { coverImageUrl: created[0]!.url },
      });
    }

    void this.notifications.safeNotifyUploadCompleted(user.id, listingId, 'images');

    return created;
  }

  async uploadVideo(user: User, listingId: string, file: UploadFile) {
    await this.assertListingOwnership(user, listingId);
    const detected = this.storage.validateAndDetect(
      { buffer: file.buffer, mimetype: file.mimetype, size: file.size, originalName: file.originalname },
      { maxBytes: MAX_VIDEO_BYTES, allowedKinds: ['video/mp4', 'video/webm'] },
    );

    const stored = await this.storage.store(
      `trucks/${listingId}/video`,
      { buffer: file.buffer, mimetype: detected, size: file.size, originalName: file.originalname },
      { maxBytes: MAX_VIDEO_BYTES, allowedKinds: ['video/mp4', 'video/webm'], visibility: 'public' },
    );

    await this.prisma.truckListing.update({
      where: { id: listingId },
      data: {
        videoUrl: stored.url,
        videoStorageKey: stored.key,
      },
    });

    void this.notifications.safeNotifyUploadCompleted(user.id, listingId, 'video');
    return { videoUrl: stored.url, key: stored.key };
  }

  async deleteImage(user: User, listingId: string, imageId: string) {
    await this.assertListingOwnership(user, listingId);
    const image = await this.prisma.truckListingImage.findFirst({
      where: { id: imageId, truckListingId: listingId },
    });
    if (!image) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Image not found.', message_ar: 'الصورة غير موجودة.' });
    }

    if (image.storageKey) await this.storage.delete(image.storageKey);
    await this.prisma.truckListingImage.delete({ where: { id: imageId } });

    if (image.isCover) {
      const next = await this.prisma.truckListingImage.findFirst({
        where: { truckListingId: listingId },
        orderBy: { sortOrder: 'asc' },
      });
      if (next) {
        await this.setCoverInternal(listingId, next.id);
      } else {
        await this.prisma.truckListing.update({ where: { id: listingId }, data: { coverImageUrl: null } });
      }
    }

    return { success: true };
  }

  async reorderImages(user: User, listingId: string, imageIds: string[]) {
    await this.assertListingOwnership(user, listingId);
    await Promise.all(
      imageIds.map((id, index) =>
        this.prisma.truckListingImage.updateMany({
          where: { id, truckListingId: listingId },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.prisma.truckListingImage.findMany({
      where: { truckListingId: listingId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async setCover(user: User, listingId: string, imageId: string) {
    await this.assertListingOwnership(user, listingId);
    return this.setCoverInternal(listingId, imageId);
  }

  async saveDraft(user: User, listingId: string, draftData: Record<string, unknown>) {
    await this.assertListingOwnership(user, listingId);
    return this.prisma.truckListing.update({
      where: { id: listingId },
      data: { draftData: draftData as never },
    });
  }

  private async setCoverInternal(listingId: string, imageId: string) {
    const image = await this.prisma.truckListingImage.findFirst({
      where: { id: imageId, truckListingId: listingId },
    });
    if (!image) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Image not found.', message_ar: 'الصورة غير موجودة.' });
    }

    await this.prisma.truckListingImage.updateMany({
      where: { truckListingId: listingId },
      data: { isCover: false },
    });
    await this.prisma.truckListingImage.update({
      where: { id: imageId },
      data: { isCover: true },
    });
    return this.prisma.truckListing.update({
      where: { id: listingId },
      data: { coverImageUrl: image.url },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  private async assertListingOwnership(user: User, listingId: string) {
    const listing = await this.prisma.truckListing.findUniqueOrThrow({ where: { id: listingId } });
    if (user.role === UserRole.ADMIN) return listing;
    const fleetOwner = await this.ownership.resolveFleetOwnerScope(user);
    if (!fleetOwner || listing.fleetOwnerId !== fleetOwner.id) {
      throw new NotFoundException({
        code: 'FORBIDDEN',
        message_en: 'You do not have access to this listing.',
        message_ar: 'ليس لديك صلاحية الوصول إلى هذا الإعلان.',
      });
    }
    return listing;
  }
}
