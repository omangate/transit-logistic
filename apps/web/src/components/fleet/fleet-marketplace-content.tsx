'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FleetShell } from '@/components/fleet/fleet-shell';
import { FormError } from '@/components/form-error';
import { TruckCard } from '@/components/marketplace/truck-card';
import { LoadingState } from '@/components/portal/loading-state';
import { useRequireFleetAuth } from '@/hooks/use-require-fleet-auth';
import { Link } from '@/i18n/navigation';
import {
  listFleetQuoteRequests,
  listFleetTruckListings,
  submitFleetTruckListing,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { FleetTruckListing, TruckQuoteRequest } from '@/types/marketplace';

export function FleetMarketplaceContent() {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const { user, isReady } = useRequireFleetAuth();
  const [listings, setListings] = useState<FleetTruckListing[]>([]);
  const [quotes, setQuotes] = useState<TruckQuoteRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [l, q] = await Promise.all([
        listFleetTruckListings(),
        listFleetQuoteRequests(),
      ]);
      setListings(l);
      setQuotes(q);
    } catch (err) {
      setError(
        isApiClientError(err) ? getLocalizedApiMessage(err, locale as 'en' | 'ar') : t('errors.generic'),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReady) void load();
  }, [isReady]);

  if (!isReady || !user) return <LoadingState message={t('loading')} />;

  return (
    <FleetShell user={user} title={t('fleet.title')} subtitle={t('fleet.subtitle')}>
      <FormError message={error} />

      <div className="fleet-rental-hub__header">
        <div />
        <Link href="/fleet/marketplace/new" className="rental-btn rental-btn--primary">
          {t('fleet.addTruck')}
        </Link>
      </div>

      {loading ? <LoadingState message={t('loading')} /> : null}

      {!loading && listings.length === 0 ? (
        <div className="fleet-rental-empty">
          <p>{t('fleetHub.noListings')}</p>
          <Link href="/fleet/marketplace/new" className="rental-btn rental-btn--primary">
            {t('fleet.addTruck')}
          </Link>
        </div>
      ) : null}

      {!loading && listings.length > 0 ? (
        <div className="rental-grid">
          {listings.map((listing) => (
            <div key={listing.id} className="fleet-listing-card-wrap">
              <TruckCard truck={listing} locale={locale} />
              <div className="fleet-listing-card-wrap__meta">
                <span className={`rental-status rental-status--${listing.listingStatus}`}>
                  {t(`listingStatus.${listing.listingStatus}`)}
                </span>
                <div className="fleet-listing-card-wrap__actions">
                  <Link href={`/fleet/marketplace/${listing.id}/edit`} className="rental-btn rental-btn--ghost">
                    {t('form.editListing')}
                  </Link>
                  {(listing.listingStatus === 'draft' || listing.listingStatus === 'rejected') ? (
                    <button
                      type="button"
                      className="rental-btn rental-btn--primary"
                      onClick={async () => {
                        try {
                          await submitFleetTruckListing(listing.id);
                          await load();
                        } catch (err) {
                          setError(
                            isApiClientError(err)
                              ? getLocalizedApiMessage(err, locale as 'en' | 'ar')
                              : t('errors.generic'),
                          );
                        }
                      }}
                    >
                      {t('fleet.submit')}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {quotes.length > 0 ? (
        <section className="fleet-rental-quotes panel">
          <h2>{t('fleetHub.recentQuotes')}</h2>
          <div className="fleet-rental-quotes__list">
            {quotes.map((quote) => (
              <article key={quote.id} className="fleet-rental-quotes__item">
                <div>
                  <strong>{quote.truckListing?.name}</strong>
                  <p>{quote.originCity}, {quote.originCountry} → {quote.destCity}, {quote.destCountry}</p>
                </div>
                <span className={`rental-status rental-status--${quote.status}`}>
                  {quote.status}
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </FleetShell>
  );
}
