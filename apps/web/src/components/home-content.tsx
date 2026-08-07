'use client';

import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { HomeMarketplaceSections } from '@/components/marketplace/home-marketplace-sections';
import { Link } from '@/i18n/navigation';

const SERVICES = [
  { href: '/marketplace', icon: '🚛', titleKey: 'services.trucks', descKey: 'services.trucksDesc' },
  { href: '/customs', icon: '🛃', titleKey: 'services.customs', descKey: 'services.customsDesc' },
  { href: '/freight', icon: '🚢', titleKey: 'services.freight', descKey: 'services.freightDesc' },
  { href: '/track', icon: '📍', titleKey: 'services.tracking', descKey: 'services.trackingDesc' },
] as const;

export function HomeContent() {
  const t = useTranslations('home');
  const logistics = useTranslations('logistics');
  const common = useTranslations('common');
  const marketplace = useTranslations('marketplace');

  return (
    <main>
      <header className="home-header">
        <div className="container home-header__inner">
          <strong>{common('appName')}</strong>
          <nav className="home-header__nav">
            <Link href="/marketplace">{marketplace('nav.browse')}</Link>
            <Link href="/customs">{logistics('services.customs')}</Link>
            <Link href="/freight">{logistics('services.freight')}</Link>
            <LocaleSwitcher />
          </nav>
        </div>
      </header>

      <section className="home-hero container">
        <p className="home-hero__phase">{t('phase')}</p>
        <h1>{t('title')}</h1>
        <p className="home-hero__desc">{t('description')}</p>
        <div className="home-hero__actions">
          <Link href="/logistics" className="rental-btn rental-btn--primary">{logistics('home.completeService')}</Link>
          <Link href="/login" className="rental-btn rental-btn--ghost">{t('getStarted')}</Link>
        </div>
      </section>

      <section className="container home-services">
        <h2>{logistics('home.servicesTitle')}</h2>
        <div className="home-services__grid">
          {SERVICES.map((service) => (
            <Link key={service.href} href={service.href} className="home-service-card">
              <span className="home-service-card__icon" aria-hidden>{service.icon}</span>
              <strong>{logistics(service.titleKey)}</strong>
              <p>{logistics(service.descKey)}</p>
            </Link>
          ))}
        </div>
      </section>

      <HomeMarketplaceSections />
    </main>
  );
}
