/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, VehicleType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { PrismaService } from '../../database/prisma.service';

import { type EstimatePricingDto } from './dto/estimate-pricing.dto';
import {
  type DistanceBasedPricingConfig,
  isDistanceBasedPricingConfig,
} from './pricing-config.types';
import { calculateRouteDistanceKm, type PricingCoordinate } from './pricing-distance.util';
import { DEFAULT_PRICING_CONFIG, PRICING_RULE_TYPES } from './pricing.constants';

export interface PricingBreakdown {
  ruleType: string;
  pricingRuleId: string | null;
  pricingRuleName: string | null;
  distanceKm: number;
  vehicleType: VehicleType | null;
  vehicleMultiplier: number;
  baseFare: string;
  distanceCharge: string;
  subtotalBeforeMinimum: string;
  minimumFare: string;
  subtotal: string;
  platformFeePercent: number;
  platformFee: string;
  totalAmount: string;
}

export interface PricingEstimateResult {
  pricingRuleId: string | null;
  baseAmount: Decimal;
  platformFee: Decimal;
  totalAmount: Decimal;
  breakdown: PricingBreakdown;
}

@Injectable()
export class PricingEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async estimate(dto: EstimatePricingDto): Promise<PricingEstimateResult> {
    return this.calculate({
      stops: dto.stops,
      vehicleType: dto.vehicleType,
      pricingRuleId: dto.pricingRuleId,
    });
  }

  async calculate(input: {
    stops: PricingCoordinate[];
    vehicleType?: VehicleType;
    pricingRuleId?: string;
  }): Promise<PricingEstimateResult> {
    if (input.stops.length < 2) {
      throw new BadRequestException('At least two stops are required for pricing');
    }

    const rule = await this.resolveRule(input.pricingRuleId);
    const config = this.resolveConfig(rule);
    const distanceKm = calculateRouteDistanceKm(input.stops);
    const vehicleType = input.vehicleType ?? null;
    const vehicleMultiplier = this.resolveVehicleMultiplier(config, vehicleType);

    const baseFare = new Decimal(config.baseFare);
    const distanceCharge = new Decimal(distanceKm).mul(config.perKmRate).mul(vehicleMultiplier);
    const subtotalBeforeMinimum = baseFare.add(distanceCharge);
    const minimumFare = new Decimal(config.minimumFare);
    const subtotal = Decimal.max(subtotalBeforeMinimum, minimumFare);
    const platformFee = subtotal.mul(config.platformFeePercent).div(100);
    const totalAmount = subtotal.add(platformFee);

    const breakdown: PricingBreakdown = {
      ruleType: PRICING_RULE_TYPES.DISTANCE_BASED,
      pricingRuleId: rule?.id ?? null,
      pricingRuleName: rule?.name ?? 'Default pricing',
      distanceKm: Number(distanceKm.toFixed(3)),
      vehicleType,
      vehicleMultiplier,
      baseFare: baseFare.toFixed(2),
      distanceCharge: distanceCharge.toFixed(2),
      subtotalBeforeMinimum: subtotalBeforeMinimum.toFixed(2),
      minimumFare: minimumFare.toFixed(2),
      subtotal: subtotal.toFixed(2),
      platformFeePercent: config.platformFeePercent,
      platformFee: platformFee.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
    };

    return {
      pricingRuleId: rule?.id ?? null,
      baseAmount: subtotal,
      platformFee,
      totalAmount,
      breakdown,
    };
  }

  private async resolveRule(pricingRuleId?: string) {
    if (pricingRuleId) {
      const rule = await this.prisma.pricingRule.findUnique({
        where: { id: pricingRuleId },
      });

      if (!rule) {
        throw new NotFoundException('Pricing rule not found');
      }

      if (!rule.isActive) {
        throw new BadRequestException('Pricing rule is not active');
      }

      if (rule.ruleType !== PRICING_RULE_TYPES.DISTANCE_BASED) {
        throw new BadRequestException('Unsupported pricing rule type');
      }

      return rule;
    }

    return this.prisma.pricingRule.findFirst({
      where: {
        isActive: true,
        ruleType: PRICING_RULE_TYPES.DISTANCE_BASED,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private resolveConfig(rule: { config: Prisma.JsonValue; name: string } | null): DistanceBasedPricingConfig {
    if (!rule) {
      return {
        ...DEFAULT_PRICING_CONFIG,
        vehicleMultipliers: { ...DEFAULT_PRICING_CONFIG.vehicleMultipliers },
      };
    }

    if (!isDistanceBasedPricingConfig(rule.config)) {
      throw new BadRequestException(`Pricing rule "${rule.name}" has invalid configuration`);
    }

    const config = rule.config;

    return {
      baseFare: config.baseFare,
      perKmRate: config.perKmRate,
      minimumFare: config.minimumFare,
      platformFeePercent: config.platformFeePercent,
      vehicleMultipliers: {
        ...DEFAULT_PRICING_CONFIG.vehicleMultipliers,
        ...config.vehicleMultipliers,
      },
    };
  }

  private resolveVehicleMultiplier(
    config: DistanceBasedPricingConfig,
    vehicleType: VehicleType | null,
  ): number {
    if (!vehicleType) {
      return 1;
    }

    return config.vehicleMultipliers[vehicleType] ?? 1;
  }
}
