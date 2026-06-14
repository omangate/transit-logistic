/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { type CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { toVehicleMultiplierRecord } from './dto/pricing-rule-config.dto';
import { type UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';
import { PRICING_RULE_TYPES } from './pricing.constants';

@Injectable()
export class PricingRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rules = await this.prisma.pricingRule.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return rules.map((rule) => this.toResponse(rule));
  }

  async getById(id: string) {
    const rule = await this.prisma.pricingRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException('Pricing rule not found');
    }

    return this.toResponse(rule);
  }

  async create(dto: CreatePricingRuleDto) {
    const rule = await this.prisma.pricingRule.create({
      data: {
        name: dto.name,
        nameAr: dto.nameAr,
        ruleType: PRICING_RULE_TYPES.DISTANCE_BASED,
        priority: dto.priority,
        isActive: dto.isActive ?? true,
        config: {
          baseFare: dto.config.baseFare,
          perKmRate: dto.config.perKmRate,
          minimumFare: dto.config.minimumFare,
          platformFeePercent: dto.config.platformFeePercent,
          vehicleMultipliers: toVehicleMultiplierRecord(dto.config.vehicleMultipliers),
        } as Prisma.InputJsonValue,
      },
    });

    return this.toResponse(rule);
  }

  async update(id: string, dto: UpdatePricingRuleDto) {
    await this.getById(id);

    const rule = await this.prisma.pricingRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.config
          ? {
              config: {
                baseFare: dto.config.baseFare,
                perKmRate: dto.config.perKmRate,
                minimumFare: dto.config.minimumFare,
                platformFeePercent: dto.config.platformFeePercent,
                vehicleMultipliers: toVehicleMultiplierRecord(dto.config.vehicleMultipliers),
              } as Prisma.InputJsonValue,
            }
          : {}),
      },
    });

    return this.toResponse(rule);
  }

  async remove(id: string) {
    await this.getById(id);

    await this.prisma.pricingRule.delete({
      where: { id },
    });

    return { deleted: true };
  }

  private toResponse(rule: {
    id: string;
    name: string;
    nameAr: string | null;
    ruleType: string;
    config: Prisma.JsonValue;
    isActive: boolean;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: rule.id,
      name: rule.name,
      nameAr: rule.nameAr,
      ruleType: rule.ruleType,
      config: rule.config,
      isActive: rule.isActive,
      priority: rule.priority,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }
}
