/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Shipment, User } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';
import { FleetOwnershipService } from '../fleet/fleet-ownership.service';

@Injectable()
export class ShipmentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fleetOwnership: FleetOwnershipService,
  ) {}

  isAdmin(user: User): boolean {
    return user.role === UserRole.ADMIN;
  }

  async assertCanView(user: User, shipmentId: string): Promise<Shipment> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException({
        code: 'SHIPMENT_NOT_FOUND',
        message_en: 'Shipment not found.',
        message_ar: 'الشحنة غير موجودة.',
      });
    }

    if (this.isAdmin(user)) {
      return shipment;
    }

    if (user.role === UserRole.CUSTOMER && shipment.customerId === user.id) {
      return shipment;
    }

    if (user.role === UserRole.DRIVER && shipment.driverId === user.id) {
      return shipment;
    }

    if (user.role === UserRole.FLEET_OWNER) {
      const fleetOwner = await this.fleetOwnership.requireFleetOwner(user);

      if (
        shipment.fleetOwnerId === fleetOwner.id ||
        shipment.status === 'pending_assignment'
      ) {
        return shipment;
      }
    }

    throw new ForbiddenException({
      code: 'SHIPMENT_ACCESS_DENIED',
      message_en: 'You do not have access to this shipment.',
      message_ar: 'ليس لديك صلاحية للوصول إلى هذه الشحنة.',
    });
  }

  async buildListFilter(user: User): Promise<Prisma.ShipmentWhereInput> {
    if (this.isAdmin(user)) {
      return {};
    }

    if (user.role === UserRole.CUSTOMER) {
      return { customerId: user.id };
    }

    if (user.role === UserRole.DRIVER) {
      return { driverId: user.id };
    }

    if (user.role === UserRole.FLEET_OWNER) {
      const fleetOwner = await this.fleetOwnership.requireFleetOwner(user);
      return { fleetOwnerId: fleetOwner.id };
    }

    throw new ForbiddenException({
      code: 'SHIPMENT_ACCESS_DENIED',
      message_en: 'You do not have access to shipments.',
      message_ar: 'ليس لديك صلاحية للوصول إلى الشحنات.',
    });
  }

  async buildAvailableFilter(user: User): Promise<Prisma.ShipmentWhereInput> {
    if (!this.isAdmin(user) && user.role !== UserRole.FLEET_OWNER) {
      throw new ForbiddenException({
        code: 'SHIPMENT_ACCESS_DENIED',
        message_en: 'Only fleet owners can view available shipments.',
        message_ar: 'يمكن لمالكي الأساطيل فقط عرض الشحنات المتاحة.',
      });
    }

    return { status: 'pending_assignment' };
  }
}
