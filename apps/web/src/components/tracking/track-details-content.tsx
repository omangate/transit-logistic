'use client';

import { OceanTrackingSearchType } from '@transit-logistic/shared';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { BrandLogo } from '@/components/brand/brand-logo';
import { FormError } from '@/components/form-error';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { OceanTrackingResult } from '@/components/ocean/ocean-tracking-result';
import { StatusBadge } from '@/components/portal/status-badge';
import { TrackingMap } from '@/components/tracking/tracking-map';
import { Link } from '@/i18n/navigation';
import { getPublicTracking, trackOceanShipment } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatDate } from '@/lib/shipment-utils';
import type { NormalizedOceanTracking } from '@/types/ocean';
import type { PublicTracking } from '@/types/tracking';

type TrackDetailsContentProps = {
  reference: string;
};

function parseSearchType(value: string | null): OceanTrackingSearchType {
  if (
    value === OceanTrackingSearchType.CONTAINER ||
    value === OceanTrackingSearchType.BILL_OF_LADING ||
    value === OceanTrackingSearchType.BOOKING ||
    value === OceanTrackingSearchType.REFERENCE
  ) {
    return value;
  }
  return OceanTrackingSearchType.REFERENCE;
}

export function TrackDetailsContent({ reference }: TrackDetailsContentProps) {
  const t = useTranslations('tracking');
  const tShipments = useTranslations('shipments');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const searchType = useMemo(
    () => parseSearchType(searchParams.get('type')),
    [searchParams],
  );

  const [oceanTracking, setOceanTracking] = useState<NormalizedOceanTracking | null>(null);
  const [truckTracking, setTruckTracking] = useState<PublicTracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setOceanTracking(null);
      setTruckTracking(null);

      try {
        const ocean = await trackOceanShipment({ searchType, searchValue: reference });
        if (!cancelled) {
          setOceanTracking(ocean);
        }
      } catch {
        try {
          const truck = await getPublicTracking(reference);
          if (!cancelled) {
            setTruckTracking(truck);
          }
        } catch (loadError) {
          if (!cancelled) {
            setError(
              isApiClientError(loadError)
                ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
                : t('notFound'),
            );
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [reference, searchType, locale, t]);

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
        <Link href="/track" className="portal-link public-page__back">
          ← {t('backToSearch')}
        </Link>

        {isLoading ? (
          <p className="muted-text">{t('loading')}</p>
        ) : oceanTracking ? (
          <OceanTrackingResult tracking={oceanTracking} />
        ) : !truckTracking ? (
          <div className="public-card">
            <FormError message={error ?? t('notFound')} />
          </div>
        ) : (
          <>
            <div className="public-card">
              <div className="details-header">
                <h1 className="public-card__title">{truckTracking.referenceNumber}</h1>
                <StatusBadge
                  status={truckTracking.status}
                  label={tShipments(`status.${truckTracking.status}`)}
                />
              </div>

              <dl className="details-list">
                <div>
                  <dt>{tShipments('fields.cargoDescription')}</dt>
                  <dd>{truckTracking.cargoDescription ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('estimatedDelivery')}</dt>
                  <dd>{formatDate(truckTracking.estimatedDeliveryAt, locale)}</dd>
                </div>
                {truckTracking.pickup ? (
                  <div>
                    <dt>{tShipments('sections.pickup')}</dt>
                    <dd>
                      {truckTracking.pickup.address}, {truckTracking.pickup.city}
                    </dd>
                  </div>
                ) : null}
                {truckTracking.delivery ? (
                  <div>
                    <dt>{tShipments('sections.delivery')}</dt>
                    <dd>
                      {truckTracking.delivery.address}, {truckTracking.delivery.city}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {(() => {
              const center =
                truckTracking.livePosition ??
                (truckTracking.pickup
                  ? {
                      latitude: Number(truckTracking.pickup.latitude),
                      longitude: Number(truckTracking.pickup.longitude),
                    }
                  : null);

              if (!center || ['completed', 'cancelled'].includes(truckTracking.status)) {
                return null;
              }

              return <TrackingMap center={center} title={t('liveMap')} />;
            })()}

            <section className="panel">
              <h2 className="panel__title">{tShipments('sections.timeline')}</h2>
              {truckTracking.timeline.length === 0 ? (
                <p className="muted-text">{tShipments('timeline.empty')}</p>
              ) : (
                <ul className="timeline-list">
                  {truckTracking.timeline.map((entry, index) => (
                    <li key={`${entry.toStatus}-${entry.createdAt}-${index}`}>
                      <span className="timeline-list__status">
                        {entry.fromStatus
                          ? `${tShipments(`status.${entry.fromStatus}`)} → ${tShipments(`status.${entry.toStatus}`)}`
                          : tShipments(`status.${entry.toStatus}`)}
                      </span>
                      {entry.note ? (
                        <span className="timeline-list__note">{entry.note}</span>
                      ) : null}
                      <span className="timeline-list__date">
                        {formatDate(entry.createdAt, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
