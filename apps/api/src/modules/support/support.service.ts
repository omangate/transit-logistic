import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';

import type {
  AddTicketMessageDto,
  CreateSupportTicketDto,
  UpdateTicketStatusDto,
} from './dto/support.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User, dto: CreateSupportTicketDto) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: dto.subject,
        description: dto.description,
        priority: dto.priority ?? 'medium',
        bookingId: dto.bookingId,
        shipmentId: dto.shipmentId,
        paymentId: dto.paymentId,
      },
    });

    await this.prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        body: dto.description,
      },
    });

    return ticket;
  }

  async listForUser(user: User) {
    const where = user.role === UserRole.ADMIN ? {} : { userId: user.id };
    return this.prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(user: User, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          where: user.role === UserRole.ADMIN ? {} : { isInternal: false },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Ticket not found.', message_ar: 'التذكرة غير موجودة.' });
    }

    if (user.role !== UserRole.ADMIN && ticket.userId !== user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
    }

    return ticket;
  }

  async addMessage(user: User, ticketId: string, dto: AddTicketMessageDto) {
    const ticket = await this.getById(user, ticketId);

    return this.prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        body: dto.body,
        isInternal: user.role === UserRole.ADMIN && dto.body.startsWith('[internal]'),
      },
    });
  }

  async updateStatus(user: User, ticketId: string, dto: UpdateTicketStatusDto) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Admin only.', message_ar: 'للمسؤول فقط.' });
    }

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: dto.status,
        resolvedAt: dto.status === 'resolved' || dto.status === 'closed' ? new Date() : null,
      },
    });
  }
}
