/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminFleetService {
  constructor(private readonly prisma: PrismaService) {}

  async listFleetOwners() {
    const fleetOwners = await this.prisma.fleetOwner.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            vehicles: true,
            drivers: true,
          },
        },
      },
      orderBy: { companyName: 'asc' },
    });

    return fleetOwners.map((fleetOwner) => ({
      id: fleetOwner.id,
      companyName: fleetOwner.companyName,
      taxId: fleetOwner.taxId,
      kycStatus: fleetOwner.kycStatus,
      user: fleetOwner.user,
      vehicleCount: fleetOwner._count.vehicles,
      driverCount: fleetOwner._count.drivers,
    }));
  }
}
