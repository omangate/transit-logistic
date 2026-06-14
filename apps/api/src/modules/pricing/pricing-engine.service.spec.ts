import { BadRequestException } from '@nestjs/common';
import { VehicleType } from '@prisma/client';

import type { PrismaService } from '../../database/prisma.service';

import { PricingEngineService } from './pricing-engine.service';
import { DEFAULT_PRICING_CONFIG } from './pricing.constants';

describe('PricingEngineService', () => {
  const prisma = {
    pricingRule: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  let service: PricingEngineService;

  const riyadhPickup = { latitude: 24.7136, longitude: 46.6753, sequence: 1 };
  const riyadhDelivery = { latitude: 24.7743, longitude: 46.7386, sequence: 2 };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.pricingRule.findFirst.mockResolvedValue(null);
    prisma.pricingRule.findUnique.mockResolvedValue(null);
    service = new PricingEngineService(prisma as unknown as PrismaService);
  });

  it('calculates distance-based pricing with default config', async () => {
    const result = await service.calculate({
      stops: [riyadhPickup, riyadhDelivery],
    });

    expect(result.pricingRuleId).toBeNull();
    expect(result.baseAmount.toNumber()).toBeGreaterThanOrEqual(DEFAULT_PRICING_CONFIG.minimumFare);
    expect(result.platformFee.toNumber()).toBeGreaterThan(0);
    expect(result.totalAmount.toNumber()).toBeGreaterThan(result.baseAmount.toNumber());
    expect(result.breakdown.ruleType).toBe('distance_based');
    expect(result.breakdown.distanceKm).toBeGreaterThan(0);
  });

  it('applies vehicle type multiplier', async () => {
    const baseline = await service.calculate({
      stops: [riyadhPickup, riyadhDelivery],
    });

    const refrigerated = await service.calculate({
      stops: [riyadhPickup, riyadhDelivery],
      vehicleType: VehicleType.refrigerated,
    });

    expect(refrigerated.totalAmount.toNumber()).toBeGreaterThan(baseline.totalAmount.toNumber());
    expect(refrigerated.breakdown.vehicleMultiplier).toBe(
      DEFAULT_PRICING_CONFIG.vehicleMultipliers.refrigerated,
    );
  });

  it('enforces minimum fare when distance charge is low', async () => {
    const result = await service.calculate({
      stops: [
        { latitude: 24.7136, longitude: 46.6753, sequence: 1 },
        { latitude: 24.7137, longitude: 46.6754, sequence: 2 },
      ],
    });

    expect(result.baseAmount.toNumber()).toBe(DEFAULT_PRICING_CONFIG.minimumFare);
    expect(result.breakdown.subtotal).toBe(DEFAULT_PRICING_CONFIG.minimumFare.toFixed(2));
  });

  it('uses an active pricing rule when provided by id', async () => {
    prisma.pricingRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      name: 'Premium',
      ruleType: 'distance_based',
      isActive: true,
      config: {
        baseFare: 100,
        perKmRate: 5,
        minimumFare: 150,
        platformFeePercent: 12,
        vehicleMultipliers: { flatbed: 1 },
      },
    });

    const result = await service.calculate({
      stops: [riyadhPickup, riyadhDelivery],
      pricingRuleId: 'rule-1',
    });

    expect(result.pricingRuleId).toBe('rule-1');
    expect(result.breakdown.pricingRuleName).toBe('Premium');
    expect(result.breakdown.platformFeePercent).toBe(12);
  });

  it('rejects inactive pricing rules', async () => {
    prisma.pricingRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      name: 'Inactive',
      ruleType: 'distance_based',
      isActive: false,
      config: DEFAULT_PRICING_CONFIG,
    });

    await expect(
      service.calculate({
        stops: [riyadhPickup, riyadhDelivery],
        pricingRuleId: 'rule-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires at least two stops', async () => {
    await expect(
      service.calculate({
        stops: [riyadhPickup],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
