/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FleetOwner } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';

import type { User } from '@/types/user';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FleetOwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: User): boolean {
    return user.role === UserRole.ADMIN;
  }

  async requireFleetOwner(user: User): Promise<FleetOwner> {
    const fleetOwner = await this.prisma.fleetOwner.findUnique({
      where: { userId: user.id },
    });

    if (!fleetOwner) {
      throw new NotFoundException({
        code: 'FLEET_OWNER_NOT_FOUND',
        message_en: 'Fleet owner profile not found. Complete onboarding first.',
        message_ar: 'لم يتم العثور على ملف مالك الأسطول. أكمل التسجيل أولاً.',
      });
    }

    return fleetOwner;
  }

  async resolveFleetOwnerScope(user: User): Promise<FleetOwner | null> {
    if (this.isAdmin(user)) {
      return null;
    }

    return this.requireFleetOwner(user);
  }

  async resolveFleetOwnerForCreate(
    user: User,
    fleetOwnerId?: string,
  ): Promise<FleetOwner> {
    if (this.isAdmin(user)) {
      if (!fleetOwnerId) {
        throw new BadRequestException({
          code: 'FLEET_OWNER_ID_REQUIRED',
          message_en: 'fleetOwnerId is required when creating records as admin.',
          message_ar: 'معرف مالك الأسطول مطلوب عند إنشاء السجلات كمسؤول.',
        });
      }

      const fleetOwner = await this.prisma.fleetOwner.findUnique({
        where: { id: fleetOwnerId },
      });

      if (!fleetOwner) {
        throw new NotFoundException({
          code: 'FLEET_OWNER_NOT_FOUND',
          message_en: 'Fleet owner not found.',
          message_ar: 'مالك الأسطول غير موجود.',
        });
      }

      return fleetOwner;
    }

    return this.requireFleetOwner(user);
  }

  async assertVehicleOwnership(user: User, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        message_en: 'Vehicle not found.',
        message_ar: 'المركبة غير موجودة.',
      });
    }

    if (this.isAdmin(user)) {
      return vehicle;
    }

    const fleetOwner = await this.requireFleetOwner(user);

    if (vehicle.fleetOwnerId !== fleetOwner.id) {
      throw new ForbiddenException({
        code: 'VEHICLE_ACCESS_DENIED',
        message_en: 'You do not have access to this vehicle.',
        message_ar: 'ليس لديك صلاحية للوصول إلى هذه المركبة.',
      });
    }

    return vehicle;
  }

  async assertDriverOwnership(user: User, driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!driver) {
      throw new NotFoundException({
        code: 'DRIVER_NOT_FOUND',
        message_en: 'Driver not found.',
        message_ar: 'السائق غير موجود.',
      });
    }

    if (this.isAdmin(user)) {
      return driver;
    }

    const fleetOwner = await this.requireFleetOwner(user);

    if (driver.fleetOwnerId !== fleetOwner.id) {
      throw new ForbiddenException({
        code: 'DRIVER_ACCESS_DENIED',
        message_en: 'You do not have access to this driver.',
        message_ar: 'ليس لديك صلاحية للوصول إلى هذا السائق.',
      });
    }

    return driver;
  }
}
