import { BadRequestException } from '@nestjs/common';
import { ShipmentStatus } from '@transit-logistic/shared';
import type { User } from '@/types/user';

import type { PrismaService } from '../../database/prisma.service';
import type { FleetOwnershipService } from '../fleet/fleet-ownership.service';
import type { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import type { PricingEngineService } from '../pricing/pricing-engine.service';
import type { WalletLedgerService } from '../wallets/wallet-ledger.service';

import type { ShipmentAccessService } from './shipment-access.service';
import type { ShipmentCommerceService } from './shipment-commerce.service';
import { ShipmentStateService } from './shipment-state.service';
import { ShipmentsService } from './shipments.service';

describe('ShipmentsService', () => {
  const customer: User = {
    id: 'customer-1',
    email: 'customer@example.com',
    phone: null,
    passwordHash: 'hash',
    role: 'customer',
    locale: 'en',
    isActive: true,
    isVerified: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const access = {
    assertCanView: jest.fn(),
    buildListFilter: jest.fn(),
    buildAvailableFilter: jest.fn(),
    isAdmin: jest.fn().mockReturnValue(false),
  };

  const fleetOwnership = {
    requireFleetOwner: jest.fn(),
    assertVehicleOwnership: jest.fn(),
    assertDriverOwnership: jest.fn(),
  };

  const ledger = {
    getOrCreateWallet: jest.fn(),
    debit: jest.fn(),
    credit: jest.fn(),
    hasTransaction: jest.fn(),
  };

  const notificationDelivery = {
    safeNotifyShipmentStatusChange: jest.fn(),
    safeNotifyWalletTransaction: jest.fn(),
  };

  const pricingEngine = {
    calculate: jest.fn(),
    estimate: jest.fn(),
  };

  const commerce = {
    ensureContractAndInvoice: jest.fn(),
  };

  const prisma = {
    $transaction: jest.fn(),
    shipment: {
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    shipmentStop: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    shipmentStatusHistory: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    shipmentEvent: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    priceCalculation: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    fleetOwner: {
      findUnique: jest.fn(),
    },
    vehicle: {
      findFirst: jest.fn(),
    },
    driverProfile: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  let service: ShipmentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ShipmentsService(
      prisma as unknown as PrismaService,
      access as unknown as ShipmentAccessService,
      new ShipmentStateService(),
      fleetOwnership as unknown as FleetOwnershipService,
      ledger as unknown as WalletLedgerService,
      notificationDelivery as unknown as NotificationDeliveryService,
      pricingEngine as unknown as PricingEngineService,
      commerce as unknown as ShipmentCommerceService,
    );
  });

  it('rejects shipment creation without pickup and delivery stops', async () => {
    await expect(
      service.create(customer, {
        stops: [
          {
            address: 'A',
            city: 'Riyadh',
            latitude: 24.7,
            longitude: 46.6,
            stopType: 'pickup',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects completing a shipment that is not delivered', async () => {
    access.assertCanView.mockResolvedValue({
      id: 'shipment-1',
      customerId: customer.id,
      status: ShipmentStatus.ASSIGNED,
    });

    await expect(service.complete(customer, 'shipment-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects invalid state transitions in the state service', () => {
    const state = new ShipmentStateService();

    expect(() => state.assertTransition(ShipmentStatus.DRAFT, ShipmentStatus.DELIVERED)).toThrow(
      BadRequestException,
    );
  });
});
