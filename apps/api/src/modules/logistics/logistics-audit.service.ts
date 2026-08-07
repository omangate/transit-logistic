import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LogisticsAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async recordStatusChange(input: {
    entityType: 'logistics_order' | 'customs_clearance' | 'freight_forwarding';
    status: string;
    note?: string;
    actorId?: string;
    attachmentKey?: string;
    logisticsOrderId?: string;
    customsRequestId?: string;
    freightRequestId?: string;
  }) {
    return this.prisma.logisticsStatusHistory.create({
      data: {
        entityType: input.entityType,
        status: input.status,
        note: input.note,
        actorId: input.actorId,
        attachmentKey: input.attachmentKey,
        logisticsOrderId: input.logisticsOrderId,
        customsRequestId: input.customsRequestId,
        freightRequestId: input.freightRequestId,
      },
    });
  }

  async auditLog(input: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: (input.metadata ?? {}) as never,
      },
    });
  }
}
