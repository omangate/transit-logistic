'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

export function CustomsLandingContent() {
  const t = useTranslations('logistics');

  return (
    <main className="container logistics-page">
      <header className="logistics-hero">
        <h1>{t('customs.title')}</h1>
        <p>{t('customs.landingSubtitle')}</p>
        <div className="logistics-hero__actions">
          <Link href="/customs/new" className="rental-btn rental-btn--primary">{t('customs.newRequest')}</Link>
          <Link href="/customs/requests" className="rental-btn rental-btn--ghost">{t('customs.myRequests')}</Link>
        </div>
      </header>
    </main>
  );
}
