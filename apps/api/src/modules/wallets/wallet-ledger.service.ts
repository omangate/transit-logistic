/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Wallet } from '@prisma/client';
import { WalletTransactionType } from '@transit-logistic/shared';
import { Prisma as PrismaNamespace } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

export interface LedgerOperationResult {
  wallet: {
    id: string;
    userId: string;
    balance: string;
    currency: string;
    updatedAt: Date;
  };
  transaction: {
    id: string;
    type: WalletTransactionType;
    amount: string;
    balanceAfter: string;
    idempotencyKey: string;
    description: string | null;
    createdAt: Date;
  };
}

export type LedgerMutationParams = {
  walletId: string;
  amount: PrismaNamespace.Decimal | number;
  type: WalletTransactionType;
  idempotencyKey: string;
  description?: string;
  referenceType?: string;
  referenceId?: string;
};

type BalanceChangeParams = LedgerMutationParams & {
  direction: 'credit' | 'debit';
};

@Injectable()
export class WalletLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async credit(
    params: LedgerMutationParams,
    tx?: Prisma.TransactionClient,
  ): Promise<LedgerOperationResult> {
    return this.mutateBalance({ ...params, direction: 'credit' }, tx);
  }

  async debit(
    params: LedgerMutationParams,
    tx?: Prisma.TransactionClient,
  ): Promise<LedgerOperationResult> {
    return this.mutateBalance({ ...params, direction: 'debit' }, tx);
  }

  async getOrCreateWallet(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Wallet> {
    const client = tx ?? this.prisma;
    return client.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async hasTransaction(
    idempotencyKey: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const existing = await this.findTransactionByIdempotencyKey(idempotencyKey, tx);
    return existing !== null;
  }

  private async mutateBalance(
    params: BalanceChangeParams,
    existingTx?: Prisma.TransactionClient,
  ): Promise<LedgerOperationResult> {
    const amount = new PrismaNamespace.Decimal(params.amount);

    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message_en: 'Amount must be greater than zero.',
        message_ar: 'يجب أن يكون المبلغ أكبر من صفر.',
      });
    }

    if (existingTx) {
      return this.executeBalanceChange(existingTx, params, amount);
    }

    const existing = await this.findTransactionByIdempotencyKey(params.idempotencyKey);
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.$transaction(async (tx) =>
        this.executeBalanceChange(tx, params, amount),
      );
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const replay = await this.findTransactionByIdempotencyKey(params.idempotencyKey);
        if (replay) {
          return replay;
        }
      }
      throw error;
    }
  }

  private async executeBalanceChange(
    tx: Prisma.TransactionClient,
    params: BalanceChangeParams,
    amount: PrismaNamespace.Decimal,
  ): Promise<LedgerOperationResult> {
    const existing = await this.findTransactionByIdempotencyKey(params.idempotencyKey, tx);
    if (existing) {
      return existing;
    }

    const lockResult = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM wallets WHERE id = ${params.walletId}::uuid FOR UPDATE
    `;

    if (lockResult.length === 0) {
      throw new NotFoundException({
        code: 'WALLET_NOT_FOUND',
        message_en: 'Wallet not found.',
        message_ar: 'المحفظة غير موجودة.',
      });
    }

    const existingAfterLock = await this.findTransactionByIdempotencyKey(
      params.idempotencyKey,
      tx,
    );
    if (existingAfterLock) {
      return existingAfterLock;
    }

    const updatedWallet = await this.applyAtomicBalanceChange(
      tx,
      params.walletId,
      amount,
      params.direction,
    );

    try {
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: params.walletId,
          type: params.type,
          amount,
          balanceAfter: updatedWallet.balance,
          idempotencyKey: params.idempotencyKey,
          description: params.description,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
        },
      });

      return this.toLedgerResult(updatedWallet, transaction);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const replay = await this.findTransactionByIdempotencyKey(params.idempotencyKey, tx);
        if (replay) {
          return replay;
        }
      }
      throw error;
    }
  }

  private async applyAtomicBalanceChange(
    tx: Prisma.TransactionClient,
    walletId: string,
    amount: PrismaNamespace.Decimal,
    direction: 'credit' | 'debit',
  ) {
    if (direction === 'credit') {
      return tx.wallet.update({
        where: { id: walletId },
        data: { balance: { increment: amount } },
      });
    }

    const debitResult = await tx.wallet.updateMany({
      where: {
        id: walletId,
        balance: { gte: amount },
      },
      data: {
        balance: { decrement: amount },
      },
    });

    if (debitResult.count === 0) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_BALANCE',
        message_en: 'Insufficient wallet balance.',
        message_ar: 'رصيد المحفظة غير كافٍ.',
      });
    }

    return tx.wallet.findUniqueOrThrow({
      where: { id: walletId },
    });
  }

  private async findTransactionByIdempotencyKey(
    idempotencyKey: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<LedgerOperationResult | null> {
    const existing = await tx.walletTransaction.findUnique({
      where: { idempotencyKey },
      include: { wallet: true },
    });

    if (!existing) {
      return null;
    }

    return this.toLedgerResult(existing.wallet, existing);
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }

  private toLedgerResult(
    wallet: {
      id: string;
      userId: string;
      balance: PrismaNamespace.Decimal;
      currency: string;
      updatedAt: Date;
    },
    transaction: {
      id: string;
      type: WalletTransactionType;
      amount: PrismaNamespace.Decimal;
      balanceAfter: PrismaNamespace.Decimal;
      idempotencyKey: string;
      description: string | null;
      createdAt: Date;
    },
  ): LedgerOperationResult {
    return {
      wallet: {
        id: wallet.id,
        userId: wallet.userId,
        balance: wallet.balance.toString(),
        currency: wallet.currency,
        updatedAt: wallet.updatedAt,
      },
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount.toString(),
        balanceAfter: transaction.balanceAfter.toString(),
        idempotencyKey: transaction.idempotencyKey,
        description: transaction.description,
        createdAt: transaction.createdAt,
      },
    };
  }
}
