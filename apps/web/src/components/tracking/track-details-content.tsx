'use client';

import { GlobalTrackingSearchType, TrackingMode } from '@transit-logistic/shared';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { BrandLogo } from '@/components/brand/brand-logo';
import { FormError } from '@/components/form-error';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { UnifiedTrackingResultView } from '@/components/tracking/unified-tracking-result';
import { Link } from '@/i18n/navigation';
import { trackGlobalShipment } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { UnifiedTrackingResult } from '@/types/global-tracking';

type TrackDetailsContentProps = {
  reference: string;
};

function parseMode(value: string | null): TrackingMode | 'all' {
  if (value === TrackingMode.OCEAN || value === TrackingMode.AIR || value === TrackingMode.ROAD) {
    return value;
  }
  return 'all';
}

function parseSearchType(value: string | null): GlobalTrackingSearchType | undefined {
  const values = Object.values(GlobalTrackingSearchType);
  if (value && values.includes(value as GlobalTrackingSearchType)) {
    return value as GlobalTrackingSearchType;
  }
  return undefined;
}

export function TrackDetailsContent({ reference }: TrackDetailsContentProps) {
  const t = useTranslations('globalTracking');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const mode = useMemo(() => parseMode(searchParams.get('mode')), [searchParams]);
  const searchType = useMemo(() => parseSearchType(searchParams.get('type')), [searchParams]);

  const [tracking, setTracking] = useState<UnifiedTrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await trackGlobalShipment({ mode, searchType, searchValue: reference });
        if (!cancelled) setTracking(result);
      } catch (loadError) {
        if (!cancelled) {
          setTracking(null);
          setError(
            isApiClientError(loadError)
              ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
              : t('notFound'),
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [reference, mode, searchType, locale, t]);

  return (
    <main className="public-page global-tracking-page">
      <header className="public-page__header">
        <div className="container public-page__header-inner">
          <Link href="/">
            <BrandLogo size="sm" />
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <section className="container public-page__content">
        <Link href="/track" className="portal-link public-page__back">
          ← {t('backToSearch')}
        </Link>

        {isLoading ? (
          <p className="muted-text">{t('loading')}</p>
        ) : tracking ? (
          <UnifiedTrackingResultView tracking={tracking} />
        ) : (
          <div className="public-card">
            <FormError message={error ?? t('notFound')} />
          </div>
        )}
      </section>
    </main>
  );
}
