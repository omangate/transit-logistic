import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@/types/user';
import type { CustomsTransactionType, FreightTransportMode, LogisticsDocumentCategory } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { LogisticsAccessService } from './logistics-access.service';
import { LogisticsAuditService } from './logistics-audit.service';

type TemplateItemInput = {
  documentCategory: LogisticsDocumentCategory;
  required?: boolean;
  sortOrder?: number;
};

@Injectable()
export class ChecklistTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LogisticsAccessService,
    private readonly audit: LogisticsAuditService,
  ) {}

  list(user: User) {
    this.access.assertAdmin(user);
    return this.prisma.documentChecklistTemplate.findMany({
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  get(user: User, id: string) {
    this.access.assertAdmin(user);
    return this.prisma.documentChecklistTemplate.findUniqueOrThrow({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async create(
    user: User,
    input: {
      nameEn: string;
      nameAr: string;
      transactionType?: CustomsTransactionType;
      transportMode?: FreightTransportMode;
      serviceType?: string;
      cargoType?: string;
      isActive?: boolean;
      items?: TemplateItemInput[];
    },
  ) {
    this.access.assertAdmin(user);
    const template = await this.prisma.documentChecklistTemplate.create({
      data: {
        nameEn: input.nameEn,
        nameAr: input.nameAr,
        transactionType: input.transactionType,
        transportMode: input.transportMode,
        serviceType: input.serviceType,
        cargoType: input.cargoType,
        isActive: input.isActive ?? true,
        items: input.items?.length
          ? {
              create: input.items.map((item, index) => ({
                documentCategory: item.documentCategory,
                required: item.required ?? true,
                sortOrder: item.sortOrder ?? index,
              })),
            }
          : undefined,
      },
      include: { items: true },
    });

    await this.audit.auditLog({
      actorId: user.id,
      action: 'checklist_template.created',
      entityType: 'document_checklist_template',
      entityId: template.id,
      metadata: { nameEn: template.nameEn },
    });

    return template;
  }

  async update(
    user: User,
    id: string,
    input: {
      nameEn?: string;
      nameAr?: string;
      transactionType?: CustomsTransactionType | null;
      transportMode?: FreightTransportMode | null;
      serviceType?: string | null;
      cargoType?: string | null;
      isActive?: boolean;
    },
  ) {
    this.access.assertAdmin(user);
    const template = await this.prisma.documentChecklistTemplate.update({
      where: { id },
      data: {
        nameEn: input.nameEn,
        nameAr: input.nameAr,
        transactionType: input.transactionType === null ? null : input.transactionType,
        transportMode: input.transportMode === null ? null : input.transportMode,
        serviceType: input.serviceType === null ? null : input.serviceType,
        cargoType: input.cargoType === null ? null : input.cargoType,
        isActive: input.isActive,
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.audit.auditLog({
      actorId: user.id,
      action: 'checklist_template.updated',
      entityType: 'document_checklist_template',
      entityId: id,
      metadata: input as Record<string, unknown>,
    });

    return template;
  }

  async setActive(user: User, id: string, isActive: boolean) {
    return this.update(user, id, { isActive });
  }

  async replaceItems(user: User, templateId: string, items: TemplateItemInput[]) {
    this.access.assertAdmin(user);
    await this.prisma.documentChecklistTemplate.findUniqueOrThrow({ where: { id: templateId } });
    await this.prisma.documentChecklistTemplateItem.deleteMany({ where: { templateId } });
    await this.prisma.documentChecklistTemplateItem.createMany({
      data: items.map((item, index) => ({
        templateId,
        documentCategory: item.documentCategory,
        required: item.required ?? true,
        sortOrder: item.sortOrder ?? index,
      })),
    });

    await this.audit.auditLog({
      actorId: user.id,
      action: 'checklist_template.items_replaced',
      entityType: 'document_checklist_template',
      entityId: templateId,
      metadata: { itemCount: items.length },
    });

    return this.get(user, templateId);
  }

  async remove(user: User, id: string) {
    this.access.assertAdmin(user);
    const existing = await this.prisma.documentChecklistTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Template not found.', message_ar: 'القالب غير موجود.' });
    }
    await this.prisma.documentChecklistTemplate.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.auditLog({
      actorId: user.id,
      action: 'checklist_template.deactivated',
      entityType: 'document_checklist_template',
      entityId: id,
    });
    return { ok: true };
  }
}
