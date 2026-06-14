import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PayoutRequestStatus } from '@prisma/client';
import type { User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import type { PrismaService } from '../../database/prisma.service';
import type { FleetOwnershipService } from '../fleet/fleet-ownership.service';
import type { WalletLedgerService } from '../wallets/wallet-ledger.service';

import { PayoutStateService } from './payout-state.service';
import { PayoutsService } from './payouts.service';

describe('PayoutsService', () => {
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

  const fleetOwnership = {
    requireFleetOwner: jest.fn(),
  };

  const ledger = {
    getOrCreateWallet: jest.fn(),
    debit: jest.fn(),
  };

  const prisma = {
    $transaction: jest.fn(),
    payoutRequest: {
      create: jest.fn(),
      findFirst: jest.fn(),
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

  let service: PayoutsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PayoutsService(
      prisma as unknown as PrismaService,
      fleetOwnership as unknown as FleetOwnershipService,
      ledger as unknown as WalletLedgerService,
      new PayoutStateService(),
    );
  });

  it('rejects payout creation for non-fleet-owner users', async () => {
    const customer = { ...fleetOwnerUser, role: 'customer' as const };

    await expect(
      service.createRequest(customer, {
        amount: 100,
        bankDetails: {
          accountHolderName: 'Fleet Co',
          bankName: 'Bank',
          iban: 'SA1234567890123456789012',
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a pending payout request when balance is available', async () => {
    fleetOwnership.requireFleetOwner.mockResolvedValue({ id: 'fleet-1' });
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
      id: 'payout-1',
      walletId: 'wallet-1',
      userId: fleetOwnerUser.id,
      amount: new Decimal('100.00'),
      currency: 'SAR',
      bankDetails: { iban: 'SA1234567890123456789012' },
      status: PayoutRequestStatus.pending,
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
      walletTransactionId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      reviewedBy: null,
    });

    const result = await service.createRequest(fleetOwnerUser, {
      amount: 100,
      bankDetails: {
        accountHolderName: 'Fleet Co',
        bankName: 'Bank',
        iban: 'SA1234567890123456789012',
      },
    });

    expect(result.status).toBe('pending');
    expect(result.amount).toBe('100.00');
  });

  it('rejects payout creation when available balance is insufficient', async () => {
    fleetOwnership.requireFleetOwner.mockResolvedValue({ id: 'fleet-1' });
    ledger.getOrCreateWallet.mockResolvedValue({
      id: 'wallet-1',
      userId: fleetOwnerUser.id,
      balance: new Decimal('100.00'),
    });
    prisma.payoutRequest.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('80.00') },
    });
    prisma.wallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      balance: new Decimal('100.00'),
    });

    await expect(
      service.createRequest(fleetOwnerUser, {
        amount: 50,
        bankDetails: {
          accountHolderName: 'Fleet Co',
          bankName: 'Bank',
          iban: 'SA1234567890123456789012',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approves a pending payout request', async () => {
    prisma.payoutRequest.findUnique.mockResolvedValue({
      id: 'payout-1',
      walletId: 'wallet-1',
      userId: fleetOwnerUser.id,
      amount: new Decimal('100.00'),
      status: PayoutRequestStatus.pending,
    });
    prisma.wallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      balance: new Decimal('500.00'),
    });
    prisma.payoutRequest.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('0.00') },
    });
    prisma.payoutRequest.update.mockResolvedValue({
      id: 'payout-1',
      walletId: 'wallet-1',
      userId: fleetOwnerUser.id,
      amount: new Decimal('100.00'),
      currency: 'SAR',
      bankDetails: {},
      status: PayoutRequestStatus.approved,
      reviewedById: adminUser.id,
      reviewedAt: new Date('2026-01-02T00:00:00.000Z'),
      rejectionReason: null,
      walletTransactionId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      reviewedBy: { id: adminUser.id, email: adminUser.email },
      user: { id: fleetOwnerUser.id, email: fleetOwnerUser.email, role: 'fleet_owner' },
    });

    const result = await service.approve(adminUser, 'payout-1');

    expect(result.status).toBe('approved');
    expect(result.reviewedById).toBe(adminUser.id);
  });
});
