/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { QuoteRequestStatus } from '@prisma/client';

import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';
import { FleetOwnershipService } from '../fleet/fleet-ownership.service';
import { AvailabilityService } from '../bookings/availability.service';
import { calculateRentalPricing } from '../bookings/rental-pricing.util';

import type { CreateQuoteRequestDto } from './dto/marketplace.dto';
import type { QuoteCustomerActionDto, QuoteFleetActionDto } from '../bookings/dto/booking.dto';

@Injectable()
export class MarketplaceQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: FleetOwnershipService,
    private readonly availability: AvailabilityService,
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

    const quote = await this.prisma.truckQuoteRequest.create({
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
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: {
        truckListing: { select: { name: true, slug: true } },
      },
    });

    await this.recordStatus(quote.id, 'pending', user.id, 'Quote submitted');
    return quote;
  }

  async listForCustomer(user: User) {
    return this.prisma.truckQuoteRequest.findMany({
      where: { customerId: user.id },
      include: {
        truckListing: {
          select: { name: true, slug: true, coverImageUrl: true },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        booking: { select: { id: true, status: true } },
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
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async respond(user: User, quoteId: string, dto: { fleetResponse: string }) {
    return this.fleetAction(user, quoteId, {
      action: 'request_info',
      fleetResponse: dto.fleetResponse,
    });
  }

  async fleetAction(user: User, quoteId: string, dto: QuoteFleetActionDto) {
    const quote = await this.prisma.truckQuoteRequest.findUniqueOrThrow({
      where: { id: quoteId },
      include: { truckListing: true },
    });

    await this.assertQuoteAccess(user, quote.truckListing.fleetOwnerId);

    if (['accepted', 'declined', 'expired', 'cancelled'].includes(quote.status)) {
      throw new BadRequestException({
        code: 'QUOTE_CLOSED',
        message_en: 'This quote request is no longer open.',
        message_ar: 'طلب عرض السعر هذا لم يعد مفتوحاً.',
      });
    }

    let status: QuoteRequestStatus = quote.status;
    const data: Record<string, unknown> = {};

    switch (dto.action) {
      case 'accept':
        status = 'accepted';
        if (dto.quotedAmount != null) data.quotedAmount = dto.quotedAmount;
        if (dto.fleetResponse) data.fleetResponse = dto.fleetResponse;
        break;
      case 'reject':
        status = 'declined';
        if (dto.fleetResponse) data.fleetResponse = dto.fleetResponse;
        break;
      case 'counter':
        status = 'countered';
        if (dto.quotedAmount == null) {
          throw new BadRequestException({
            code: 'AMOUNT_REQUIRED',
            message_en: 'Counter offer amount is required.',
            message_ar: 'مبلغ العرض المضاد مطلوب.',
          });
        }
        data.counterAmount = dto.quotedAmount;
        if (dto.fleetResponse) data.fleetResponse = dto.fleetResponse;
        break;
      case 'request_info':
        status = 'responded';
        if (!dto.fleetResponse) {
          throw new BadRequestException({
            code: 'RESPONSE_REQUIRED',
            message_en: 'A message is required.',
            message_ar: 'الرسالة مطلوبة.',
          });
        }
        data.fleetResponse = dto.fleetResponse;
        break;
      default:
        throw new BadRequestException({ code: 'INVALID_ACTION', message_en: 'Invalid action.', message_ar: 'إجراء غير صالح.' });
    }

    if (dto.expiresAt) data.expiresAt = new Date(dto.expiresAt);

    const updated = await this.prisma.truckQuoteRequest.update({
      where: { id: quoteId },
      data: { ...data, status },
    });

    await this.recordStatus(quoteId, status, user.id, dto.fleetResponse ?? dto.action);
    return updated;
  }

  async customerAction(user: User, quoteId: string, dto: QuoteCustomerActionDto) {
    const quote = await this.prisma.truckQuoteRequest.findUniqueOrThrow({
      where: { id: quoteId },
      include: { truckListing: true, booking: true },
    });

    if (quote.customerId !== user.id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message_en: 'You do not have access to this quote.',
        message_ar: 'ليس لديك صلاحية الوصول إلى عرض السعر.',
      });
    }

    if (dto.action === 'cancel') {
      const updated = await this.prisma.truckQuoteRequest.update({
        where: { id: quoteId },
        data: { status: 'cancelled' },
      });
      await this.recordStatus(quoteId, 'cancelled', user.id, dto.note);
      return updated;
    }

    if (dto.action === 'reject') {
      const updated = await this.prisma.truckQuoteRequest.update({
        where: { id: quoteId },
        data: { status: 'declined' },
      });
      await this.recordStatus(quoteId, 'declined', user.id, dto.note);
      return updated;
    }

    if (quote.status !== 'accepted' && quote.status !== 'countered') {
      throw new BadRequestException({
        code: 'QUOTE_NOT_ACCEPTABLE',
        message_en: 'Quote must be accepted or countered by fleet before customer acceptance.',
        message_ar: 'يجب أن يقبل الأسطول العرض أو يرسل عرضاً مضاداً أولاً.',
      });
    }

    const updated = await this.prisma.truckQuoteRequest.update({
      where: { id: quoteId },
      data: { status: 'accepted' },
    });
    await this.recordStatus(quoteId, 'accepted', user.id, dto.note ?? 'Customer accepted');
    return updated;
  }

  async convertToBooking(user: User, quoteId: string) {
    const quote = await this.prisma.truckQuoteRequest.findUniqueOrThrow({
      where: { id: quoteId },
      include: { truckListing: true, booking: true },
    });

    if (quote.customerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
    }

    if (quote.status !== 'accepted') {
      throw new BadRequestException({
        code: 'QUOTE_NOT_ACCEPTED',
        message_en: 'Only accepted quotes can be converted to bookings.',
        message_ar: 'يمكن تحويل عروض الأسعار المقبولة فقط إلى حجوزات.',
      });
    }

    if (quote.booking) return quote.booking;

    const startDate = quote.startDate ?? quote.preferredDate ?? new Date();
    const endDate =
      quote.endDate ??
      new Date(startDate.getTime() + ((quote.truckListing.minRentalDays ?? 1) - 1) * 86_400_000);

    await this.availability.assertRangeAvailable(quote.truckListingId, startDate, endDate);

    let totalAmount: string | number =
      quote.counterAmount?.toString() ?? quote.quotedAmount?.toString() ?? '';
    let dailyRateValue: string | number | undefined = quote.truckListing.dailyRentalPrice?.toString();

    if (!totalAmount) {
      const pricing = calculateRentalPricing(quote.truckListing, startDate, endDate);
      totalAmount = pricing.totalAmount;
      dailyRateValue = pricing.dailyRate;
    }

    const booking = await this.prisma.truckBooking.create({
      data: {
        truckListingId: quote.truckListingId,
        customerId: quote.customerId,
        fleetOwnerId: quote.truckListing.fleetOwnerId,
        quoteRequestId: quote.id,
        startDate,
        endDate,
        withDriver: quote.withDriver ?? true,
        status: 'pending',
        dailyRate: dailyRateValue,
        totalAmount,
        currency: quote.currency,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return booking;
  }

  private async recordStatus(
    quoteId: string,
    status: QuoteRequestStatus,
    actorId: string | null,
    note?: string,
  ) {
    await this.prisma.quoteStatusHistory.create({
      data: { quoteId, status, actorId: actorId ?? undefined, note },
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
