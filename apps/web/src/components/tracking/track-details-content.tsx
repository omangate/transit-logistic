'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { BrandLogo } from '@/components/brand/brand-logo';
import { FormError } from '@/components/form-error';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { StatusBadge } from '@/components/portal/status-badge';
import { TrackingMap } from '@/components/tracking/tracking-map';
import { Link } from '@/i18n/navigation';
import { getPublicTracking } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatDate } from '@/lib/shipment-utils';
import type { PublicTracking } from '@/types/tracking';

type TrackDetailsContentProps = {
  reference: string;
};

export function TrackDetailsContent({ reference }: TrackDetailsContentProps) {
  const t = useTranslations('tracking');
  const tShipments = useTranslations('shipments');
  const locale = useLocale();
  const [tracking, setTracking] = useState<PublicTracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getPublicTracking(reference);
        if (!cancelled) {
          setTracking(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setTracking(null);
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
    const timer = window.setInterval(() => {
      void load();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [reference, locale, t]);

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
        ) : !tracking ? (
          <div className="public-card">
            <FormError message={error ?? t('notFound')} />
          </div>
        ) : (
          <>
            <div className="public-card">
              <div className="details-header">
                <h1 className="public-card__title">{tracking.referenceNumber}</h1>
                <StatusBadge
                  status={tracking.status}
                  label={tShipments(`status.${tracking.status}`)}
                />
              </div>

              <dl className="details-list">
                <div>
                  <dt>{tShipments('fields.cargoDescription')}</dt>
                  <dd>{tracking.cargoDescription ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('estimatedDelivery')}</dt>
                  <dd>{formatDate(tracking.estimatedDeliveryAt, locale)}</dd>
                </div>
                {tracking.pickup ? (
                  <div>
                    <dt>{tShipments('sections.pickup')}</dt>
                    <dd>
                      {tracking.pickup.address}, {tracking.pickup.city}
                    </dd>
                  </div>
                ) : null}
                {tracking.delivery ? (
                  <div>
                    <dt>{tShipments('sections.delivery')}</dt>
                    <dd>
                      {tracking.delivery.address}, {tracking.delivery.city}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {(() => {
              const center =
                tracking.livePosition ??
                (tracking.pickup
                  ? {
                      latitude: Number(tracking.pickup.latitude),
                      longitude: Number(tracking.pickup.longitude),
                    }
                  : null);

              if (!center || ['completed', 'cancelled'].includes(tracking.status)) {
                return null;
              }

              return <TrackingMap center={center} title={t('liveMap')} />;
            })()}

            <section className="panel">
              <h2 className="panel__title">{tShipments('sections.timeline')}</h2>
              {tracking.timeline.length === 0 ? (
                <p className="muted-text">{tShipments('timeline.empty')}</p>
              ) : (
                <ul className="timeline-list">
                  {tracking.timeline.map((entry, index) => (
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
