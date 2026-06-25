import { DEFAULT_CURRENCY } from '@transit-logistic/shared';

import type { TruckListingSummary, TruckServiceArea } from '@/types/marketplace';

export function formatOMR(
  amount: string | number | null | undefined,
  locale: string,
): string | null {
  if (amount === null || amount === undefined || amount === '') return null;
  const value = Number(amount);
  if (Number.isNaN(value)) return null;
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

export function getTruckLocationLabel(
  serviceAreas: TruckServiceArea[] | undefined,
  locale: string,
): string | null {
  if (!serviceAreas?.length) return null;
  const region = serviceAreas.find((sa) => sa.geoRegion.type === 'governorate')?.geoRegion
    ?? serviceAreas[0]?.geoRegion;
  if (!region) return null;
  return locale === 'ar' ? region.nameAr : region.nameEn;
}

export function getTruckDisplayPrice(
  truck: Pick<
    TruckListingSummary,
    'dailyRentalPrice' | 'weeklyRentalPrice' | 'monthlyRentalPrice' | 'pricePerKm'
  >,
  locale: string,
  labels: { perDay: string; perKm: string; requestQuote: string },
): { text: string; hasPrice: boolean } {
  if (truck.dailyRentalPrice) {
    const formatted = formatOMR(truck.dailyRentalPrice, locale);
    return { text: `${formatted} ${labels.perDay}`, hasPrice: true };
  }
  if (truck.weeklyRentalPrice) {
    const formatted = formatOMR(truck.weeklyRentalPrice, locale);
    return { text: formatted ?? labels.requestQuote, hasPrice: Boolean(formatted) };
  }
  if (truck.pricePerKm) {
    const formatted = formatOMR(truck.pricePerKm, locale);
    return { text: `${formatted} ${labels.perKm}`, hasPrice: true };
  }
  return { text: labels.requestQuote, hasPrice: false };
}

export function getTruckTitle(truck: TruckListingSummary): string {
  const parts = [truck.brand, truck.model].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return truck.name;
}
