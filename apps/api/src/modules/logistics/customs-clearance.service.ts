import { BadRequestException, Injectable } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';
import type { CustomsTransactionType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';

import { LogisticsAccessService } from './logistics-access.service';
import { LogisticsAuditService } from './logistics-audit.service';
import { generateLogisticsReference } from './logistics-reference.util';

type CargoLineInput = {
  description: string;
  hsCode?: string;
  packageCount?: number;
  packageType?: string;
  grossWeightKg?: number;
  netWeightKg?: number;
  volumeCbm?: number;
  cargoValue?: number;
  currency?: string;
  containerCount?: number;
  containerType?: string;
  isReefer?: boolean;
  isDangerousGoods?: boolean;
  isVehicleCargo?: boolean;
  isGeneralCargo?: boolean;
  isBulkCargo?: boolean;
  isProjectCargo?: boolean;
};

@Injectable()
export class CustomsClearanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LogisticsAccessService,
    private readonly audit: LogisticsAuditService,
    private readonly notifications: NotificationDeliveryService,
  ) {}

  async listForUser(user: User) {
    const where =
      user.role === UserRole.ADMIN ? {} : user.role === UserRole.CUSTOMER ? { customerId: user.id } : { id: 'none' };
    return this.prisma.customsClearanceRequest.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { documents: true, cargoLines: true } } },
    });
  }

  async getById(user: User, id: string) {
    await this.access.assertCustomsAccess(user, id);
    return this.prisma.customsClearanceRequest.findUniqueOrThrow({
      where: { id },
      include: {
        cargoLines: { orderBy: { sortOrder: 'asc' } },
        documents: true,
        quotes: { include: { lines: true }, orderBy: { version: 'desc' } },
        containers: true,
        vehicleShipments: true,
        checklistItems: true,
        statusHistory: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, email: true } } } },
        portOfLoadingRegion: true,
        portOfDischargeRegion: true,
        logisticsOrder: { select: { id: true, referenceNumber: true, title: true } },
      },
    });
  }

  async createDraft(user: User, input: { logisticsOrderId?: string; transactionType: CustomsTransactionType }) {
    if (user.role !== UserRole.CUSTOMER && user.role !== UserRole.ADMIN) {
      throw new BadRequestException({ code: 'FORBIDDEN', message_en: 'Customers only.', message_ar: 'للعملاء فقط.' });
    }

    const request = await this.prisma.customsClearanceRequest.create({
      data: {
        referenceNumber: generateLogisticsReference('CC'),
        customerId: user.id,
        logisticsOrderId: input.logisticsOrderId,
        transactionType: input.transactionType,
        status: 'draft',
      },
    });

    await this.audit.recordStatusChange({
      entityType: 'customs_clearance',
      status: 'draft',
      actorId: user.id,
      customsRequestId: request.id,
      logisticsOrderId: input.logisticsOrderId,
    });

    await this.seedChecklist(request.id, input.transactionType);

    void this.notifications.safeNotifyCustomsCreated(user.id, request.id, request.referenceNumber);

    return request;
  }

  async update(user: User, id: string, input: Record<string, unknown>) {
    await this.access.assertCustomsAccess(user, id);
    const { cargoLines, ...data } = input as Record<string, unknown> & { cargoLines?: CargoLineInput[] };

    const updated = await this.prisma.customsClearanceRequest.update({
      where: { id },
      data: data as never,
    });

    if (Array.isArray(cargoLines)) {
      await this.prisma.customsCargoLine.deleteMany({ where: { customsRequestId: id } });
      await this.prisma.customsCargoLine.createMany({
        data: cargoLines.map((line, index) => ({
          customsRequestId: id,
          sortOrder: index,
          description: line.description,
          hsCode: line.hsCode,
          packageCount: line.packageCount,
          packageType: line.packageType,
          grossWeightKg: line.grossWeightKg,
          netWeightKg: line.netWeightKg,
          volumeCbm: line.volumeCbm,
          cargoValue: line.cargoValue,
          currency: line.currency ?? 'OMR',
          containerCount: line.containerCount,
          containerType: line.containerType,
          isReefer: line.isReefer ?? false,
          isDangerousGoods: line.isDangerousGoods ?? false,
          isVehicleCargo: line.isVehicleCargo ?? false,
          isGeneralCargo: line.isGeneralCargo ?? true,
          isBulkCargo: line.isBulkCargo ?? false,
          isProjectCargo: line.isProjectCargo ?? false,
        })),
      });
    }

    return updated;
  }

  async submit(user: User, id: string) {
    const request = await this.access.assertCustomsAccess(user, id);
    if (request.status !== 'draft') {
      throw new BadRequestException({ code: 'INVALID_STATUS', message_en: 'Only drafts can be submitted.', message_ar: 'يمكن إرسال المسودات فقط.' });
    }

    const updated = await this.prisma.customsClearanceRequest.update({
      where: { id },
      data: { status: 'submitted' },
    });

    await this.audit.recordStatusChange({
      entityType: 'customs_clearance',
      status: 'submitted',
      actorId: user.id,
      customsRequestId: id,
      logisticsOrderId: request.logisticsOrderId ?? undefined,
      note: 'Submitted for review',
    });

    void this.notifications.safeNotifyCustomsStatusChanged(request.customerId, id, 'submitted');

    return updated;
  }

  async updateStatus(user: User, id: string, status: string, note?: string) {
    this.access.assertAdmin(user);
    const request = await this.prisma.customsClearanceRequest.findUniqueOrThrow({ where: { id } });

    const updated = await this.prisma.customsClearanceRequest.update({
      where: { id },
      data: { status: status as never },
    });

    await this.audit.recordStatusChange({
      entityType: 'customs_clearance',
      status,
      actorId: user.id,
      customsRequestId: id,
      logisticsOrderId: request.logisticsOrderId ?? undefined,
      note,
    });

    if (request.logisticsOrderId) {
      await this.audit.recordStatusChange({
        entityType: 'logistics_order',
        status: `customs:${status}`,
        actorId: user.id,
        logisticsOrderId: request.logisticsOrderId,
        note,
      });
    }

    void this.notifications.safeNotifyCustomsStatusChanged(request.customerId, id, status);

    return updated;
  }

  async opsDashboard(user: User) {
    this.access.assertAdmin(user);

    const statuses = await this.prisma.customsClearanceRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const recent = await this.prisma.customsClearanceRequest.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        customer: { select: { id: true, email: true, customerProfile: { select: { fullName: true } } } },
      },
    });

    const awaitingDocs = await this.prisma.customsClearanceRequest.count({
      where: { status: { in: ['documents_missing', 'documents_under_review'] } },
    });

    return { statusCounts: statuses, recent, awaitingDocs };
  }

  async search(user: User, q: string) {
    this.access.assertAdmin(user);
    const query = q.trim();
    if (!query) return [];

    return this.prisma.customsClearanceRequest.findMany({
      where: {
        OR: [
          { referenceNumber: { contains: query, mode: 'insensitive' } },
          { billOfLadingNumber: { contains: query, mode: 'insensitive' } },
          { declarationNumber: { contains: query, mode: 'insensitive' } },
          { shipmentReference: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 30,
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async seedChecklist(customsRequestId: string, transactionType: CustomsTransactionType) {
    const template = await this.prisma.documentChecklistTemplate.findFirst({
      where: { isActive: true, OR: [{ transactionType }, { transactionType: null }] },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!template?.items.length) {
      const defaults = ['commercial_invoice', 'packing_list', 'bill_of_lading'] as const;
      await this.prisma.documentChecklistItem.createMany({
        data: defaults.map((cat) => ({
          customsRequestId,
          documentCategory: cat,
          status: 'required',
        })),
      });
      return;
    }

    await this.prisma.documentChecklistItem.createMany({
      data: template.items.map((item) => ({
        customsRequestId,
        templateItemId: item.id,
        documentCategory: item.documentCategory,
        status: item.required ? 'required' : 'missing',
      })),
    });
  }
}
