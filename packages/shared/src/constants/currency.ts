export const DEFAULT_CURRENCY = 'OMR' as const;

export const SUPPORTED_CURRENCIES = ['OMR', 'SAR', 'AED', 'USD'] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<SupportedCurrency, { en: string; ar: string }> = {
  OMR: { en: 'Omani Rial', ar: 'ريال عماني' },
  SAR: { en: 'Saudi Riyal', ar: 'ريال سعودي' },
  AED: { en: 'UAE Dirham', ar: 'درهم إماراتي' },
  USD: { en: 'US Dollar', ar: 'دولار أمريكي' },
};
