'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FleetShell } from '@/components/fleet/fleet-shell';
import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { useRequireFleetAuth } from '@/hooks/use-require-fleet-auth';
import { Link } from '@/i18n/navigation';
import { getFleetLogisticsDashboard } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { FleetLogisticsDashboard } from '@/types/logistics';

export function FleetLogisticsDashboardContent() {
  const t = useTranslations('fleet');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireFleetAuth();
  const [data, setData] = useState<FleetLogisticsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;

    void getFleetLogisticsDashboard()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) => setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic')))
      .finally(() => setIsLoading(false));
  }, [isReady, locale, t, user]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <FleetShell user={user} title={t('logistics.title')} subtitle={t('logistics.subtitle')}>
      {error ? <FormError message={error} /> : null}
      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : data ? (
        <>
          <div className="logistics-metrics">
            <div className="logistics-metric">
              <strong>{data.counts.assignedShipments}</strong>
              <span>{t('logistics.assignedShipments')}</span>
            </div>
            <div className="logistics-metric">
              <strong>{data.counts.activeBookings}</strong>
              <span>{t('logistics.activeBookings')}</span>
            </div>
            <div className="logistics-metric">
              <strong>{data.counts.linkedOrders}</strong>
              <span>{t('logistics.linkedOrders')}</span>
            </div>
          </div>

          <section className="logistics-panel">
            <header className="logistics-page__header">
              <h2>{t('logistics.recentShipments')}</h2>
              <Link href="/fleet/shipments" className="rental-btn rental-btn--ghost">{t('dashboard.viewAll')}</Link>
            </header>
            <div className="logistics-table">
              {data.recentShipments.length ? data.recentShipments.map((item) => (
                <Link key={item.id} href={`/fleet/shipments`} className="logistics-table__row">
                  <strong>{item.referenceNumber}</strong>
                  <span>{item.cargoDescription ?? '—'}</span>
                  <span className="logistics-badge">{item.status.replace(/_/g, ' ')}</span>
                </Link>
              )) : <p className="logistics-empty">{t('shipments.emptyAssigned')}</p>}
            </div>
          </section>

          <section className="logistics-panel">
            <h2>{t('logistics.recentBookings')}</h2>
            <div className="logistics-table">
              {data.recentBookings.length ? data.recentBookings.map((item) => (
                <div key={item.id} className="logistics-table__row logistics-table__row--admin">
                  <strong>{item.truckListing?.name ?? item.id.slice(0, 8)}</strong>
                  <span>{new Date(item.startDate).toLocaleDateString(locale)} – {new Date(item.endDate).toLocaleDateString(locale)}</span>
                  <span className="logistics-badge">{item.status.replace(/_/g, ' ')}</span>
                </div>
              )) : <p className="logistics-empty">{t('logistics.noBookings')}</p>}
            </div>
          </section>

          {data.linkedOrders.length ? (
            <section className="logistics-panel">
              <h2>{t('logistics.linkedOrders')}</h2>
              <div className="logistics-table">
                {data.linkedOrders.map((order) => (
                  <div key={order.id} className="logistics-table__row logistics-table__row--admin">
                    <strong>{order.referenceNumber}</strong>
                    <span>{order.title ?? '—'}</span>
                    <span className="logistics-badge">{order.status.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
              <p className="logistics-chat__hint">{t('logistics.linkedOrdersHint')}</p>
            </section>
          ) : null}
        </>
      ) : null}
    </FleetShell>
  );
}
