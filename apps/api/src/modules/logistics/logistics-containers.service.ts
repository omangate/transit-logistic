import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@/types/user';
import type { ContainerRecordStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { LogisticsAccessService } from './logistics-access.service';
import { LogisticsAuditService } from './logistics-audit.service';

@Injectable()
export class LogisticsContainersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LogisticsAccessService,
    private readonly audit: LogisticsAuditService,
  ) {}

  async list(user: User, input: { logisticsOrderId?: string; customsRequestId?: string; freightRequestId?: string }) {
    await this.assertContextAccess(user, input);
    return this.prisma.containerRecord.findMany({
      where: input,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(user: User, id: string) {
    const record = await this.prisma.containerRecord.findUniqueOrThrow({ where: { id } });
    await this.assertContextAccess(user, {
      logisticsOrderId: record.logisticsOrderId ?? undefined,
      customsRequestId: record.customsRequestId ?? undefined,
      freightRequestId: record.freightRequestId ?? undefined,
    });
    return record;
  }

  async create(
    user: User,
    input: {
      logisticsOrderId?: string;
      customsRequestId?: string;
      freightRequestId?: string;
      containerNumber: string;
      size?: string;
      type?: string;
      sealNumber?: string;
      grossWeightKg?: number;
      cargoDescription?: string;
      shippingLine?: string;
      blNumber?: string;
      currentStatus?: ContainerRecordStatus;
      currentLocation?: string;
      pickupDate?: string;
      returnDate?: string;
      emptyReturnLocation?: string;
    },
  ) {
    await this.assertContextAccess(user, input);
    if (!input.logisticsOrderId && !input.customsRequestId && !input.freightRequestId) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message_en: 'Link container to a logistics order, customs request, or freight request.',
        message_ar: 'اربط الحاوية بطلب لوجستي أو تخليص أو شحن.',
      });
    }

    const record = await this.prisma.containerRecord.create({
      data: {
        logisticsOrderId: input.logisticsOrderId,
        customsRequestId: input.customsRequestId,
        freightRequestId: input.freightRequestId,
        containerNumber: input.containerNumber.trim().toUpperCase(),
        size: input.size,
        type: input.type,
        sealNumber: input.sealNumber,
        grossWeightKg: input.grossWeightKg,
        cargoDescription: input.cargoDescription,
        shippingLine: input.shippingLine,
        blNumber: input.blNumber,
        currentStatus: input.currentStatus ?? 'booked',
        currentLocation: input.currentLocation,
        pickupDate: input.pickupDate ? new Date(input.pickupDate) : undefined,
        returnDate: input.returnDate ? new Date(input.returnDate) : undefined,
        emptyReturnLocation: input.emptyReturnLocation,
      },
    });

    await this.audit.auditLog({
      actorId: user.id,
      action: 'container.created',
      entityType: 'container_record',
      entityId: record.id,
      metadata: { containerNumber: record.containerNumber },
    });

    return record;
  }

  async update(user: User, id: string, input: Record<string, unknown>) {
    const existing = await this.get(user, id);
    const record = await this.prisma.containerRecord.update({
      where: { id },
      data: {
        containerNumber: typeof input.containerNumber === 'string' ? input.containerNumber.trim().toUpperCase() : undefined,
        size: input.size as string | undefined,
        type: input.type as string | undefined,
        sealNumber: input.sealNumber as string | undefined,
        grossWeightKg: input.grossWeightKg !== undefined ? Number(input.grossWeightKg) : undefined,
        cargoDescription: input.cargoDescription as string | undefined,
        shippingLine: input.shippingLine as string | undefined,
        blNumber: input.blNumber as string | undefined,
        currentStatus: input.currentStatus as ContainerRecordStatus | undefined,
        currentLocation: input.currentLocation as string | undefined,
        pickupDate: input.pickupDate ? new Date(String(input.pickupDate)) : undefined,
        returnDate: input.returnDate ? new Date(String(input.returnDate)) : undefined,
        emptyReturnLocation: input.emptyReturnLocation as string | undefined,
      },
    });

    await this.audit.auditLog({
      actorId: user.id,
      action: 'container.updated',
      entityType: 'container_record',
      entityId: id,
      metadata: { before: existing.containerNumber, after: record.containerNumber },
    });

    return record;
  }

  async archive(user: User, id: string) {
    await this.get(user, id);
    const record = await this.prisma.containerRecord.update({
      where: { id },
      data: { currentStatus: 'empty_returned' },
    });
    await this.audit.auditLog({
      actorId: user.id,
      action: 'container.archived',
      entityType: 'container_record',
      entityId: id,
    });
    return record;
  }

  private async assertContextAccess(
    user: User,
    input: { logisticsOrderId?: string; customsRequestId?: string; freightRequestId?: string },
  ) {
    if (input.customsRequestId) await this.access.assertCustomsAccess(user, input.customsRequestId);
    if (input.freightRequestId) await this.access.assertFreightAccess(user, input.freightRequestId);
    if (input.logisticsOrderId) await this.access.assertOrderAccess(user, input.logisticsOrderId);
    if (!input.customsRequestId && !input.freightRequestId && !input.logisticsOrderId) {
      this.access.assertAdmin(user);
    }
  }
}
