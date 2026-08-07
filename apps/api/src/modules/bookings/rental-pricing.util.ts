import { Decimal } from '@prisma/client/runtime/library';

export type RentalListingRates = {
  dailyRentalPrice: Decimal | null;
  weeklyRentalPrice: Decimal | null;
  monthlyRentalPrice: Decimal | null;
  minRentalDays: number | null;
};

export type RentalPricingResult = {
  rentalDays: number;
  dailyRate: string;
  totalAmount: string;
  currency: string;
};

function toNumber(value: Decimal | null | undefined): number | null {
  if (value == null) return null;
  return Number(value.toString());
}

export function countRentalDays(startDate: Date, endDate: Date): number {
  const start = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
  const end = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  const days = Math.round((end - start) / 86_400_000) + 1;
  return Math.max(days, 1);
}

export function calculateRentalPricing(
  listing: RentalListingRates,
  startDate: Date,
  endDate: Date,
  currency = 'OMR',
): RentalPricingResult {
  const rentalDays = countRentalDays(startDate, endDate);

  if (listing.minRentalDays && rentalDays < listing.minRentalDays) {
    throw new Error(`Minimum rental period is ${listing.minRentalDays} days`);
  }

  const daily = toNumber(listing.dailyRentalPrice);
  const weekly = toNumber(listing.weeklyRentalPrice);
  const monthly = toNumber(listing.monthlyRentalPrice);

  let total = 0;
  let effectiveDaily = daily;

  if (monthly != null && rentalDays >= 30) {
    const months = Math.floor(rentalDays / 30);
    const remainder = rentalDays % 30;
    total = months * monthly;
    if (remainder > 0) {
      if (daily != null) {
        total += remainder * daily;
        effectiveDaily = daily;
      } else if (weekly != null) {
        total += Math.ceil(remainder / 7) * weekly;
        effectiveDaily = weekly / 7;
      } else {
        total += (remainder / 30) * monthly;
        effectiveDaily = monthly / 30;
      }
    } else {
      effectiveDaily = monthly / 30;
    }
  } else if (weekly != null && rentalDays >= 7) {
    const weeks = Math.floor(rentalDays / 7);
    const remainder = rentalDays % 7;
    total = weeks * weekly;
    if (remainder > 0 && daily != null) {
      total += remainder * daily;
      effectiveDaily = daily;
    } else if (remainder > 0) {
      total += (remainder / 7) * weekly;
      effectiveDaily = weekly / 7;
    } else {
      effectiveDaily = weekly / 7;
    }
  } else if (daily != null) {
    total = rentalDays * daily;
    effectiveDaily = daily;
  } else {
    throw new Error('Listing has no rental pricing configured');
  }

  const roundedTotal = Math.round(total * 1000) / 1000;
  const roundedDaily = Math.round((effectiveDaily ?? 0) * 1000) / 1000;

  return {
    rentalDays,
    dailyRate: roundedDaily.toFixed(3),
    totalAmount: roundedTotal.toFixed(3),
    currency,
  };
}
