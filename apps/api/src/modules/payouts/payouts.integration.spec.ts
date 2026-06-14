import { PayoutRequestStatus, WalletTransactionType } from '@prisma/client';
import type { User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import type { PrismaService } from '../../database/prisma.service';
import type { FleetOwnershipService } from '../fleet/fleet-ownership.service';
import type { WalletLedgerService } from '../wallets/wallet-ledger.service';

import { PayoutStateService } from './payout-state.service';
import { PayoutsService } from './payouts.service';

describe('Payouts integration', () => {
  const fleetOwnerUser: User = {
    id: 'fleet-user-1',
    email: 'fleet@example.com',
    phone: null,
    passwordHash: 'hash',
    role: 'fleet_owner',
    locale: 'en',
    isActive: true,
    isVerified: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminUser: User = {
    ...fleetOwnerUser,
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'admin',
  };

  const prisma = {
    $transaction: jest.fn(),
    payoutRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
    },
  };

  const fleetOwnership = {
    requireFleetOwner: jest.fn().mockResolvedValue({ id: 'fleet-1' }),
  };

  const ledger = {
    getOrCreateWallet: jest.fn(),
    debit: jest.fn(),
  };

  let service: PayoutsService;

  const payoutRecord = {
    id: 'payout-1',
    walletId: 'wallet-1',
    userId: fleetOwnerUser.id,
    amount: new Decimal('150.00'),
    currency: 'SAR',
    bankDetails: {
      accountHolderName: 'Fleet Co',
      bankName: 'Bank',
      iban: 'SA1234567890123456789012',
    },
    status: PayoutRequestStatus.pending,
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    walletTransactionId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    reviewedBy: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fleetOwnership.requireFleetOwner.mockResolvedValue({ id: 'fleet-1' });
    service = new PayoutsService(
      prisma as unknown as PrismaService,
      fleetOwnership as unknown as FleetOwnershipService,
      ledger as unknown as WalletLedgerService,
      new PayoutStateService(),
    );
  });

  it('runs request, approval, and paid workflow with wallet transaction link', async () => {
    ledger.getOrCreateWallet.mockResolvedValue({
      id: 'wallet-1',
      userId: fleetOwnerUser.id,
      balance: new Decimal('500.00'),
    });
    prisma.payoutRequest.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('0.00') },
    });
    prisma.wallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      balance: new Decimal('500.00'),
    });
    prisma.payoutRequest.create.mockResolvedValue({
      ...payoutRecord,
      reviewedBy: null,
    });

    const created = await service.createRequest(fleetOwnerUser, {
      amount: 150,
      bankDetails: payoutRecord.bankDetails,
    });

    prisma.payoutRequest.findUnique.mockResolvedValue({
      ...payoutRecord,
      status: PayoutRequestStatus.pending,
    });
    prisma.payoutRequest.update.mockResolvedValueOnce({
      ...payoutRecord,
      status: PayoutRequestStatus.approved,
      reviewedById: adminUser.id,
      reviewedAt: new Date('2026-01-02T00:00:00.000Z'),
      reviewedBy: { id: adminUser.id, email: adminUser.email },
      user: {
        id: fleetOwnerUser.id,
        email: fleetOwnerUser.email,
        role: 'fleet_owner',
      },
    });

    const approved = await service.approve(adminUser, 'payout-1');

    prisma.payoutRequest.findUnique.mockResolvedValue({
      ...payoutRecord,
      status: PayoutRequestStatus.approved,
    });
    prisma.payoutRequest.findUniqueOrThrow.mockResolvedValue({
      ...payoutRecord,
      status: PayoutRequestStatus.approved,
    });
    ledger.debit.mockResolvedValue({
      wallet: {
        id: 'wallet-1',
        userId: fleetOwnerUser.id,
        balance: '350.00',
        currency: 'SAR',
        updatedAt: new Date(),
      },
      transaction: {
        id: 'tx-1',
        type: WalletTransactionType.payout,
        amount: '150.00',
        balanceAfter: '350.00',
        idempotencyKey: 'payout-process-payout-1',
        description: 'Payout request payout-1',
        createdAt: new Date(),
      },
    });
    prisma.payoutRequest.update.mockResolvedValueOnce({
      ...payoutRecord,
      status: PayoutRequestStatus.processed,
      reviewedById: adminUser.id,
      reviewedAt: new Date('2026-01-03T00:00:00.000Z'),
      walletTransactionId: 'tx-1',
      reviewedBy: { id: adminUser.id, email: adminUser.email },
      user: {
        id: fleetOwnerUser.id,
        email: fleetOwnerUser.email,
        role: 'fleet_owner',
      },
    });
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
    );

    const paid = await service.markPaid(adminUser, 'payout-1');

    expect(created.status).toBe('pending');
    expect(approved.status).toBe('approved');
    expect(paid.status).toBe('paid');
    expect(paid.walletTransactionId).toBe('tx-1');
    expect(ledger.debit).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 'wallet-1',
        type: WalletTransactionType.payout,
        referenceType: 'payout_request',
        referenceId: 'payout-1',
      }),
      prisma,
    );
  });

  it('builds admin summary totals by status', async () => {
    prisma.payoutRequest.groupBy.mockResolvedValue([
      {
        status: PayoutRequestStatus.pending,
        _sum: { amount: new Decimal('100.00') },
        _count: { _all: 1 },
      },
      {
        status: PayoutRequestStatus.approved,
        _sum: { amount: new Decimal('200.00') },
        _count: { _all: 2 },
      },
      {
        status: PayoutRequestStatus.processed,
        _sum: { amount: new Decimal('300.00') },
        _count: { _all: 3 },
      },
    ]);

    const summary = await service.adminSummary();

    expect(summary.totals.pending).toEqual({ count: 1, amount: '100.00' });
    expect(summary.totals.approved).toEqual({ count: 2, amount: '200.00' });
    expect(summary.totals.paid).toEqual({ count: 3, amount: '300.00' });
    expect(summary.totals.rejected).toEqual({ count: 0, amount: '0.00' });
  });
});
