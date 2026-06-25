export const SUPPORTED_LOCALES = ['en', 'ar'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'ar';

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  ar: 'العربية',
};

export const LOCALE_DIRECTION: Record<SupportedLocale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

export function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}
