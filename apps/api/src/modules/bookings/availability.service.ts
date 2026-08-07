import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';
import { FleetOwnershipService } from '../fleet/fleet-ownership.service';

import type { CreateAvailabilityBlockDto } from './dto/booking.dto';

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: FleetOwnershipService,
  ) {}

  async listForListing(listingId: string, from?: string, to?: string) {
    const where: Prisma.TruckAvailabilityBlockWhereInput = { truckListingId: listingId };
    if (from || to) {
      where.AND = [
        ...(to ? [{ startDate: { lte: new Date(to) } }] : []),
        ...(from ? [{ endDate: { gte: new Date(from) } }] : []),
      ];
    }

    return this.prisma.truckAvailabilityBlock.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
  }

  async createBlock(user: User, listingId: string, dto: CreateAvailabilityBlockDto) {
    await this.assertFleetListingAccess(user, listingId);

    const startDate = this.parseDateOnly(dto.startDate);
    const endDate = this.parseDateOnly(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message_en: 'End date must be on or after start date.',
        message_ar: 'يجب أن يكون تاريخ الانتهاء في أو بعد تاريخ البداية.',
      });
    }

    return this.prisma.truckAvailabilityBlock.create({
      data: {
        truckListingId: listingId,
        startDate,
        endDate,
        blockType: dto.blockType,
        reason: dto.reason,
      },
    });
  }

  async deleteBlock(user: User, listingId: string, blockId: string) {
    await this.assertFleetListingAccess(user, listingId);

    const block = await this.prisma.truckAvailabilityBlock.findFirst({
      where: { id: blockId, truckListingId: listingId },
    });

    if (!block) {
      throw new NotFoundException({
        code: 'BLOCK_NOT_FOUND',
        message_en: 'Availability block not found.',
        message_ar: 'كتلة التوفر غير موجودة.',
      });
    }

    await this.prisma.truckAvailabilityBlock.delete({ where: { id: blockId } });
    return { success: true };
  }

  async assertRangeAvailable(listingId: string, startDate: Date, endDate: Date) {
    const blockingTypes = ['busy', 'maintenance', 'blocked'] as const;

    const blockConflict = await this.prisma.truckAvailabilityBlock.findFirst({
      where: {
        truckListingId: listingId,
        blockType: { in: [...blockingTypes] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (blockConflict) {
      throw new BadRequestException({
        code: 'DATES_UNAVAILABLE',
        message_en: 'Selected dates conflict with truck availability.',
        message_ar: 'التواريخ المحددة تتعارض مع توفر الشاحنة.',
      });
    }

    const bookingConflict = await this.prisma.truckBooking.findFirst({
      where: {
        truckListingId: listingId,
        status: { in: ['pending', 'confirmed', 'active'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (bookingConflict) {
      throw new BadRequestException({
        code: 'DATES_ALREADY_BOOKED',
        message_en: 'Selected dates overlap an existing booking.',
        message_ar: 'التواريخ المحددة تتداخل مع حجز موجود.',
      });
    }
  }

  private async assertFleetListingAccess(user: User, listingId: string) {
    if (user.role === UserRole.ADMIN) return;

    const listing = await this.prisma.truckListing.findUnique({
      where: { id: listingId },
      select: { fleetOwnerId: true },
    });

    if (!listing) {
      throw new NotFoundException({
        code: 'LISTING_NOT_FOUND',
        message_en: 'Truck listing not found.',
        message_ar: 'إعلان الشاحنة غير موجود.',
      });
    }

    const fleetOwner = await this.ownership.resolveFleetOwnerScope(user);
    if (!fleetOwner || fleetOwner.id !== listing.fleetOwnerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message_en: 'You do not have access to this listing.',
        message_ar: 'ليس لديك صلاحية الوصول إلى هذا الإعلان.',
      });
    }
  }

  private parseDateOnly(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message_en: 'Invalid date.',
        message_ar: 'تاريخ غير صالح.',
      });
    }
    return date;
  }
}
