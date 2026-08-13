'use client';

import { GlobalTrackingSearchType, TrackingMode } from '@transit-logistic/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { BrandLogo } from '@/components/brand/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { KpiCard } from '@/components/ui/premium';
import { Link, useRouter } from '@/i18n/navigation';
import { getTrackingSummary } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-storage';
import type { TrackingSummary } from '@/types/global-tracking';

type TrackingModeFilter = TrackingMode | 'all';

const MODE_OPTIONS: TrackingModeFilter[] = ['all', TrackingMode.OCEAN, TrackingMode.AIR, TrackingMode.ROAD];

const SEARCH_TYPES_BY_MODE: Record<TrackingModeFilter, GlobalTrackingSearchType[]> = {
  all: [
    GlobalTrackingSearchType.REFERENCE,
    GlobalTrackingSearchType.CONTAINER,
    GlobalTrackingSearchType.AWB,
    GlobalTrackingSearchType.SHIPMENT_REFERENCE,
  ],
  [TrackingMode.OCEAN]: [
    GlobalTrackingSearchType.CONTAINER,
    GlobalTrackingSearchType.BILL_OF_LADING,
    GlobalTrackingSearchType.BOOKING,
    GlobalTrackingSearchType.REFERENCE,
  ],
  [TrackingMode.AIR]: [
    GlobalTrackingSearchType.AWB,
    GlobalTrackingSearchType.MAWB,
    GlobalTrackingSearchType.HAWB,
    GlobalTrackingSearchType.REFERENCE,
  ],
  [TrackingMode.ROAD]: [
    GlobalTrackingSearchType.SHIPMENT_REFERENCE,
    GlobalTrackingSearchType.TRUCK,
    GlobalTrackingSearchType.ORDER,
    GlobalTrackingSearchType.REFERENCE,
  ],
};

export function TrackFormContent() {
  const t = useTranslations('globalTracking');
  const router = useRouter();
  const [reference, setReference] = useState('');
  const [mode, setMode] = useState<TrackingModeFilter>('all');
  const [searchType, setSearchType] = useState<GlobalTrackingSearchType>(GlobalTrackingSearchType.REFERENCE);
  const [summary, setSummary] = useState<TrackingSummary | null>(null);

  const searchTypes = useMemo(() => SEARCH_TYPES_BY_MODE[mode], [mode]);

  useEffect(() => {
    if (!searchTypes.includes(searchType)) {
      setSearchType(searchTypes[0] ?? GlobalTrackingSearchType.REFERENCE);
    }
  }, [searchType, searchTypes]);

  useEffect(() => {
    if (!getAccessToken()) return;
    void getTrackingSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

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

      <section className="container public-page__content global-tracking-page__content">
        <div className="global-tracking-hero">
          <h1 className="global-tracking-hero__title">{t('title')}</h1>
          <p className="global-tracking-hero__subtitle">{t('subtitle')}</p>
        </div>

        <div className="global-tracking-search-card public-card">
          <div className="global-tracking-mode-tabs" role="tablist" aria-label={t('modeTabs')}>
            {MODE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={mode === option}
                className={`global-tracking-mode-tabs__tab${mode === option ? ' global-tracking-mode-tabs__tab--active' : ''}`}
                onClick={() => setMode(option)}
              >
                {t(`modes.${option}`)}
              </button>
            ))}
          </div>

          <form
            className="track-form global-tracking-form"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = reference.trim();
              if (!trimmed) return;
              const params = new URLSearchParams({
                type: searchType,
                q: trimmed,
                mode,
              });
              router.push(`/track/${encodeURIComponent(trimmed)}?${params.toString()}`);
            }}
          >
            <div className="form-grid">
              <label className="track-form__label">
                <span>{t('searchType')}</span>
                <select value={searchType} onChange={(event) => setSearchType(event.target.value as GlobalTrackingSearchType)}>
                  {searchTypes.map((type) => (
                    <option key={type} value={type}>
                      {t(`searchTypes.${type}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="track-form__label">
                <span>{t('referenceLabel')}</span>
                <input
                  type="text"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder={t(`placeholders.${mode}`)}
                  required
                  className="track-form__input"
                />
              </label>
            </div>
            <button type="submit" className="portal-button portal-button--primary">
              {t('trackButton')}
            </button>
          </form>
        </div>

        {summary ? (
          <>
            <div className="kpi-grid global-tracking-kpis">
              <KpiCard label={t('summary.oceanActive')} value={summary.ocean.active} />
              <KpiCard label={t('summary.airActive')} value={summary.air.active} />
              <KpiCard label={t('summary.roadActive')} value={summary.road.active} />
              <KpiCard label={t('summary.actionRequired')} value={summary.ocean.actionRequired + summary.air.actionRequired + summary.road.actionRequired} />
            </div>

            {summary.recentReferences.length > 0 ? (
              <section className="panel global-tracking-recent">
                <div className="panel__header">
                  <h2 className="panel__title">{t('recentTitle')}</h2>
                </div>
                <div className="global-tracking-recent__list">
                  {summary.recentReferences.map((item) => (
                    <Link
                      key={`${item.mode}-${item.reference}`}
                      href={`/track/${encodeURIComponent(item.reference)}?mode=${item.mode}`}
                      className="global-tracking-recent__item"
                    >
                      <span className={`global-tracking-mode global-tracking-mode--${item.mode}`}>{t(`modes.${item.mode}`)}</span>
                      <strong>{item.reference}</strong>
                      <span className="muted-text">{item.status.replace(/_/g, ' ')}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section className="global-tracking-quick-links panel">
            <h2 className="panel__title">{t('quickLinksTitle')}</h2>
            <div className="global-tracking-quick-links__grid">
              <Link href="/ocean/carriers" className="global-tracking-quick-links__item">{t('quickLinks.carriers')}</Link>
              <Link href="/ocean/schedules" className="global-tracking-quick-links__item">{t('quickLinks.schedules')}</Link>
              <Link href="/shipments" className="global-tracking-quick-links__item">{t('quickLinks.shipments')}</Link>
              <Link href="/logistics" className="global-tracking-quick-links__item">{t('quickLinks.logistics')}</Link>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
