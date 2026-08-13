'use client';

import { OceanTrackingSearchType } from '@transit-logistic/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { BrandLogo } from '@/components/brand/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Link, useRouter } from '@/i18n/navigation';

const SEARCH_TYPES = [
  OceanTrackingSearchType.CONTAINER,
  OceanTrackingSearchType.BILL_OF_LADING,
  OceanTrackingSearchType.BOOKING,
  OceanTrackingSearchType.REFERENCE,
] as const;

export function TrackFormContent() {
  const t = useTranslations('tracking');
  const router = useRouter();
  const [reference, setReference] = useState('');
  const [searchType, setSearchType] = useState<(typeof SEARCH_TYPES)[number]>(
    OceanTrackingSearchType.CONTAINER,
  );

  return (
    <main className="public-page">
      <header className="public-page__header">
        <div className="container public-page__header-inner">
          <Link href="/">
            <BrandLogo size="sm" />
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <section className="container public-page__content">
        <div className="public-card">
          <h1 className="public-card__title">{t('title')}</h1>
          <p className="muted-text">{t('subtitle')}</p>

          <form
            className="track-form"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = reference.trim();
              if (trimmed) {
                const params = new URLSearchParams({
                  type: searchType,
                  q: trimmed,
                });
                router.push(`/track/${encodeURIComponent(trimmed)}?${params.toString()}`);
              }
            }}
          >
            <div className="form-grid">
              <label className="track-form__label">
                <span>{t('searchType')}</span>
                <select
                  value={searchType}
                  onChange={(event) =>
                    setSearchType(event.target.value as (typeof SEARCH_TYPES)[number])
                  }
                >
                  {SEARCH_TYPES.map((type) => (
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
                  placeholder={t('referencePlaceholder')}
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
      </section>
    </main>
  );
}
