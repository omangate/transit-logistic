/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Injectable } from '@nestjs/common';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers() {
    const customers = await this.prisma.user.findMany({
      where: { role: UserRole.CUSTOMER },
      include: {
        customerProfile: true,
        _count: { select: { shipmentsCreated: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return customers.map((customer) => ({
      id: customer.id,
      email: customer.email,
      phone: customer.phone,
      fullName: customer.customerProfile?.fullName ?? null,
      company: customer.customerProfile?.company ?? null,
      isActive: customer.isActive,
      isVerified: customer.isVerified,
      locale: customer.locale,
      shipmentCount: customer._count.shipmentsCreated,
      createdAt: customer.createdAt,
    }));
  }
}
