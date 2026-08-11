/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ShipmentStatus } from '@transit-logistic/shared';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';
import { FleetOwnershipService } from '../fleet/fleet-ownership.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import { generateShipmentReference } from '../shipments/shipment-reference.util';

import type { BookingQueryDto, CreateBookingDto } from './dto/booking.dto';
import { AvailabilityService } from './availability.service';
import { calculateRentalPricing } from './rental-pricing.util';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly ownership: FleetOwnershipService,
    private readonly notifications: NotificationDeliveryService,
  ) {}

  async create(user: User, dto: CreateBookingDto) {
    this.assertCustomer(user);

    const listing = await this.prisma.truckListing.findFirst({
      where: {
        id: dto.truckListingId,
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

    const withDriver = dto.withDriver ?? true;
    if (withDriver && !listing.withDriverAvailable) {
      throw new BadRequestException({
        code: 'DRIVER_NOT_AVAILABLE',
        message_en: 'This listing does not offer driver service.',
        message_ar: 'هذا الإعلان لا يوفر خدمة السائق.',
      });
    }
    if (!withDriver && !listing.withoutDriverAvailable) {
      throw new BadRequestException({
        code: 'SELF_DRIVE_NOT_AVAILABLE',
        message_en: 'This listing does not offer self-drive rental.',
        message_ar: 'هذا الإعلان لا يوفر تأجير بدون سائق.',
      });
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message_en: 'End date must be on or after start date.',
        message_ar: 'يجب أن يكون تاريخ الانتهاء في أو بعد تاريخ البداية.',
      });
    }

    await this.availability.assertRangeAvailable(listing.id, startDate, endDate);

    let pricing;
    try {
      pricing = calculateRentalPricing(listing, startDate, endDate);
    } catch (error) {
      throw new BadRequestException({
        code: 'PRICING_UNAVAILABLE',
        message_en: error instanceof Error ? error.message : 'Unable to calculate rental price.',
        message_ar: 'تعذر حساب سعر التأجير.',
      });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const booking = await this.prisma.truckBooking.create({
      data: {
        truckListingId: listing.id,
        customerId: user.id,
        fleetOwnerId: listing.fleetOwnerId,
        startDate,
        endDate,
        withDriver,
        status: 'pending',
        dailyRate: pricing.dailyRate,
        totalAmount: pricing.totalAmount,
        currency: pricing.currency,
        notes: dto.notes,
        expiresAt,
      },
      include: {
        truckListing: { select: { name: true, slug: true } },
      },
    });

    void this.notifications.safeNotifyBookingEvent({
      customerId: user.id,
      fleetOwnerId: listing.fleetOwnerId,
      bookingId: booking.id,
      event: 'created',
      reference: listing.name,
    });

    return booking;
  }

  async confirm(user: User, bookingId: string) {
    const booking = await this.findBookingOrThrow(bookingId);
    await this.assertFleetBookingAccess(user, booking.fleetOwnerId);

    if (booking.status !== 'pending') {
      throw new BadRequestException({
        code: 'INVALID_BOOKING_STATE',
        message_en: 'Only pending bookings can be confirmed.',
        message_ar: 'يمكن تأكيد الحجوزات المعلقة فقط.',
      });
    }

    await this.availability.assertRangeAvailable(
      booking.truckListingId,
      booking.startDate,
      booking.endDate,
    );

    const updated = await this.prisma.truckBooking.update({
      where: { id: bookingId },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });

    void this.notifications.safeNotifyBookingEvent({
      customerId: booking.customerId,
      fleetOwnerId: booking.fleetOwnerId,
      bookingId,
      event: 'confirmed',
    });

    return updated;
  }

  async cancel(user: User, bookingId: string) {
    const booking = await this.findBookingOrThrow(bookingId);

    const isCustomer = user.role === UserRole.CUSTOMER && booking.customerId === user.id;
    const isFleet = user.role === UserRole.FLEET_OWNER || user.role === UserRole.ADMIN;
    if (!isCustomer && !isFleet) {
      await this.assertFleetBookingAccess(user, booking.fleetOwnerId);
    } else if (user.role === UserRole.FLEET_OWNER) {
      await this.assertFleetBookingAccess(user, booking.fleetOwnerId);
    } else if (user.role === UserRole.CUSTOMER && booking.customerId !== user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
    }

    if (['completed', 'cancelled', 'expired'].includes(booking.status)) {
      throw new BadRequestException({
        code: 'INVALID_BOOKING_STATE',
        message_en: 'Booking cannot be cancelled.',
        message_ar: 'لا يمكن إلغاء الحجز.',
      });
    }

    const updated = await this.prisma.truckBooking.update({
      where: { id: bookingId },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    void this.notifications.safeNotifyBookingEvent({
      customerId: booking.customerId,
      fleetOwnerId: booking.fleetOwnerId,
      bookingId,
      event: 'cancelled',
    });

    return updated;
  }

  async convertToShipment(user: User, bookingId: string) {
    const booking = await this.findBookingOrThrow(bookingId);

    if (user.role === UserRole.CUSTOMER && booking.customerId !== user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
    }
    if (user.role === UserRole.FLEET_OWNER) {
      await this.assertFleetBookingAccess(user, booking.fleetOwnerId);
    }

    if (!['confirmed', 'active'].includes(booking.status)) {
      throw new BadRequestException({
        code: 'INVALID_BOOKING_STATE',
        message_en: 'Only confirmed bookings can become shipments.',
        message_ar: 'يمكن تحويل الحجوزات المؤكدة فقط إلى شحنات.',
      });
    }

    if (booking.shipmentId) {
      const existing = await this.prisma.shipment.findUnique({ where: { id: booking.shipmentId } });
      if (existing) return existing;
    }

    const listing = await this.prisma.truckListing.findUniqueOrThrow({
      where: { id: booking.truckListingId },
    });

    const shipment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          referenceNumber: generateShipmentReference(),
          customerId: booking.customerId,
          fleetOwnerId: booking.fleetOwnerId,
          vehicleId: listing.vehicleId,
          truckListingId: listing.id,
          status: ShipmentStatus.PENDING_ASSIGNMENT,
          cargoDescription: booking.notes ?? `Rental: ${listing.name}`,
          scheduledAt: booking.startDate,
        },
      });

      await tx.truckBooking.update({
        where: { id: booking.id },
        data: { shipmentId: created.id, status: 'active' },
      });

      return created;
    });

    return shipment;
  }

  async listForUser(user: User, query: BookingQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where =
      user.role === UserRole.CUSTOMER
        ? { customerId: user.id, ...(query.status ? { status: query.status as never } : {}) }
        : user.role === UserRole.FLEET_OWNER
          ? {
              fleetOwnerId: (await this.ownership.resolveFleetOwnerScope(user))?.id,
              ...(query.status ? { status: query.status as never } : {}),
            }
          : { ...(query.status ? { status: query.status as never } : {}) };

    if (user.role === UserRole.FLEET_OWNER && !(where as { fleetOwnerId?: string }).fleetOwnerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message_en: 'Fleet owner profile required.',
        message_ar: 'مطلوب ملف مالك الأسطول.',
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.truckBooking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          truckListing: { select: { name: true, slug: true, coverImageUrl: true } },
        },
      }),
      this.prisma.truckBooking.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getById(user: User, bookingId: string) {
    const booking = await this.prisma.truckBooking.findUnique({
      where: { id: bookingId },
      include: {
        truckListing: { select: { name: true, slug: true, coverImageUrl: true } },
        quoteRequest: true,
        shipment: { select: { id: true, referenceNumber: true, status: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message_en: 'Booking not found.',
        message_ar: 'الحجز غير موجود.',
      });
    }

    await this.assertBookingViewAccess(user, booking);
    return booking;
  }

  private async findBookingOrThrow(bookingId: string) {
    const booking = await this.prisma.truckBooking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message_en: 'Booking not found.',
        message_ar: 'الحجز غير موجود.',
      });
    }
    return booking;
  }

  private assertCustomer(user: User) {
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message_en: 'Customer role required.',
        message_ar: 'مطلوب دور العميل.',
      });
    }
  }

  private async assertFleetBookingAccess(user: User, fleetOwnerId: string) {
    if (user.role === UserRole.ADMIN) return;
    const fleetOwner = await this.ownership.resolveFleetOwnerScope(user);
    if (!fleetOwner || fleetOwner.id !== fleetOwnerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message_en: 'You do not have access to this booking.',
        message_ar: 'ليس لديك صلاحية الوصول إلى هذا الحجز.',
      });
    }
  }

  private async assertBookingViewAccess(
    user: User,
    booking: { customerId: string; fleetOwnerId: string },
  ) {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.CUSTOMER && booking.customerId === user.id) return;
    if (user.role === UserRole.FLEET_OWNER) {
      await this.assertFleetBookingAccess(user, booking.fleetOwnerId);
      return;
    }
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message_en: 'You do not have access to this booking.',
      message_ar: 'ليس لديك صلاحية الوصول إلى هذا الحجز.',
    });
  }
}
