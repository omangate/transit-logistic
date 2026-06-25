'use client';

import { QuoteRequestStatus, ShipmentRequestStatus } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { TruckCard } from '@/components/marketplace/truck-card';
import { StatCard } from '@/components/portal/stat-card';
import { Link } from '@/i18n/navigation';
import {
  listFleetQuoteRequests,
  listFleetTruckListings,
  listFleetShipmentRequests,
} from '@/lib/api';
import type { FleetTruckListing, TruckQuoteRequest } from '@/types/marketplace';
import type { ShipmentRequestRecord } from '@/types/shipment-request';

export function FleetMarketplaceHub() {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const [listings, setListings] = useState<FleetTruckListing[]>([]);
  const [quotes, setQuotes] = useState<TruckQuoteRequest[]>([]);
  const [requests, setRequests] = useState<ShipmentRequestRecord[]>([]);

  useEffect(() => {
    void Promise.all([
      listFleetTruckListings(),
      listFleetQuoteRequests(),
      listFleetShipmentRequests(),
    ]).then(([l, q, r]) => {
      setListings(l);
      setQuotes(q);
      setRequests(r);
    }).catch(() => {
      /* dashboard should stay usable */
    });
  }, []);

  const activeListings = listings.filter(
    (l) => l.listingStatus === 'approved' && l.isListingEnabled,
  ).length;
  const pendingQuotes = quotes.filter((q) => q.status === QuoteRequestStatus.PENDING).length;
  const activeRentals = requests.filter(
    (r) => r.status === ShipmentRequestStatus.OPEN || r.status === ShipmentRequestStatus.MATCHED,
  ).length;
  const completedRentals = requests.filter(
    (r) => r.status === ShipmentRequestStatus.CONVERTED,
  ).length;
  const totalViews = listings.reduce((sum, l) => sum + (l.viewCount ?? 0), 0);

  const topListings = listings.slice(0, 3);

  return (
    <section className="fleet-rental-hub">
      <div className="fleet-rental-hub__header">
        <div>
          <h2>{t('fleetHub.title')}</h2>
          <p>{t('fleetHub.subtitle')}</p>
        </div>
        <Link href="/fleet/marketplace/new" className="rental-btn rental-btn--primary">
          {t('fleet.addTruck')}
        </Link>
      </div>

      <div className="portal-stats portal-stats--wide">
        <StatCard label={t('fleetHub.myListings')} value={String(listings.length)} />
        <StatCard label={t('fleetHub.activeListings')} value={String(activeListings)} />
        <StatCard label={t('fleetHub.pendingQuotes')} value={String(pendingQuotes)} />
        <StatCard label={t('fleetHub.activeRentals')} value={String(activeRentals)} />
        <StatCard label={t('fleetHub.completedRentals')} value={String(completedRentals)} />
        <StatCard label={t('fleetHub.totalViews')} value={String(totalViews)} />
      </div>

      {topListings.length > 0 ? (
        <div className="fleet-rental-hub__preview">
          <div className="fleet-rental-hub__preview-head">
            <h3>{t('fleetHub.myTrucks')}</h3>
            <Link href="/fleet/marketplace">{t('fleetHub.manageAll')}</Link>
          </div>
          <div className="rental-grid rental-grid--compact">
            {topListings.map((truck) => (
              <TruckCard key={truck.id} truck={truck} locale={locale} compact />
            ))}
          </div>
        </div>
      ) : (
        <p className="muted-text">{t('fleetHub.noListings')}</p>
      )}

      {pendingQuotes > 0 ? (
        <div className="fleet-rental-hub__quotes">
          <h3>{t('fleetHub.recentQuotes')}</h3>
          <ul>
            {quotes.slice(0, 5).map((quote) => (
              <li key={quote.id}>
                <strong>{quote.truckListing?.name ?? '—'}</strong>
                <span>{quote.originCity} → {quote.destCity}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
