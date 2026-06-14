/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import type { UpdateFleetProfileDto } from './dto/update-fleet-profile.dto';
import { FleetOwnershipService } from './fleet-ownership.service';

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: FleetOwnershipService,
  ) {}

  async getProfile(user: User) {
    if (this.ownership.isAdmin(user)) {
      throw new NotFoundException({
        code: 'FLEET_OWNER_NOT_FOUND',
        message_en: 'Admin users do not have a fleet owner profile.',
        message_ar: 'المستخدمون الإداريون ليس لديهم ملف مالك أسطول.',
      });
    }

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

  async updateProfile(user: User, dto: UpdateFleetProfileDto) {
    if (this.ownership.isAdmin(user)) {
      throw new NotFoundException({
        code: 'FLEET_OWNER_NOT_FOUND',
        message_en: 'Admin users do not have a fleet owner profile.',
        message_ar: 'المستخدمون الإداريون ليس لديهم ملف مالك أسطول.',
      });
    }

    const existing = await this.prisma.fleetOwner.findUnique({
      where: { userId: user.id },
    });

    if (!existing) {
      if (!dto.companyName) {
        throw new BadRequestException({
          code: 'COMPANY_NAME_REQUIRED',
          message_en: 'companyName is required to create a fleet owner profile.',
          message_ar: 'اسم الشركة مطلوب لإنشاء ملف مالك الأسطول.',
        });
      }

      return this.prisma.fleetOwner.create({
        data: {
          userId: user.id,
          companyName: dto.companyName,
          taxId: dto.taxId,
        },
      });
    }

    return this.prisma.fleetOwner.update({
      where: { id: existing.id },
      data: {
        ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId } : {}),
      },
    });
  }
}
