import { VehicleType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import type { PrismaService } from '../../database/prisma.service';

import { PricingEngineService } from './pricing-engine.service';
import { PricingRulesService } from './pricing-rules.service';

describe('Pricing integration', () => {
  const prisma = {
    pricingRule: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let engine: PricingEngineService;
  let rules: PricingRulesService;

  const stops = [
    { latitude: 24.7136, longitude: 46.6753, sequence: 1 },
    { latitude: 24.7743, longitude: 46.7386, sequence: 2 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new PricingEngineService(prisma as unknown as PrismaService);
    rules = new PricingRulesService(prisma as unknown as PrismaService);
  });

  it('uses the highest-priority active rule for estimates', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');

    prisma.pricingRule.findFirst.mockResolvedValue({
      id: 'rule-high',
      name: 'High priority',
      ruleType: 'distance_based',
      isActive: true,
      config: {
        baseFare: 30,
        perKmRate: 3,
        minimumFare: 50,
        platformFeePercent: 8,
        vehicleMultipliers: { flatbed: 1, refrigerated: 1.2 },
      },
      createdAt,
      updatedAt: createdAt,
    });

    const estimate = await engine.estimate({
      stops,
      vehicleType: VehicleType.refrigerated,
    });

    expect(estimate.pricingRuleId).toBe('rule-high');
    expect(estimate.breakdown.baseFare).toBe('30.00');
    expect(estimate.breakdown.platformFeePercent).toBe(8);
    expect(estimate.breakdown.vehicleMultiplier).toBe(1.2);
  });

  it('admin rule lifecycle feeds shipment-style wallet estimates', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    prisma.pricingRule.create.mockResolvedValue({
      id: 'rule-created',
      name: 'Corporate',
      nameAr: null,
      ruleType: 'distance_based',
      isActive: true,
      priority: 20,
      config: {
        baseFare: 40,
        perKmRate: 4,
        minimumFare: 60,
        platformFeePercent: 10,
        vehicleMultipliers: { container: 1.5 },
      },
      createdAt,
      updatedAt,
    });

    const created = await rules.create({
      name: 'Corporate',
      priority: 20,
      config: {
        baseFare: 40,
        perKmRate: 4,
        minimumFare: 60,
        platformFeePercent: 10,
        vehicleMultipliers: { container: 1.5 },
      },
    });

    prisma.pricingRule.findUnique.mockResolvedValue({
      id: created.id,
      name: created.name,
      ruleType: 'distance_based',
      isActive: true,
      config: created.config,
    });

    const estimate = await engine.estimate({
      stops,
      pricingRuleId: created.id,
      vehicleType: VehicleType.container,
    });

    const walletBalance = new Decimal('500.00');
    const sufficient = walletBalance.greaterThanOrEqualTo(estimate.totalAmount);
    const shortfall = sufficient
      ? new Decimal(0)
      : estimate.totalAmount.minus(walletBalance);

    expect(created.name).toBe('Corporate');
    expect(estimate.pricingRuleId).toBe('rule-created');
    expect(estimate.breakdown.vehicleMultiplier).toBe(1.5);
    expect(estimate.totalAmount.toNumber()).toBeGreaterThan(0);
    expect(sufficient).toBe(true);
    expect(shortfall.toNumber()).toBe(0);
  });
});
