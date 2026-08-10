import { BadRequestException, Injectable } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';
import type { LogisticsChargeCategory, LogisticsChargePaymentStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { LogisticsAccessService } from './logistics-access.service';
import { LogisticsAuditService } from './logistics-audit.service';

@Injectable()
export class LogisticsChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LogisticsAccessService,
    private readonly audit: LogisticsAuditService,
  ) {}

  async list(user: User, logisticsOrderId: string) {
    const order = await this.access.assertOrderAccess(user, logisticsOrderId);
    const where =
      user.role === UserRole.ADMIN
        ? { logisticsOrderId }
        : { logisticsOrderId, isCustomerVisible: true };

    return this.prisma.logisticsCharge.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    user: User,
    input: {
      logisticsOrderId: string;
      category: LogisticsChargeCategory;
      description: string;
      amount: number;
      currency?: string;
      quantity?: number;
      tax?: number;
      source?: string;
      paymentStatus?: LogisticsChargePaymentStatus;
      isCustomerVisible?: boolean;
      isInternal?: boolean;
      documentId?: string;
    },
  ) {
    this.access.assertAdmin(user);
    await this.access.assertOrderAccess(user, input.logisticsOrderId);

    const charge = await this.prisma.logisticsCharge.create({
      data: {
        logisticsOrderId: input.logisticsOrderId,
        category: input.category,
        description: input.description,
        amount: input.amount,
        currency: input.currency ?? 'OMR',
        quantity: input.quantity ?? 1,
        tax: input.tax ?? 0,
        source: input.source,
        paymentStatus: input.paymentStatus ?? 'unpaid',
        isCustomerVisible: input.isCustomerVisible ?? true,
        isInternal: input.isInternal ?? false,
        documentId: input.documentId,
      },
    });

    await this.audit.auditLog({
      actorId: user.id,
      action: 'logistics_charge.created',
      entityType: 'logistics_charge',
      entityId: charge.id,
      metadata: { category: charge.category, amount: charge.amount.toString() },
    });

    return charge;
  }

  async update(
    user: User,
    id: string,
    input: Partial<{
      category: LogisticsChargeCategory;
      description: string;
      amount: number;
      currency: string;
      quantity: number;
      tax: number;
      source: string;
      paymentStatus: LogisticsChargePaymentStatus;
      isCustomerVisible: boolean;
      isInternal: boolean;
      documentId: string | null;
    }>,
  ) {
    this.access.assertAdmin(user);
    const existing = await this.prisma.logisticsCharge.findUniqueOrThrow({ where: { id } });
    await this.access.assertOrderAccess(user, existing.logisticsOrderId);

    const charge = await this.prisma.logisticsCharge.update({
      where: { id },
      data: input,
    });

    await this.audit.auditLog({
      actorId: user.id,
      action: 'logistics_charge.updated',
      entityType: 'logistics_charge',
      entityId: id,
    });

    return charge;
  }

  async remove(user: User, id: string) {
    this.access.assertAdmin(user);
    const existing = await this.prisma.logisticsCharge.findUniqueOrThrow({ where: { id } });
    await this.access.assertOrderAccess(user, existing.logisticsOrderId);
    await this.prisma.logisticsCharge.delete({ where: { id } });
    await this.audit.auditLog({
      actorId: user.id,
      action: 'logistics_charge.deleted',
      entityType: 'logistics_charge',
      entityId: id,
    });
    return { ok: true };
  }

  async createFromQuote(user: User, quoteId: string) {
    this.access.assertAdmin(user);
    const quote = await this.prisma.logisticsQuote.findUniqueOrThrow({
      where: { id: quoteId },
      include: { lines: true, logisticsOrder: true, customsRequest: true, freightRequest: true },
    });

    const logisticsOrderId =
      quote.logisticsOrderId ??
      quote.customsRequest?.logisticsOrderId ??
      quote.freightRequest?.logisticsOrderId;

    if (!logisticsOrderId) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message_en: 'Quote is not linked to a logistics order.',
        message_ar: 'عرض السعر غير مرتبط بطلب لوجستي.',
      });
    }

    const charges = await this.prisma.$transaction(
      quote.lines.map((line) =>
        this.prisma.logisticsCharge.create({
          data: {
            logisticsOrderId,
            category: line.category,
            description: line.description,
            amount: line.amount,
            currency: line.currency,
            quantity: line.quantity,
            tax: line.tax,
            source: `quote:${quote.referenceNumber}`,
            paymentStatus: 'unpaid',
            isCustomerVisible: line.isCustomerVisible,
          },
        }),
      ),
    );

    return charges;
  }

  async totals(user: User, logisticsOrderId: string) {
    const charges = await this.list(user, logisticsOrderId);
    const subtotal = charges.reduce((sum, c) => sum + Number(c.amount) * Number(c.quantity), 0);
    const tax = charges.reduce((sum, c) => sum + Number(c.tax), 0);
    const paid = charges.filter((c) => c.paymentStatus === 'paid').reduce((sum, c) => sum + Number(c.amount), 0);
    return { subtotal, tax, total: subtotal + tax, paid, unpaid: subtotal + tax - paid, currency: 'OMR' };
  }
}
