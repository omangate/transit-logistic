import { Injectable, Logger } from '@nestjs/common';
import { EmailDeliveryStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import type { EmailLocale } from './transactional-email.types';

@Injectable()
export class EmailDeliveryLogService {
  private readonly logger = new Logger(EmailDeliveryLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async tryClaim(input: {
    userId?: string;
    recipientEmail: string;
    eventKey: string;
    templateEvent: string;
    entityType?: string;
    entityId?: string;
    locale: EmailLocale;
    subject: string;
    provider?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string; claimed: boolean }> {
    try {
      const log = await this.prisma.emailDeliveryLog.create({
        data: {
          userId: input.userId,
          recipientEmail: input.recipientEmail.toLowerCase(),
          eventKey: input.eventKey,
          templateEvent: input.templateEvent,
          entityType: input.entityType,
          entityId: input.entityId,
          locale: input.locale,
          subject: input.subject,
          status: EmailDeliveryStatus.queued,
          provider: input.provider,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
      return { id: log.id, claimed: true };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        this.logger.debug(`Duplicate email suppressed: ${input.eventKey}`);
        return { id: '', claimed: false };
      }
      throw error;
    }
  }

  async markSent(id: string, providerMessageId?: string | null) {
    if (!id) return;
    await this.prisma.emailDeliveryLog.update({
      where: { id },
      data: {
        status: EmailDeliveryStatus.sent,
        sentAt: new Date(),
        providerMessageId: providerMessageId ?? undefined,
      },
    });
  }

  async markSkipped(id: string, reason: string) {
    if (!id) return;
    await this.prisma.emailDeliveryLog.update({
      where: { id },
      data: {
        status: EmailDeliveryStatus.skipped,
        errorCategory: 'skipped',
        errorMessage: reason.slice(0, 500),
        failedAt: new Date(),
      },
    });
  }

  async markFailed(id: string, errorCategory: string, errorMessage: string, retryCount?: number) {
    if (!id) return;
    await this.prisma.emailDeliveryLog.update({
      where: { id },
      data: {
        status: EmailDeliveryStatus.failed,
        errorCategory,
        errorMessage: errorMessage.slice(0, 500),
        failedAt: new Date(),
        ...(retryCount !== undefined ? { retryCount } : {}),
      },
    });
  }

  async incrementRetry(id: string) {
    if (!id) return 0;
    const updated = await this.prisma.emailDeliveryLog.update({
      where: { id },
      data: { retryCount: { increment: 1 } },
      select: { retryCount: true },
    });
    return updated.retryCount;
  }

  async markDeliveredByProviderMessageId(providerMessageId: string) {
    await this.prisma.emailDeliveryLog.updateMany({
      where: { providerMessageId },
      data: { status: EmailDeliveryStatus.delivered, deliveredAt: new Date() },
    });
  }

  async markBouncedByProviderMessageId(providerMessageId: string, reason?: string) {
    await this.prisma.emailDeliveryLog.updateMany({
      where: { providerMessageId },
      data: {
        status: EmailDeliveryStatus.bounced,
        failedAt: new Date(),
        errorCategory: 'bounced',
        errorMessage: reason?.slice(0, 500),
      },
    });
  }

  async markComplainedByProviderMessageId(providerMessageId: string) {
    await this.prisma.emailDeliveryLog.updateMany({
      where: { providerMessageId },
      data: { status: EmailDeliveryStatus.complained, failedAt: new Date(), errorCategory: 'complained' },
    });
  }

  async markFailedByProviderMessageId(providerMessageId: string, reason?: string) {
    await this.prisma.emailDeliveryLog.updateMany({
      where: { providerMessageId },
      data: {
        status: EmailDeliveryStatus.failed,
        failedAt: new Date(),
        errorCategory: 'provider_failed',
        errorMessage: reason?.slice(0, 500),
      },
    });
  }

  async listForAdmin(query: {
    page?: number;
    limit?: number;
    status?: EmailDeliveryStatus;
    recipientEmail?: string;
    templateEvent?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.recipientEmail
        ? { recipientEmail: { contains: query.recipientEmail.toLowerCase(), mode: 'insensitive' as const } }
        : {}),
      ...(query.templateEvent
        ? { templateEvent: { contains: query.templateEvent, mode: 'insensitive' as const } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.emailDeliveryLog.findMany({
        where,
        orderBy: { queuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          recipientEmail: true,
          templateEvent: true,
          entityType: true,
          entityId: true,
          locale: true,
          subject: true,
          status: true,
          provider: true,
          providerMessageId: true,
          retryCount: true,
          errorCategory: true,
          errorMessage: true,
          queuedAt: true,
          sentAt: true,
          deliveredAt: true,
          failedAt: true,
        },
      }),
      this.prisma.emailDeliveryLog.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        ...row,
        queuedAt: row.queuedAt.toISOString(),
        sentAt: row.sentAt?.toISOString() ?? null,
        deliveredAt: row.deliveredAt?.toISOString() ?? null,
        failedAt: row.failedAt?.toISOString() ?? null,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }
}
