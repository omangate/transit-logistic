'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { StatusBadge } from '../portal/status-badge';

import { DriverShell } from './driver-shell';

import { useRequireDriverAuth } from '@/hooks/use-require-driver-auth';
import { Link } from '@/i18n/navigation';
import { getDriverActiveShipment } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatDate, formatRoute, getDeliveryStop, getPickupStop } from '@/lib/shipment-utils';
import type { Shipment } from '@/types/shipment';

export function DriverDashboardContent() {
  const t = useTranslations('driver');
  const tShipments = useTranslations('shipments');
  const locale = useLocale();
  const { user, isReady } = useRequireDriverAuth();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getDriverActiveShipment();
        if (!cancelled) {
          setShipment(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            isApiClientError(loadError)
              ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
              : t('errors.generic'),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isReady, user, locale, t]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  const pickup = shipment ? getPickupStop(shipment) : null;
  const delivery = shipment ? getDeliveryStop(shipment) : null;

  return (
    <DriverShell user={user} title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}>
      <FormError message={error} />

      {isLoading ? (
        <p className="muted-text">{t('loading')}</p>
      ) : !shipment ? (
        <section className="panel">
          <p className="muted-text">{t('dashboard.noActive')}</p>
        </section>
      ) : (
        <section className="panel">
          <div className="details-header">
            <h2 className="panel__title">{shipment.referenceNumber}</h2>
            <StatusBadge
              status={shipment.status}
              label={tShipments(`status.${shipment.status}`)}
            />
          </div>

          <dl className="details-list">
            <div>
              <dt>{tShipments('table.route')}</dt>
              <dd>{formatRoute(shipment)}</dd>
            </div>
            <div>
              <dt>{tShipments('fields.cargoDescription')}</dt>
              <dd>{shipment.cargoDescription ?? '—'}</dd>
            </div>
            <div>
              <dt>{tShipments('fields.scheduledAt')}</dt>
              <dd>{formatDate(shipment.scheduledAt, locale)}</dd>
            </div>
            {pickup ? (
              <div>
                <dt>{tShipments('sections.pickup')}</dt>
                <dd>
                  {pickup.address}, {pickup.city}
                </dd>
              </div>
            ) : null}
            {delivery ? (
              <div>
                <dt>{tShipments('sections.delivery')}</dt>
                <dd>
                  {delivery.address}, {delivery.city}
                </dd>
              </div>
            ) : null}
          </dl>

          <Link
            href={`/driver/shipments/${shipment.id}`}
            className="portal-button portal-button--primary"
          >
            {t('dashboard.viewShipment')}
          </Link>
        </section>
      )}
    </DriverShell>
  );
}
