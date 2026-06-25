'use client';

import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { HomeMarketplaceSections } from '@/components/marketplace/home-marketplace-sections';
import { Link } from '@/i18n/navigation';

export function HomeContent() {
  const t = useTranslations('home');
  const common = useTranslations('common');
  const marketplace = useTranslations('marketplace');

  return (
    <main>
      <header
        style={{
          borderBottom: '1px solid var(--color-border)',
          paddingBlock: '1rem',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <strong>{common('appName')}</strong>
          <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link href="/marketplace">{marketplace('nav.browse')}</Link>
            <LocaleSwitcher />
          </nav>
        </div>
      </header>

      <section className="container" style={{ paddingBlock: '4rem' }}>
        <p
          style={{
            color: 'var(--color-muted)',
            fontSize: '0.875rem',
            marginBlockEnd: '0.75rem',
          }}
        >
          {t('phase')}
        </p>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', marginBlock: '0 1rem' }}>
          {t('title')}
        </h1>
        <p style={{ color: 'var(--color-muted)', maxWidth: '52ch', marginBlockEnd: '2rem' }}>
          {t('description')}
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link
            href="/marketplace"
            style={{
              display: 'inline-block',
              background: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1.25rem',
              fontWeight: 600,
            }}
          >
            {marketplace('home.browseCta')}
          </Link>
          <Link
            href="/login"
            style={{
              display: 'inline-block',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1.25rem',
              fontWeight: 600,
            }}
          >
            {t('getStarted')}
          </Link>
        </div>
      </section>

      <HomeMarketplaceSections />
    </main>
  );
}
