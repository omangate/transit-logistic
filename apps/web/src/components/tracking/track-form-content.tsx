'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { BrandLogo } from '@/components/brand/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Link, useRouter } from '@/i18n/navigation';

export function TrackFormContent() {
  const t = useTranslations('tracking');
  const router = useRouter();
  const [reference, setReference] = useState('');

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
                router.push(`/track/${encodeURIComponent(trimmed)}`);
              }
            }}
          >
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
            <button type="submit" className="portal-button portal-button--primary">
              {t('trackButton')}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
