/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { FleetOwnershipService } from './fleet-ownership.service';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: FleetOwnershipService,
  ) {}

  async create(user: User, dto: CreateVehicleDto) {
    const fleetOwner = await this.ownership.resolveFleetOwnerForCreate(
      user,
      dto.fleetOwnerId,
    );

    try {
      return await this.prisma.vehicle.create({
        data: {
          fleetOwnerId: fleetOwner.id,
          plateNumber: dto.plateNumber,
          vehicleType: dto.vehicleType,
          capacityKg: dto.capacityKg,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: 'VEHICLE_PLATE_EXISTS',
          message_en: 'A vehicle with this plate number already exists in your fleet.',
          message_ar: 'توجد مركبة بهذا الرقم في أسطولك بالفعل.',
        });
      }
      throw error;
    }
  }

  async findAll(user: User) {
    const fleetOwner = await this.ownership.resolveFleetOwnerScope(user);

    const where: Prisma.VehicleWhereInput = fleetOwner
      ? { fleetOwnerId: fleetOwner.id }
      : {};

    return this.prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: User, vehicleId: string) {
    await this.ownership.assertVehicleOwnership(user, vehicleId);

    return this.prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicleId },
    });
  }

  async update(user: User, vehicleId: string, dto: UpdateVehicleDto) {
    await this.ownership.assertVehicleOwnership(user, vehicleId);

    try {
      return await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          ...(dto.plateNumber !== undefined ? { plateNumber: dto.plateNumber } : {}),
          ...(dto.vehicleType !== undefined ? { vehicleType: dto.vehicleType } : {}),
          ...(dto.capacityKg !== undefined ? { capacityKg: dto.capacityKg } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: 'VEHICLE_PLATE_EXISTS',
          message_en: 'A vehicle with this plate number already exists in your fleet.',
          message_ar: 'توجد مركبة بهذا الرقم في أسطولك بالفعل.',
        });
      }
      throw error;
    }
  }

  async remove(user: User, vehicleId: string) {
    await this.ownership.assertVehicleOwnership(user, vehicleId);

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isActive: false },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }
}
