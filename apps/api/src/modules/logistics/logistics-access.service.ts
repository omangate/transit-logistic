import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LogisticsAccessService {
  constructor(private readonly prisma: PrismaService) {}

  assertAdmin(user: User) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Admin access required.', message_ar: 'يتطلب صلاحيات المسؤول.' });
    }
  }

  async assertCustomsAccess(user: User, requestId: string) {
    const request = await this.prisma.customsClearanceRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Customs request not found.', message_ar: 'طلب التخليص غير موجود.' });
    }
    if (user.role === UserRole.ADMIN) return request;
    if (user.role === UserRole.CUSTOMER && request.customerId === user.id) return request;
    throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
  }

  async assertFreightAccess(user: User, requestId: string) {
    const request = await this.prisma.freightForwardingRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Freight request not found.', message_ar: 'طلب الشحن غير موجود.' });
    }
    if (user.role === UserRole.ADMIN) return request;
    if (user.role === UserRole.CUSTOMER && request.customerId === user.id) return request;
    throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
  }

  async assertOrderAccess(user: User, orderId: string) {
    const order = await this.prisma.logisticsOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Logistics order not found.', message_ar: 'طلب الخدمات اللوجستية غير موجود.' });
    }
    if (user.role === UserRole.ADMIN) return order;
    if (user.role === UserRole.CUSTOMER && order.customerId === user.id) return order;
    throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
  }
}
