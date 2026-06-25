/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';
import { FleetOwnershipService } from '../fleet/fleet-ownership.service';

import type { CreateQuoteRequestDto, RespondQuoteDto } from './dto/marketplace.dto';

@Injectable()
export class MarketplaceQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: FleetOwnershipService,
  ) {}

  async create(user: User, listingId: string, dto: CreateQuoteRequestDto) {
    const listing = await this.prisma.truckListing.findFirst({
      where: {
        id: listingId,
        listingStatus: 'approved',
        isListingEnabled: true,
      },
    });

    if (!listing) {
      throw new NotFoundException({
        code: 'LISTING_NOT_FOUND',
        message_en: 'Truck listing not found.',
        message_ar: 'إعلان الشاحنة غير موجود.',
      });
    }

    return this.prisma.truckQuoteRequest.create({
      data: {
        truckListingId: listingId,
        customerId: user.id,
        originCity: dto.originCity,
        originCountry: dto.originCountry,
        destCity: dto.destCity,
        destCountry: dto.destCountry,
        cargoDetails: dto.cargoDetails,
        weightKg: dto.weightKg,
        preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : undefined,
      },
      include: {
        truckListing: { select: { name: true, slug: true } },
      },
    });
  }

  async listForCustomer(user: User) {
    return this.prisma.truckQuoteRequest.findMany({
      where: { customerId: user.id },
      include: {
        truckListing: {
          select: { name: true, slug: true, coverImageUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForFleet(user: User) {
    const fleetOwner = await this.ownership.resolveFleetOwnerScope(user);
    if (!fleetOwner && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message_en: 'Fleet owner profile required.',
        message_ar: 'مطلوب ملف مالك الأسطول.',
      });
    }

    return this.prisma.truckQuoteRequest.findMany({
      where: fleetOwner
        ? { truckListing: { fleetOwnerId: fleetOwner.id } }
        : undefined,
      include: {
        customer: {
          select: { customerProfile: { select: { fullName: true } } },
        },
        truckListing: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async respond(user: User, quoteId: string, dto: RespondQuoteDto) {
    const quote = await this.prisma.truckQuoteRequest.findUniqueOrThrow({
      where: { id: quoteId },
      include: { truckListing: true },
    });

    await this.assertQuoteAccess(user, quote.truckListing.fleetOwnerId);

    return this.prisma.truckQuoteRequest.update({
      where: { id: quoteId },
      data: { fleetResponse: dto.fleetResponse, status: 'responded' },
    });
  }

  private async assertQuoteAccess(user: User, fleetOwnerId: string) {
    if (user.role === UserRole.ADMIN) return;

    const fleetOwner = await this.ownership.resolveFleetOwnerScope(user);
    if (!fleetOwner || fleetOwner.id !== fleetOwnerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message_en: 'You do not have access to this quote request.',
        message_ar: 'ليس لديك صلاحية الوصول إلى طلب عرض السعر.',
      });
    }
  }
}
