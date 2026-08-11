import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';
import { FleetOwnershipService } from '../fleet/fleet-ownership.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';

import type { SendMessageDto } from './dto/messaging.dto';

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: FleetOwnershipService,
    private readonly notifications: NotificationDeliveryService,
  ) {}

  async listConversations(user: User) {
    const where =
      user.role === UserRole.CUSTOMER
        ? { customerId: user.id }
        : user.role === UserRole.FLEET_OWNER
          ? { fleetUserId: user.id }
          : {};

    return this.prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async listMessages(user: User, conversationId: string, page = 1) {
    await this.assertConversationAccess(user, conversationId);
    const limit = 50;
    const skip = (page - 1) * limit;

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    });

    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return messages;
  }

  async sendMessage(user: User, conversationId: string, body: string) {
    await this.assertConversationAccess(user, conversationId);

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        body,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { customerId: true, fleetUserId: true, shipmentId: true },
    });
    if (conversation) {
      const recipientUserId =
        user.id === conversation.customerId ? conversation.fleetUserId : conversation.customerId;
      let reference = `Conversation`;
      if (conversation.shipmentId) {
        const shipment = await this.prisma.shipment.findUnique({
          where: { id: conversation.shipmentId },
          select: { referenceNumber: true },
        });
        reference = shipment?.referenceNumber ?? reference;
      }
      void this.notifications.safeNotifyMessagingMessage({
        conversationId,
        recipientUserId,
        senderUserId: user.id,
        reference,
        conversationPath: `/${user.locale ?? 'ar'}/messages/${conversationId}`,
      });
    }

    return message;
  }

  async openConversation(user: User, dto: SendMessageDto) {
    let fleetOwnerId = dto.fleetOwnerId;
    let customerId = user.id;
    let fleetUserId: string | undefined;

    if (user.role === UserRole.FLEET_OWNER) {
      const fleetOwner = await this.ownership.resolveFleetOwnerScope(user);
      if (!fleetOwner) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
      }
      fleetOwnerId = fleetOwner.id;
      fleetUserId = user.id;
      if (!dto.quoteId && !dto.bookingId && !dto.shipmentId) {
        throw new ForbiddenException({
          code: 'CUSTOMER_REQUIRED',
          message_en: 'Fleet users must open conversations from a quote, booking, or shipment context.',
          message_ar: 'يجب على مالك الأسطول فتح المحادثات من سياق عرض أو حجز أو شحنة.',
        });
      }
    }

    if (dto.quoteId) {
      const quote = await this.prisma.truckQuoteRequest.findUniqueOrThrow({
        where: { id: dto.quoteId },
        include: { truckListing: { select: { fleetOwnerId: true, fleetOwner: { select: { userId: true } } } } },
      });
      fleetOwnerId = quote.truckListing.fleetOwnerId;
      fleetUserId = quote.truckListing.fleetOwner.userId;
      customerId = quote.customerId;
    }

    if (dto.bookingId) {
      const booking = await this.prisma.truckBooking.findUniqueOrThrow({
        where: { id: dto.bookingId },
        include: { fleetOwner: { select: { id: true, userId: true } } },
      });
      fleetOwnerId = booking.fleetOwner.id;
      fleetUserId = booking.fleetOwner.userId;
      customerId = booking.customerId;
    }

    if (dto.shipmentId) {
      const shipment = await this.prisma.shipment.findUniqueOrThrow({
        where: { id: dto.shipmentId },
        include: { fleetOwner: { select: { id: true, userId: true } } },
      });
      if (!shipment.fleetOwner) {
        throw new NotFoundException({ code: 'FLEET_NOT_ASSIGNED', message_en: 'No fleet assigned.', message_ar: 'لم يُعيَّن أسطول.' });
      }
      fleetOwnerId = shipment.fleetOwner.id;
      fleetUserId = shipment.fleetOwner.userId;
      customerId = shipment.customerId;
    }

    if (!fleetOwnerId || !fleetUserId) {
      throw new NotFoundException({ code: 'CONTEXT_REQUIRED', message_en: 'Context required.', message_ar: 'السياق مطلوب.' });
    }

    if (user.role === UserRole.CUSTOMER && customerId !== user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
    }

    const contextType = dto.quoteId ? 'quote' : dto.bookingId ? 'booking' : dto.shipmentId ? 'shipment' : 'general';

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        customerId,
        fleetOwnerId,
        quoteId: dto.quoteId ?? undefined,
        bookingId: dto.bookingId ?? undefined,
        shipmentId: dto.shipmentId ?? undefined,
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contextType,
          quoteId: dto.quoteId,
          bookingId: dto.bookingId,
          shipmentId: dto.shipmentId,
          customerId,
          fleetUserId,
          fleetOwnerId,
          lastMessageAt: new Date(),
        },
      });
    }

    if (dto.body?.trim()) {
      await this.sendMessage(user, conversation.id, dto.body.trim());
    }

    return conversation;
  }

  private async assertConversationAccess(user: User, conversationId: string) {
    if (user.role === UserRole.ADMIN) return;

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Conversation not found.', message_ar: 'المحادثة غير موجودة.' });
    }

    const allowed =
      (user.role === UserRole.CUSTOMER && conversation.customerId === user.id) ||
      (user.role === UserRole.FLEET_OWNER && conversation.fleetUserId === user.id);

    if (!allowed) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
    }
  }
}
