import { Injectable } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';

import { LogisticsAccessService } from './logistics-access.service';
import { LogisticsAuditService } from './logistics-audit.service';
import { generateLogisticsReference } from './logistics-reference.util';

@Injectable()
export class LogisticsOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LogisticsAccessService,
    private readonly audit: LogisticsAuditService,
  ) {}

  async listForUser(user: User) {
    const where =
      user.role === UserRole.ADMIN
        ? {}
        : user.role === UserRole.CUSTOMER
          ? { customerId: user.id }
          : { id: 'none' };

    return this.prisma.logisticsOrder.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        customsRequests: { select: { id: true, referenceNumber: true, status: true, transactionType: true } },
        freightRequests: { select: { id: true, referenceNumber: true, status: true, transportMode: true } },
        _count: { select: { documents: true, quotes: true, charges: true } },
      },
    });
  }

  async getById(user: User, id: string) {
    await this.access.assertOrderAccess(user, id);
    return this.prisma.logisticsOrder.findUniqueOrThrow({
      where: { id },
      include: {
        customsRequests: { include: { cargoLines: true, _count: { select: { documents: true } } } },
        freightRequests: true,
        documents: true,
        quotes: { include: { lines: true }, orderBy: { version: 'desc' } },
        charges: true,
        containers: true,
        vehicleShipments: true,
        checklistItems: true,
        statusHistory: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, email: true } } } },
      },
    });
  }

  async create(user: User, input: { title?: string; description?: string }) {
    if (user.role !== UserRole.CUSTOMER && user.role !== UserRole.ADMIN) {
      this.access.assertAdmin(user);
    }
    const customerId = user.role === UserRole.ADMIN ? user.id : user.id;

    const order = await this.prisma.logisticsOrder.create({
      data: {
        referenceNumber: generateLogisticsReference('LO'),
        customerId,
        title: input.title,
        description: input.description,
        status: 'draft',
      },
    });

    await this.audit.recordStatusChange({
      entityType: 'logistics_order',
      status: 'draft',
      actorId: user.id,
      logisticsOrderId: order.id,
      note: 'Order created',
    });

    return order;
  }

  async getMasterTimeline(user: User, orderId: string) {
    await this.access.assertOrderAccess(user, orderId);
    return this.prisma.logisticsStatusHistory.findMany({
      where: { logisticsOrderId: orderId },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, email: true, role: true } } },
    });
  }

  async getCustomerDashboard(user: User) {
    const customerId = user.id;
    const [orders, customs, freight, shipments, bookings, quotes] = await Promise.all([
      this.prisma.logisticsOrder.count({ where: { customerId, status: { notIn: ['completed', 'cancelled'] } } }),
      this.prisma.customsClearanceRequest.count({ where: { customerId, status: { notIn: ['completed', 'cancelled'] } } }),
      this.prisma.freightForwardingRequest.count({ where: { customerId, status: { notIn: ['completed', 'cancelled'] } } }),
      this.prisma.shipment.count({ where: { customerId, status: { notIn: ['completed', 'cancelled'] } } }),
      this.prisma.truckBooking.count({ where: { customerId, status: { notIn: ['completed', 'cancelled'] } } }),
      this.prisma.logisticsQuote.count({
        where: {
          OR: [
            { logisticsOrder: { customerId } },
            { customsRequest: { customerId } },
            { freightRequest: { customerId } },
          ],
          status: { in: ['sent', 'countered', 'amended'] },
        },
      }),
    ]);

    const recentOrders = await this.prisma.logisticsOrder.findMany({
      where: { customerId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        customsRequests: { take: 1, select: { status: true, referenceNumber: true } },
        freightRequests: { take: 1, select: { status: true, referenceNumber: true } },
      },
    });

    return { counts: { orders, customs, freight, shipments, bookings, pendingQuotes: quotes }, recentOrders };
  }
}
