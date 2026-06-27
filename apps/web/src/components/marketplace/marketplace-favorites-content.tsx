'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { TruckCard } from '@/components/marketplace/truck-card';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { listFavoriteTruckIds, listFavoriteTrucks } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { TruckListingSummary } from '@/types/marketplace';

export function MarketplaceFavoritesContent() {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const { user, isReady } = useRequireAuth();
  const [items, setItems] = useState<TruckListingSummary[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !user) return;
    void Promise.all([listFavoriteTrucks(), listFavoriteTruckIds()])
      .then(([trucks, ids]) => {
        setItems(trucks);
        setFavoriteIds(new Set(ids));
      })
      .catch((err) => {
        setError(
          isApiClientError(err) ? getLocalizedApiMessage(err, locale as 'en' | 'ar') : t('errors.generic'),
        );
      });
  }, [isReady, user, locale, t]);

  if (!isReady) return <main className="container"><p>{t('loading')}</p></main>;
  if (!user) return <main className="container"><p>{t('favorites.loginRequired')}</p></main>;

  return (
    <main>
      <header className="marketplace-hero">
        <div className="container">
          <h1>{t('favorites.title')}</h1>
          <p>{t('favorites.subtitle')}</p>
        </div>
      </header>
      <section className="container">
        {error ? <p className="form-error">{error}</p> : null}
        {items.length === 0 ? <p>{t('favorites.empty')}</p> : null}
        <div className="rental-grid">
          {items.map((truck) => (
            <TruckCard
              key={truck.id}
              truck={truck}
              locale={locale}
              isFavorited={favoriteIds.has(truck.id)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
