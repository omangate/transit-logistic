import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@transit-logistic/shared';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});
