import type { VehicleType } from '@prisma/client';

export interface DistanceBasedPricingConfig {
  baseFare: number;
  perKmRate: number;
  minimumFare: number;
  platformFeePercent: number;
  vehicleMultipliers: Partial<Record<VehicleType, number>>;
}

export function isDistanceBasedPricingConfig(value: unknown): value is DistanceBasedPricingConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const config = value as Record<string, unknown>;

  return (
    typeof config.baseFare === 'number' &&
    typeof config.perKmRate === 'number' &&
    typeof config.minimumFare === 'number' &&
    typeof config.platformFeePercent === 'number' &&
    typeof config.vehicleMultipliers === 'object' &&
    config.vehicleMultipliers !== null
  );
}
