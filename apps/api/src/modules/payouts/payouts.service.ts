/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayoutRequestStatus,
  Prisma,
  WalletTransactionType,
  type PayoutRequest,
  type User,
} from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';
import { FleetOwnershipService } from '../fleet/fleet-ownership.service';
import { WalletLedgerService } from '../wallets/wallet-ledger.service';

import { type AdminPayoutQueryDto } from './dto/admin-payout-query.dto';
import { type CreatePayoutRequestDto } from './dto/create-payout-request.dto';
import { type PayoutQueryDto } from './dto/payout-query.dto';
import { type RejectPayoutDto } from './dto/reject-payout.dto';
import { PayoutStateService } from './payout-state.service';
import {
  fromApiPayoutStatus,
  RESERVED_PAYOUT_STATUSES,
  toApiPayoutStatus,
  type PayoutApiStatus,
} from './payout-status.util';

type PayoutWithRelations = PayoutRequest & {
  reviewedBy?: { id: string; email: string } | null;
};

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fleetOwnership: FleetOwnershipService,
    private readonly ledger: WalletLedgerService,
    private readonly payoutState: PayoutStateService,
  ) {}

  async createRequest(user: User, dto: CreatePayoutRequestDto) {
    this.assertFleetOwner(user);
    await this.fleetOwnership.requireFleetOwner(user);

    const wallet = await this.ledger.getOrCreateWallet(user.id);
    const amount = new PrismaNamespace.Decimal(dto.amount);

    await this.assertSufficientAvailableBalance(wallet.id, user.id, amount);

    const payout = await this.prisma.payoutRequest.create({
      data: {
        walletId: wallet.id,
        userId: user.id,
        amount,
        bankDetails: dto.bankDetails as unknown as Prisma.InputJsonValue,
        status: PayoutRequestStatus.pending,
      },
      include: this.defaultInclude(),
    });

    return this.toResponse(payout);
  }

  async listMyPayouts(user: User, query: PayoutQueryDto) {
    this.assertFleetOwner(user);

    return this.listPayouts(
      {
        userId: user.id,
        ...(query.status ? { status: fromApiPayoutStatus(query.status) } : {}),
      },
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  async getMyPayout(user: User, payoutId: string) {
    this.assertFleetOwner(user);

    const payout = await this.prisma.payoutRequest.findFirst({
      where: { id: payoutId, userId: user.id },
      include: this.defaultInclude(),
    });

    if (!payout) {
      throw new NotFoundException({
        code: 'PAYOUT_NOT_FOUND',
        message_en: 'Payout request not found.',
        message_ar: 'طلب السحب غير موجود.',
      });
    }

    return this.toResponse(payout);
  }

  async getMySummary(user: User) {
    this.assertFleetOwner(user);

    return this.buildSummary({ userId: user.id });
  }

  async adminList(query: AdminPayoutQueryDto) {
    const where: Prisma.PayoutRequestWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: fromApiPayoutStatus(query.status) } : {}),
    };

    return this.listPayouts(where, query.page ?? 1, query.limit ?? 20, true);
  }

  async adminGetById(payoutId: string) {
    const payout = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutId },
      include: this.adminInclude(),
    });

    if (!payout) {
      throw new NotFoundException({
        code: 'PAYOUT_NOT_FOUND',
        message_en: 'Payout request not found.',
        message_ar: 'طلب السحب غير موجود.',
      });
    }

    return this.toResponse(payout, true);
  }

  async adminSummary() {
    return this.buildSummary();
  }

  async approve(admin: User, payoutId: string) {
    const payout = await this.getPayoutForReview(payoutId);

    this.payoutState.assertTransition(payout.status, PayoutRequestStatus.approved);
    await this.assertSufficientAvailableBalance(
      payout.walletId,
      payout.userId,
      payout.amount,
      payout.id,
    );

    const updated = await this.prisma.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: PayoutRequestStatus.approved,
        reviewedById: admin.id,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
      include: this.adminInclude(),
    });

    return this.toResponse(updated, true);
  }

  async reject(admin: User, payoutId: string, dto: RejectPayoutDto) {
    const payout = await this.getPayoutForReview(payoutId);

    if (
      payout.status !== PayoutRequestStatus.pending &&
      payout.status !== PayoutRequestStatus.approved
    ) {
      throw new BadRequestException({
        code: 'INVALID_PAYOUT_STATUS_TRANSITION',
        message_en: `Cannot reject payout in ${payout.status} status.`,
        message_ar: `لا يمكن رفض طلب السحب في حالة ${payout.status}.`,
      });
    }

    const updated = await this.prisma.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: PayoutRequestStatus.rejected,
        reviewedById: admin.id,
        reviewedAt: new Date(),
        rejectionReason: dto.rejectionReason,
      },
      include: this.adminInclude(),
    });

    return this.toResponse(updated, true);
  }

  async markPaid(admin: User, payoutId: string) {
    const payout = await this.getPayoutForReview(payoutId);

    this.payoutState.assertTransition(payout.status, PayoutRequestStatus.processed);

    if (payout.walletTransactionId) {
      throw new BadRequestException({
        code: 'PAYOUT_ALREADY_PAID',
        message_en: 'Payout has already been marked as paid.',
        message_ar: 'تم بالفعل وضع علامة مدفوع على طلب السحب.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.payoutRequest.findUniqueOrThrow({
        where: { id: payoutId },
      });

      if (locked.status !== PayoutRequestStatus.approved) {
        throw new BadRequestException({
          code: 'INVALID_PAYOUT_STATUS_TRANSITION',
          message_en: 'Only approved payout requests can be marked as paid.',
          message_ar: 'يمكن وضع علامة مدفوع فقط على طلبات السحب المعتمدة.',
        });
      }

      const ledgerResult = await this.ledger.debit(
        {
          walletId: locked.walletId,
          amount: locked.amount,
          type: WalletTransactionType.payout,
          idempotencyKey: `payout-process-${locked.id}`,
          description: `Payout request ${locked.id}`,
          referenceType: 'payout_request',
          referenceId: locked.id,
        },
        tx,
      );

      return tx.payoutRequest.update({
        where: { id: payoutId },
        data: {
          status: PayoutRequestStatus.processed,
          reviewedById: admin.id,
          reviewedAt: new Date(),
          walletTransactionId: ledgerResult.transaction.id,
        },
        include: this.adminInclude(),
      });
    });

    return this.toResponse(updated, true);
  }

  private async listPayouts(
    where: Prisma.PayoutRequestWhereInput,
    page: number,
    limit: number,
    includeAdminFields = false,
  ) {
    const skip = (page - 1) * limit;

    const [payouts, total] = await this.prisma.$transaction([
      this.prisma.payoutRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: includeAdminFields ? this.adminInclude() : this.defaultInclude(),
      }),
      this.prisma.payoutRequest.count({ where }),
    ]);

    return {
      data: payouts.map((payout) => this.toResponse(payout, includeAdminFields)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async buildSummary(where: Prisma.PayoutRequestWhereInput = {}) {
    const groups = await this.prisma.payoutRequest.groupBy({
      by: ['status'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });

    const totals: Record<PayoutApiStatus, { count: number; amount: string }> = {
      pending: { count: 0, amount: '0.00' },
      approved: { count: 0, amount: '0.00' },
      rejected: { count: 0, amount: '0.00' },
      paid: { count: 0, amount: '0.00' },
    };

    for (const group of groups) {
      const apiStatus = toApiPayoutStatus(group.status);
      totals[apiStatus] = {
        count: group._count._all,
        amount: (group._sum.amount ?? new PrismaNamespace.Decimal(0)).toFixed(2),
      };
    }

    return { totals };
  }

  private async getPayoutForReview(payoutId: string) {
    const payout = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundException({
        code: 'PAYOUT_NOT_FOUND',
        message_en: 'Payout request not found.',
        message_ar: 'طلب السحب غير موجود.',
      });
    }

    return payout;
  }

  private async assertSufficientAvailableBalance(
    walletId: string,
    userId: string,
    requestedAmount: PrismaNamespace.Decimal,
    excludePayoutId?: string,
  ) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException({
        code: 'WALLET_NOT_FOUND',
        message_en: 'Wallet not found.',
        message_ar: 'المحفظة غير موجودة.',
      });
    }

    const reserved = await this.getReservedAmount(userId, excludePayoutId);
    const available = wallet.balance.minus(reserved);

    if (available.lessThan(requestedAmount)) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_AVAILABLE_BALANCE',
        message_en: 'Insufficient available wallet balance for this payout request.',
        message_ar: 'رصيد المحفظة المتاح غير كافٍ لطلب السحب هذا.',
      });
    }
  }

  private async getReservedAmount(userId: string, excludePayoutId?: string) {
    const aggregate = await this.prisma.payoutRequest.aggregate({
      where: {
        userId,
        status: { in: RESERVED_PAYOUT_STATUSES },
        ...(excludePayoutId ? { id: { not: excludePayoutId } } : {}),
      },
      _sum: { amount: true },
    });

    return aggregate._sum.amount ?? new PrismaNamespace.Decimal(0);
  }

  private assertFleetOwner(user: User) {
    if (user.role !== UserRole.FLEET_OWNER) {
      throw new ForbiddenException({
        code: 'PAYOUT_ACCESS_DENIED',
        message_en: 'Payout requests are only available to fleet owners.',
        message_ar: 'طلبات السحب متاحة فقط لأصحاب الأساطيل.',
      });
    }
  }

  private defaultInclude() {
    return {
      reviewedBy: {
        select: { id: true, email: true },
      },
    };
  }

  private adminInclude() {
    return {
      ...this.defaultInclude(),
      user: {
        select: { id: true, email: true, role: true },
      },
    };
  }

  private toResponse(payout: PayoutWithRelations & { user?: { id: string; email: string; role: string } }, includeUser = false) {
    return {
      id: payout.id,
      walletId: payout.walletId,
      userId: payout.userId,
      amount: payout.amount.toFixed(2),
      currency: payout.currency,
      bankDetails: payout.bankDetails,
      status: toApiPayoutStatus(payout.status),
      reviewedById: payout.reviewedById,
      reviewedAt: payout.reviewedAt?.toISOString() ?? null,
      rejectionReason: payout.rejectionReason,
      walletTransactionId: payout.walletTransactionId,
      createdAt: payout.createdAt.toISOString(),
      updatedAt: payout.updatedAt.toISOString(),
      reviewedBy: payout.reviewedBy
        ? { id: payout.reviewedBy.id, email: payout.reviewedBy.email }
        : null,
      ...(includeUser && payout.user
        ? {
            user: {
              id: payout.user.id,
              email: payout.user.email,
              role: payout.user.role,
            },
          }
        : {}),
    };
  }
}
