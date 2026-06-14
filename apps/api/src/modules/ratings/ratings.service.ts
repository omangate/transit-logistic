import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { ShipmentStatus } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';

import type { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRating(user: User, shipmentId: string, dto: CreateRatingDto) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { fleetOwner: true, rating: true },
    });

    if (!shipment || shipment.customerId !== user.id) {
      throw new NotFoundException({
        code: 'SHIPMENT_NOT_FOUND',
        message_en: 'Shipment not found.',
        message_ar: 'الشحنة غير موجودة.',
      });
    }

    if (![ShipmentStatus.DELIVERED, ShipmentStatus.COMPLETED].includes(shipment.status as ShipmentStatus)) {
      throw new BadRequestException({
        code: 'RATING_NOT_ALLOWED',
        message_en: 'Ratings are available after delivery.',
        message_ar: 'التقييمات متاحة بعد التسليم.',
      });
    }

    if (!shipment.fleetOwnerId) {
      throw new BadRequestException({
        code: 'RATING_NO_CARRIER',
        message_en: 'No carrier assigned to rate.',
        message_ar: 'لا يوجد ناقل معين للتقييم.',
      });
    }

    if (shipment.rating) {
      throw new BadRequestException({
        code: 'RATING_EXISTS',
        message_en: 'This shipment has already been rated.',
        message_ar: 'تم تقييم هذه الشحنة بالفعل.',
      });
    }

    return this.prisma.carrierRating.create({
      data: {
        shipmentId,
        customerId: user.id,
        fleetOwnerId: shipment.fleetOwnerId,
        score: dto.score,
        comment: dto.comment,
      },
    });
  }

  async getShipmentRating(user: User, shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { fleetOwner: true, rating: true },
    });

    if (!shipment) {
      throw new NotFoundException({
        code: 'SHIPMENT_NOT_FOUND',
        message_en: 'Shipment not found.',
        message_ar: 'الشحنة غير موجودة.',
      });
    }

    const allowed =
      user.role === 'admin' ||
      shipment.customerId === user.id ||
      shipment.fleetOwner?.userId === user.id;

    if (!allowed) {
      throw new BadRequestException({
        code: 'RATING_ACCESS_DENIED',
        message_en: 'You cannot view this rating.',
        message_ar: 'لا يمكنك عرض هذا التقييم.',
      });
    }

    return shipment.rating;
  }

  async getFleetSummary(user: User) {
    const fleetOwner = await this.prisma.fleetOwner.findUnique({
      where: { userId: user.id },
    });

    if (!fleetOwner) {
      throw new NotFoundException({
        code: 'FLEET_NOT_FOUND',
        message_en: 'Fleet profile not found.',
        message_ar: 'ملف الأسطول غير موجود.',
      });
    }

    const aggregate = await this.prisma.carrierRating.aggregate({
      where: { fleetOwnerId: fleetOwner.id },
      _avg: { score: true },
      _count: { score: true },
    });

    const recent = await this.prisma.carrierRating.findMany({
      where: { fleetOwnerId: fleetOwner.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        shipment: { select: { referenceNumber: true } },
      },
    });

    return {
      averageScore: aggregate._avg.score ?? 0,
      totalRatings: aggregate._count.score,
      recent,
    };
  }

  async listAllForAdmin(query: { page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [ratings, total] = await this.prisma.$transaction([
      this.prisma.carrierRating.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          shipment: { select: { referenceNumber: true } },
          fleetOwner: { select: { companyName: true } },
          customer: {
            select: {
              email: true,
              customerProfile: { select: { fullName: true } },
            },
          },
        },
      }),
      this.prisma.carrierRating.count(),
    ]);

    return {
      data: ratings.map((rating) => ({
        id: rating.id,
        score: rating.score,
        comment: rating.comment,
        createdAt: rating.createdAt,
        shipmentReference: rating.shipment.referenceNumber,
        fleetOwnerName: rating.fleetOwner.companyName,
        customerEmail: rating.customer.email,
        customerName: rating.customer.customerProfile?.fullName ?? null,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
