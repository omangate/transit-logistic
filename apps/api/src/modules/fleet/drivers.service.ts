/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../database/prisma.service';

import type { CreateDriverDto } from './dto/create-driver.dto';
import type { UpdateDriverDto } from './dto/update-driver.dto';
import { FleetOwnershipService } from './fleet-ownership.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: FleetOwnershipService,
  ) {}

  async create(user: User, dto: CreateDriverDto) {
    const fleetOwner = await this.ownership.resolveFleetOwnerForCreate(
      user,
      dto.fleetOwnerId,
    );

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email.toLowerCase() },
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DRIVER_ALREADY_EXISTS',
        message_en: 'A user with this email or phone already exists.',
        message_ar: 'يوجد مستخدم بهذا البريد الإلكتروني أو رقم الهاتف بالفعل.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const driver = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          passwordHash,
          role: UserRole.driver,
        },
      });

      return tx.driverProfile.create({
        data: {
          userId: newUser.id,
          fleetOwnerId: fleetOwner.id,
          licenseNumber: dto.licenseNumber,
        },
        include: { user: true },
      });
    });

    return this.toDriverResponse(driver);
  }

  async findAll(user: User) {
    const fleetOwner = await this.ownership.resolveFleetOwnerScope(user);

    const where: Prisma.DriverProfileWhereInput = fleetOwner
      ? { fleetOwnerId: fleetOwner.id }
      : {};

    const drivers = await this.prisma.driverProfile.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });

    return drivers.map((driver) => this.toDriverResponse(driver));
  }

  async findOne(user: User, driverId: string) {
    const driver = await this.ownership.assertDriverOwnership(user, driverId);
    return this.toDriverResponse(driver);
  }

  async update(user: User, driverId: string, dto: UpdateDriverDto) {
    const driver = await this.ownership.assertDriverOwnership(user, driverId);

    if (dto.phone) {
      const phoneOwner = await this.prisma.user.findFirst({
        where: {
          phone: dto.phone,
          NOT: { id: driver.userId },
        },
      });

      if (phoneOwner) {
        throw new ConflictException({
          code: 'PHONE_ALREADY_EXISTS',
          message_en: 'This phone number is already in use.',
          message_ar: 'رقم الهاتف هذا مستخدم بالفعل.',
        });
      }
    }

    const updated = await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        ...(dto.licenseNumber !== undefined ? { licenseNumber: dto.licenseNumber } : {}),
        ...(dto.isAvailable !== undefined ? { isAvailable: dto.isAvailable } : {}),
        ...(dto.phone !== undefined
          ? {
              user: {
                update: { phone: dto.phone },
              },
            }
          : {}),
      },
      include: { user: true },
    });

    return this.toDriverResponse(updated);
  }

  async remove(user: User, driverId: string) {
    await this.ownership.assertDriverOwnership(user, driverId);

    const updated = await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        isAvailable: false,
        user: {
          update: { isActive: false },
        },
      },
      include: { user: true },
    });

    return this.toDriverResponse(updated);
  }

  private toDriverResponse(
    driver: Prisma.DriverProfileGetPayload<{ include: { user: true } }>,
  ) {
    return {
      id: driver.id,
      fleetOwnerId: driver.fleetOwnerId,
      licenseNumber: driver.licenseNumber,
      isAvailable: driver.isAvailable,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
      user: {
        id: driver.user.id,
        email: driver.user.email,
        phone: driver.user.phone,
        role: driver.user.role,
        isActive: driver.user.isActive,
        locale: driver.user.locale,
      },
    };
  }
}
