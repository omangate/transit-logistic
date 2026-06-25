'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { TruckCard } from '@/components/marketplace/truck-card';
import { Link } from '@/i18n/navigation';
import { getMarketplaceHome } from '@/lib/api';
import type { MarketplaceHomeSections } from '@/types/marketplace';

export function HomeMarketplaceSections() {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const [sections, setSections] = useState<MarketplaceHomeSections | null>(null);

  useEffect(() => {
    void getMarketplaceHome().then(setSections).catch(() => setSections(null));
  }, []);

  if (!sections) return null;

  const blocks = [
    { title: t('home.featured'), items: sections.featured },
    { title: t('home.recent'), items: sections.recent },
    { title: t('home.topRated'), items: sections.topRated },
  ].filter((b) => b.items.length > 0);

  if (blocks.length === 0) return null;

  return (
    <section className="marketplace-home">
      <div className="container">
        <div className="marketplace-home__header">
          <h2>{t('home.title')}</h2>
          <Link href="/marketplace">{t('home.viewAll')}</Link>
        </div>
        {blocks.map((block) => (
          <div key={block.title} className="marketplace-home__block">
            <h3>{block.title}</h3>
            <div className="rental-grid">
              {block.items.map((truck) => (
                <TruckCard key={truck.id} truck={truck} locale={locale} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
