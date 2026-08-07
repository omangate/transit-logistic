import { BadRequestException, Injectable } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';
import type { FreightTransportMode, FreightServiceType, FreightRouteType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';

import { LogisticsAccessService } from './logistics-access.service';
import { LogisticsAuditService } from './logistics-audit.service';
import { generateLogisticsReference } from './logistics-reference.util';

@Injectable()
export class FreightForwardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LogisticsAccessService,
    private readonly audit: LogisticsAuditService,
    private readonly notifications: NotificationDeliveryService,
  ) {}

  async listForUser(user: User) {
    const where =
      user.role === UserRole.ADMIN ? {} : user.role === UserRole.CUSTOMER ? { customerId: user.id } : { id: 'none' };
    return this.prisma.freightForwardingRequest.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getById(user: User, id: string) {
    await this.access.assertFreightAccess(user, id);
    return this.prisma.freightForwardingRequest.findUniqueOrThrow({
      where: { id },
      include: {
        documents: true,
        quotes: { include: { lines: true }, orderBy: { version: 'desc' } },
        containers: true,
        checklistItems: true,
        statusHistory: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, email: true } } } },
        originRegion: true,
        destinationRegion: true,
        logisticsOrder: { select: { id: true, referenceNumber: true, title: true } },
      },
    });
  }

  async createDraft(
    user: User,
    input: {
      logisticsOrderId?: string;
      transportMode: FreightTransportMode;
      serviceType?: FreightServiceType;
      routeType?: FreightRouteType;
    },
  ) {
    if (user.role !== UserRole.CUSTOMER && user.role !== UserRole.ADMIN) {
      throw new BadRequestException({ code: 'FORBIDDEN', message_en: 'Customers only.', message_ar: 'للعملاء فقط.' });
    }

    const request = await this.prisma.freightForwardingRequest.create({
      data: {
        referenceNumber: generateLogisticsReference('FF'),
        customerId: user.id,
        logisticsOrderId: input.logisticsOrderId,
        transportMode: input.transportMode,
        serviceType: input.serviceType,
        routeType: input.routeType ?? 'origin_destination',
        status: 'draft',
      },
    });

    await this.audit.recordStatusChange({
      entityType: 'freight_forwarding',
      status: 'draft',
      actorId: user.id,
      freightRequestId: request.id,
      logisticsOrderId: input.logisticsOrderId,
    });

    return request;
  }

  async update(user: User, id: string, input: Record<string, unknown>) {
    await this.access.assertFreightAccess(user, id);
    return this.prisma.freightForwardingRequest.update({ where: { id }, data: input as never });
  }

  async submit(user: User, id: string) {
    const request = await this.access.assertFreightAccess(user, id);
    if (request.status !== 'draft') {
      throw new BadRequestException({ code: 'INVALID_STATUS', message_en: 'Only drafts can be submitted.', message_ar: 'يمكن إرسال المسودات فقط.' });
    }

    const updated = await this.prisma.freightForwardingRequest.update({
      where: { id },
      data: { status: 'submitted' },
    });

    await this.audit.recordStatusChange({
      entityType: 'freight_forwarding',
      status: 'submitted',
      actorId: user.id,
      freightRequestId: id,
      logisticsOrderId: request.logisticsOrderId ?? undefined,
    });

    void this.notifications.safeNotifyFreightStatusChanged(request.customerId, id, 'submitted');

    return updated;
  }

  async updateStatus(user: User, id: string, status: string, note?: string) {
    this.access.assertAdmin(user);
    const request = await this.prisma.freightForwardingRequest.findUniqueOrThrow({ where: { id } });

    const updated = await this.prisma.freightForwardingRequest.update({
      where: { id },
      data: { status: status as never },
    });

    await this.audit.recordStatusChange({
      entityType: 'freight_forwarding',
      status,
      actorId: user.id,
      freightRequestId: id,
      logisticsOrderId: request.logisticsOrderId ?? undefined,
      note,
    });

    void this.notifications.safeNotifyFreightStatusChanged(request.customerId, id, status);

    return updated;
  }
}
