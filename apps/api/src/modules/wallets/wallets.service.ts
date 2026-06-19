/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, WalletTransactionType } from '@transit-logistic/shared';
import type { User } from '@/types/user';

import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';

import type { AdminWalletOperationDto } from './dto/admin-wallet-operation.dto';
import type { TransactionQueryDto } from './dto/transaction-query.dto';
import { WalletLedgerService } from './wallet-ledger.service';

const WALLET_ELIGIBLE_ROLES: UserRole[] = [
  UserRole.CUSTOMER,
  UserRole.FLEET_OWNER,
  UserRole.DRIVER,
];

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: WalletLedgerService,
    private readonly notificationDelivery: NotificationDeliveryService,
  ) {}

  async getMyWallet(user: User) {
    this.assertWalletEligible(user);

    const wallet = await this.ledger.getOrCreateWallet(user.id);

    return {
      id: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance.toString(),
      currency: wallet.currency,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  async getMyTransactions(user: User, query: TransactionQueryDto) {
    this.assertWalletEligible(user);

    const wallet = await this.ledger.getOrCreateWallet(user.id);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.walletTransaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

    return {
      data: transactions.map((tx) => this.toTransactionResponse(tx)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async adminCredit(dto: AdminWalletOperationDto) {
    const targetUser = await this.resolveTargetUser(dto.userId);
    const wallet = await this.ledger.getOrCreateWallet(targetUser.id);

    const result = await this.ledger.credit({
      walletId: wallet.id,
      amount: dto.amount,
      type: WalletTransactionType.ADJUSTMENT,
      idempotencyKey: dto.idempotencyKey,
      description: dto.description ?? 'Admin credit',
      referenceType: 'admin_adjustment',
    });

    void this.notificationDelivery.safeNotifyWalletTransaction({
      userId: targetUser.id,
      transactionId: result.transaction.id,
      transactionType: result.transaction.type,
      amount: result.transaction.amount,
      balanceAfter: result.transaction.balanceAfter,
      referenceType: 'admin_adjustment',
    });

    return result;
  }

  async adminDebit(dto: AdminWalletOperationDto) {
    const targetUser = await this.resolveTargetUser(dto.userId);
    const wallet = await this.ledger.getOrCreateWallet(targetUser.id);

    const result = await this.ledger.debit({
      walletId: wallet.id,
      amount: dto.amount,
      type: WalletTransactionType.ADJUSTMENT,
      idempotencyKey: dto.idempotencyKey,
      description: dto.description ?? 'Admin debit',
      referenceType: 'admin_adjustment',
    });

    void this.notificationDelivery.safeNotifyWalletTransaction({
      userId: targetUser.id,
      transactionId: result.transaction.id,
      transactionType: result.transaction.type,
      amount: result.transaction.amount,
      balanceAfter: result.transaction.balanceAfter,
      referenceType: 'admin_adjustment',
    });

    return result;
  }

  private assertWalletEligible(user: User) {
    if (!WALLET_ELIGIBLE_ROLES.includes(user.role)) {
      throw new BadRequestException({
        code: 'WALLET_NOT_AVAILABLE',
        message_en: 'Wallets are not available for your account role.',
        message_ar: 'المحافظ غير متاحة لدور حسابك.',
      });
    }
  }

  private async resolveTargetUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message_en: 'User not found.',
        message_ar: 'المستخدم غير موجود.',
      });
    }

    if (!WALLET_ELIGIBLE_ROLES.includes(user.role)) {
      throw new BadRequestException({
        code: 'WALLET_NOT_AVAILABLE',
        message_en: 'Wallets are only available for customer, fleet owner, and driver accounts.',
        message_ar: 'المحافظ متاحة فقط لحسابات العملاء وأصحاب الأساطيل والسائقين.',
      });
    }

    if (!user.isActive) {
      throw new BadRequestException({
        code: 'USER_INACTIVE',
        message_en: 'Cannot perform wallet operations for an inactive user.',
        message_ar: 'لا يمكن إجراء عمليات المحفظة لمستخدم غير نشط.',
      });
    }

    return user;
  }

  private toTransactionResponse(tx: {
    id: string;
    type: WalletTransactionType;
    amount: { toString(): string };
    balanceAfter: { toString(): string };
    referenceType: string | null;
    referenceId: string | null;
    idempotencyKey: string;
    description: string | null;
    createdAt: Date;
  }) {
    return {
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toString(),
      balanceAfter: tx.balanceAfter.toString(),
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      idempotencyKey: tx.idempotencyKey,
      description: tx.description,
      createdAt: tx.createdAt,
    };
  }
}
