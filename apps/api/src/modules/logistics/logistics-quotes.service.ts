import { BadRequestException, Injectable } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';
import type { LogisticsChargeCategory } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';

import { LogisticsAccessService } from './logistics-access.service';
import { generateLogisticsReference } from './logistics-reference.util';
import { LogisticsChargesService } from './logistics-charges.service';

type QuoteLineInput = {
  category: LogisticsChargeCategory;
  description: string;
  amount: number;
  quantity?: number;
  tax?: number;
  isCustomerVisible?: boolean;
};

@Injectable()
export class LogisticsQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LogisticsAccessService,
    private readonly notifications: NotificationDeliveryService,
    private readonly charges: LogisticsChargesService,
  ) {}

  async createQuote(
    user: User,
    input: {
      logisticsOrderId?: string;
      customsRequestId?: string;
      freightRequestId?: string;
      lines: QuoteLineInput[];
      validUntil?: string;
      internalNote?: string;
    },
  ) {
    this.access.assertAdmin(user);

    const subtotal = input.lines.reduce((sum, l) => sum + l.amount * (l.quantity ?? 1), 0);
    const taxAmount = input.lines.reduce((sum, l) => sum + (l.tax ?? 0), 0);

    const customerId = await this.resolveCustomerId(input);
    const previousQuote = await this.findLatestQuoteForContext(input);
    const nextVersion = (previousQuote?.version ?? 0) + 1;
    const isAmendment = nextVersion > 1;

    const quote = await this.prisma.logisticsQuote.create({
      data: {
        referenceNumber: generateLogisticsReference('LQ'),
        logisticsOrderId: input.logisticsOrderId,
        customsRequestId: input.customsRequestId,
        freightRequestId: input.freightRequestId,
        version: nextVersion,
        status: 'sent',
        subtotal,
        taxAmount,
        totalAmount: subtotal + taxAmount,
        validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
        internalNote: input.internalNote,
        createdById: user.id,
        lines: {
          create: input.lines.map((line, index) => ({
            category: line.category,
            description: line.description,
            amount: line.amount,
            quantity: line.quantity ?? 1,
            tax: line.tax ?? 0,
            isCustomerVisible: line.isCustomerVisible ?? true,
            sortOrder: index,
          })),
        },
      },
      include: { lines: true },
    });

    if (previousQuote && isAmendment) {
      await this.prisma.logisticsQuote.update({
        where: { id: previousQuote.id },
        data: { status: 'amended' },
      });
    }

    if (customerId) {
      if (isAmendment) {
        void this.notifications.safeNotifyLogisticsQuoteAmended(customerId, quote.id, previousQuote!.id);
      } else {
        void this.notifications.safeNotifyLogisticsQuoteIssued(customerId, quote.id);
      }
    }

    if (input.customsRequestId) {
      await this.prisma.customsClearanceRequest.update({
        where: { id: input.customsRequestId },
        data: { status: 'quotation_sent' },
      });
    }
    if (input.freightRequestId) {
      await this.prisma.freightForwardingRequest.update({
        where: { id: input.freightRequestId },
        data: { status: 'quotation_sent' },
      });
    }

    return quote;
  }

  async respond(user: User, quoteId: string, action: 'accept' | 'reject' | 'counter' | 'amend', customerNote?: string) {
    const quote = await this.prisma.logisticsQuote.findUniqueOrThrow({
      where: { id: quoteId },
      include: { customsRequest: true, freightRequest: true, logisticsOrder: true },
    });

    const customerId =
      quote.customsRequest?.customerId ?? quote.freightRequest?.customerId ?? quote.logisticsOrder?.customerId;
    if (user.role !== UserRole.ADMIN && user.id !== customerId) {
      throw new BadRequestException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
    }

    const statusMap = { accept: 'accepted', reject: 'rejected', counter: 'countered', amend: 'amended' } as const;
    const updated = await this.prisma.logisticsQuote.update({
      where: { id: quoteId },
      data: { status: statusMap[action], customerNote },
    });

    if (action === 'accept') {
      if (quote.customsRequestId) {
        await this.prisma.customsClearanceRequest.update({
          where: { id: quote.customsRequestId },
          data: { status: 'quotation_accepted' },
        });
      }
      if (quote.freightRequestId) {
        await this.prisma.freightForwardingRequest.update({
          where: { id: quote.freightRequestId },
          data: { status: 'quotation_accepted' },
        });
      }
      try {
        await this.charges.createFromQuote(user, quoteId);
      } catch {
        // Quote may not be linked to logistics order yet
      }
    }

    return updated;
  }

  async amendQuote(
    user: User,
    quoteId: string,
    input: {
      lines: QuoteLineInput[];
      validUntil?: string;
      internalNote?: string;
    },
  ) {
    this.access.assertAdmin(user);

    const existing = await this.prisma.logisticsQuote.findUniqueOrThrow({
      where: { id: quoteId },
    });

    const subtotal = input.lines.reduce((sum, l) => sum + l.amount * (l.quantity ?? 1), 0);
    const taxAmount = input.lines.reduce((sum, l) => sum + (l.tax ?? 0), 0);

    await this.prisma.logisticsQuote.update({
      where: { id: quoteId },
      data: { status: 'amended' },
    });

    const amended = await this.prisma.logisticsQuote.create({
      data: {
        referenceNumber: generateLogisticsReference('LQ'),
        logisticsOrderId: existing.logisticsOrderId,
        customsRequestId: existing.customsRequestId,
        freightRequestId: existing.freightRequestId,
        version: existing.version + 1,
        status: 'sent',
        subtotal,
        taxAmount,
        totalAmount: subtotal + taxAmount,
        validUntil: input.validUntil ? new Date(input.validUntil) : existing.validUntil ?? undefined,
        internalNote: input.internalNote ?? existing.internalNote,
        createdById: user.id,
        lines: {
          create: input.lines.map((line, index) => ({
            category: line.category,
            description: line.description,
            amount: line.amount,
            quantity: line.quantity ?? 1,
            tax: line.tax ?? 0,
            isCustomerVisible: line.isCustomerVisible ?? true,
            sortOrder: index,
          })),
        },
      },
      include: { lines: true },
    });

    const customerId = await this.resolveCustomerId({
      logisticsOrderId: existing.logisticsOrderId ?? undefined,
      customsRequestId: existing.customsRequestId ?? undefined,
      freightRequestId: existing.freightRequestId ?? undefined,
    });
    if (customerId) {
      void this.notifications.safeNotifyLogisticsQuoteAmended(customerId, amended.id, quoteId);
    }

    return amended;
  }

  async listForContext(user: User, input: { customsRequestId?: string; freightRequestId?: string; logisticsOrderId?: string }) {
    if (input.customsRequestId) await this.access.assertCustomsAccess(user, input.customsRequestId);
    if (input.freightRequestId) await this.access.assertFreightAccess(user, input.freightRequestId);
    if (input.logisticsOrderId) await this.access.assertOrderAccess(user, input.logisticsOrderId);

    return this.prisma.logisticsQuote.findMany({
      where: input,
      include: { lines: true },
      orderBy: { version: 'desc' },
    });
  }

  private async resolveCustomerId(input: {
    logisticsOrderId?: string;
    customsRequestId?: string;
    freightRequestId?: string;
  }) {
    if (input.customsRequestId) {
      const r = await this.prisma.customsClearanceRequest.findUnique({ where: { id: input.customsRequestId } });
      return r?.customerId;
    }
    if (input.freightRequestId) {
      const r = await this.prisma.freightForwardingRequest.findUnique({ where: { id: input.freightRequestId } });
      return r?.customerId;
    }
    if (input.logisticsOrderId) {
      const r = await this.prisma.logisticsOrder.findUnique({ where: { id: input.logisticsOrderId } });
      return r?.customerId;
    }
    return undefined;
  }

  private async findLatestQuoteForContext(input: {
    logisticsOrderId?: string;
    customsRequestId?: string;
    freightRequestId?: string;
  }) {
    return this.prisma.logisticsQuote.findFirst({
      where: {
        logisticsOrderId: input.logisticsOrderId ?? undefined,
        customsRequestId: input.customsRequestId ?? undefined,
        freightRequestId: input.freightRequestId ?? undefined,
        status: { in: ['sent', 'countered', 'amended'] },
      },
      orderBy: { version: 'desc' },
    });
  }
}
