import { NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../database/prisma.service';

import { PricingRulesService } from './pricing-rules.service';

describe('PricingRulesService', () => {
  const prisma = {
    pricingRule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: PricingRulesService;

  const sampleRule = {
    id: 'rule-1',
    name: 'Standard',
    nameAr: null,
    ruleType: 'distance_based',
    config: {
      baseFare: 25,
      perKmRate: 2.5,
      minimumFare: 40,
      platformFeePercent: 10,
      vehicleMultipliers: { flatbed: 1 },
    },
    isActive: true,
    priority: 10,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PricingRulesService(prisma as unknown as PrismaService);
  });

  it('lists pricing rules', async () => {
    prisma.pricingRule.findMany.mockResolvedValue([sampleRule]);

    const rules = await service.list();

    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      id: 'rule-1',
      name: 'Standard',
      ruleType: 'distance_based',
      isActive: true,
    });
  });

  it('creates a distance-based pricing rule', async () => {
    prisma.pricingRule.create.mockResolvedValue(sampleRule);

    const created = await service.create({
      name: 'Standard',
      priority: 10,
      config: {
        baseFare: 25,
        perKmRate: 2.5,
        minimumFare: 40,
        platformFeePercent: 10,
        vehicleMultipliers: { flatbed: 1 },
      },
    });

    expect(prisma.pricingRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ruleType: 'distance_based',
          name: 'Standard',
        }),
      }),
    );
    expect(created.id).toBe('rule-1');
  });

  it('throws when updating a missing rule', async () => {
    prisma.pricingRule.findUnique.mockResolvedValue(null);

    await expect(
      service.update('missing', {
        name: 'Updated',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes an existing pricing rule', async () => {
    prisma.pricingRule.findUnique.mockResolvedValue(sampleRule);
    prisma.pricingRule.delete.mockResolvedValue(sampleRule);

    const result = await service.remove('rule-1');

    expect(result).toEqual({ deleted: true });
    expect(prisma.pricingRule.delete).toHaveBeenCalledWith({ where: { id: 'rule-1' } });
  });
});
