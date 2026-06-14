export const PRICING_RULE_TYPES = {
  DISTANCE_BASED: 'distance_based',
} as const;

export type PricingRuleType = (typeof PRICING_RULE_TYPES)[keyof typeof PRICING_RULE_TYPES];

export const DEFAULT_PRICING_CONFIG = {
  baseFare: 25,
  perKmRate: 2.5,
  minimumFare: 40,
  platformFeePercent: 10,
  vehicleMultipliers: {
    flatbed: 1,
    refrigerated: 1.25,
    container: 1.4,
    tanker: 1.5,
    other: 1.1,
  },
} as const;
