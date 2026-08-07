import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';

import { LogisticsAccessService } from './logistics-access.service';

@Injectable()
export class LogisticsConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LogisticsAccessService,
  ) {}

  async getOrCreate(
    user: User,
    input: { logisticsOrderId?: string; customsRequestId?: string; freightRequestId?: string; quoteId?: string },
  ) {
    let customerId = user.id;
    if (input.customsRequestId) {
      const req = await this.access.assertCustomsAccess(user, input.customsRequestId);
      customerId = req.customerId;
    }
    if (input.freightRequestId) {
      const req = await this.access.assertFreightAccess(user, input.freightRequestId);
      customerId = req.customerId;
    }
    if (input.logisticsOrderId) {
      const order = await this.access.assertOrderAccess(user, input.logisticsOrderId);
      customerId = order.customerId;
    }

    let conversation = await this.prisma.logisticsConversation.findFirst({
      where: {
        customerId,
        logisticsOrderId: input.logisticsOrderId ?? undefined,
        customsRequestId: input.customsRequestId ?? undefined,
        freightRequestId: input.freightRequestId ?? undefined,
        quoteId: input.quoteId ?? undefined,
      },
    });

    if (!conversation) {
      conversation = await this.prisma.logisticsConversation.create({
        data: {
          customerId,
          logisticsOrderId: input.logisticsOrderId,
          customsRequestId: input.customsRequestId,
          freightRequestId: input.freightRequestId,
          quoteId: input.quoteId,
          lastMessageAt: new Date(),
        },
      });
    }

    return conversation;
  }

  async listMessages(user: User, conversationId: string) {
    await this.assertAccess(user, conversationId);
    return this.prisma.logisticsMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async sendMessage(user: User, conversationId: string, body: string) {
    await this.assertAccess(user, conversationId);

    const message = await this.prisma.logisticsMessage.create({
      data: { conversationId, senderId: user.id, body },
    });

    await this.prisma.logisticsConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  private async assertAccess(user: User, conversationId: string) {
    const conversation = await this.prisma.logisticsConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Conversation not found.', message_ar: 'المحادثة غير موجودة.' });
    }
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.CUSTOMER && conversation.customerId === user.id) return;
    throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
  }
}
