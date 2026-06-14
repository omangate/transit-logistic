'use client';

import { LOCALE_LABELS, SUPPORTED_LOCALES, type SupportedLocale } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';

import { usePathname, useRouter } from '@/i18n/navigation';

export function LocaleSwitcher() {
  const locale = useLocale() as SupportedLocale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common');

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
      <span>{t('language')}</span>
      <select
        value={locale}
        onChange={(event) => {
          router.replace(pathname, { locale: event.target.value as SupportedLocale });
        }}
        aria-label={t('language')}
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: '0.375rem',
          padding: '0.375rem 0.5rem',
          background: '#fff',
        }}
      >
        {SUPPORTED_LOCALES.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {LOCALE_LABELS[supportedLocale]}
          </option>
        ))}
      </select>
    </label>
  );
}
