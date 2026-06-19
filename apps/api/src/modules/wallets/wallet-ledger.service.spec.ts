import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WalletTransactionType } from '@transit-logistic/shared';

import type { PrismaService } from '../../database/prisma.service';

import { WalletLedgerService } from './wallet-ledger.service';

describe('WalletLedgerService', () => {
  const wallet = {
    id: 'wallet-1',
    userId: 'user-1',
    balance: new Prisma.Decimal(100),
    currency: 'SAR',
    updatedAt: new Date(),
  };

  const createTx = () => ({
    $queryRaw: jest.fn().mockResolvedValue([{ id: wallet.id }]),
    walletTransaction: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'tx-1',
        type: WalletTransactionType.ADJUSTMENT,
        amount: new Prisma.Decimal(10),
        balanceAfter: new Prisma.Decimal(110),
        idempotencyKey: 'key-1',
        description: 'test',
        createdAt: new Date(),
      }),
    },
    wallet: {
      update: jest.fn().mockResolvedValue({
        ...wallet,
        balance: new Prisma.Decimal(110),
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        ...wallet,
        balance: new Prisma.Decimal(90),
      }),
      upsert: jest.fn().mockResolvedValue(wallet),
    },
  });

  let prisma: { $transaction: jest.Mock };
  let service: WalletLedgerService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (callback: (tx: ReturnType<typeof createTx>) => unknown) =>
        callback(createTx()),
      ),
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(createTx()));
    service = new WalletLedgerService(prisma as unknown as PrismaService);
  });

  it('rejects non-positive amounts', async () => {
    await expect(
      service.credit({
        walletId: wallet.id,
        amount: 0,
        type: WalletTransactionType.ADJUSTMENT,
        idempotencyKey: 'zero-amount',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('credits a wallet inside a transaction', async () => {
    const tx = createTx();

    const result = await service.credit(
      {
        walletId: wallet.id,
        amount: 10,
        type: WalletTransactionType.ADJUSTMENT,
        idempotencyKey: 'credit-1',
      },
      tx as never,
    );

    expect(result.transaction.amount).toBe('10');
    expect(tx.wallet.update).toHaveBeenCalled();
    expect(tx.walletTransaction.create).toHaveBeenCalled();
  });

  it('returns the existing transaction for duplicate idempotency keys', async () => {
    const existing = {
      wallet,
      id: 'tx-existing',
      type: WalletTransactionType.ADJUSTMENT,
      amount: new Prisma.Decimal(10),
      balanceAfter: new Prisma.Decimal(110),
      idempotencyKey: 'duplicate-key',
      description: null,
      createdAt: new Date(),
    };

    const tx = createTx();
    tx.walletTransaction.findUnique.mockResolvedValue(existing);

    const result = await service.debit(
      {
        walletId: wallet.id,
        amount: 10,
        type: WalletTransactionType.SHIPMENT_PAYMENT,
        idempotencyKey: 'duplicate-key',
      },
      tx as never,
    );

    expect(result.transaction.id).toBe('tx-existing');
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it('detects unique constraint collisions', () => {
    expect(service.isUniqueConstraintError({ code: 'P2002' })).toBe(true);
    expect(service.isUniqueConstraintError(new Error('other'))).toBe(false);
  });
});
