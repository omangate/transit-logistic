'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { DataSourceBadge } from '@/components/ui/premium';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/shipment-utils';
import type { NormalizedOceanTracking } from '@/types/ocean';

type OceanTrackingResultProps = {
  tracking: NormalizedOceanTracking;
};

export function OceanTrackingResult({ tracking }: OceanTrackingResultProps) {
  const t = useTranslations('oceanTracking');
  const locale = useLocale();

  const dataSourceLabel = useMemo(() => {
    switch (tracking.dataQuality) {
      case 'live':
        return t('dataSource.live');
      case 'manual':
        return t('dataSource.manual');
      default:
        return t('dataSource.external');
    }
  }, [tracking.dataQuality, t]);

  return (
    <div className="public-card">
      <div className="details-header">
        <div>
          <h1 className="public-card__title">{tracking.searchValue}</h1>
          <p className="muted-text">
            {tracking.carrierName ?? t('unknownCarrier')} · {tracking.currentStatus ?? t('statusUnknown')}
          </p>
        </div>
        <DataSourceBadge quality={tracking.dataQuality} label={dataSourceLabel} />
      </div>

      <dl className="details-list">
        {tracking.containerNumber ? (
          <div>
            <dt>{t('fields.container')}</dt>
            <dd>{tracking.containerNumber}</dd>
          </div>
        ) : null}
        {tracking.blNumber ? (
          <div>
            <dt>{t('fields.bl')}</dt>
            <dd>{tracking.blNumber}</dd>
          </div>
        ) : null}
        {tracking.vesselName ? (
          <div>
            <dt>{t('fields.vessel')}</dt>
            <dd>
              {tracking.vesselName}
              {tracking.voyage ? ` / ${tracking.voyage}` : ''}
            </dd>
          </div>
        ) : null}
        {tracking.pol?.name || tracking.pol?.unlocode ? (
          <div>
            <dt>{t('fields.pol')}</dt>
            <dd>{tracking.pol.name ?? tracking.pol.unlocode}</dd>
          </div>
        ) : null}
        {tracking.pod?.name || tracking.pod?.unlocode ? (
          <div>
            <dt>{t('fields.pod')}</dt>
            <dd>{tracking.pod.name ?? tracking.pod.unlocode}</dd>
          </div>
        ) : null}
        {tracking.etd ? (
          <div>
            <dt>{t('fields.etd')}</dt>
            <dd>{formatDate(tracking.etd, locale)}</dd>
          </div>
        ) : null}
        {tracking.eta ? (
          <div>
            <dt>{t('fields.eta')}</dt>
            <dd>{formatDate(tracking.eta, locale)}</dd>
          </div>
        ) : null}
        {tracking.lastUpdate ? (
          <div>
            <dt>{t('fields.lastUpdate')}</dt>
            <dd>{formatDate(tracking.lastUpdate, locale)}</dd>
          </div>
        ) : null}
        {tracking.nextMilestone ? (
          <div>
            <dt>{t('fields.nextMilestone')}</dt>
            <dd>{tracking.nextMilestone}</dd>
          </div>
        ) : null}
      </dl>

      {tracking.externalTrackingUrl ? (
        <p style={{ marginTop: '1rem' }}>
          <a
            href={tracking.externalTrackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="portal-button portal-button--secondary"
          >
            {t('openCarrierTracking')}
          </a>
        </p>
      ) : null}

      {tracking.events.length > 0 ? (
        <section className="panel" style={{ marginTop: '1.5rem' }}>
          <h2 className="panel__title">{t('timelineTitle')}</h2>
          <div className="ocean-timeline">
            {tracking.events.map((event, index) => (
              <article key={`${event.eventDateTime}-${index}`} className="ocean-timeline__item">
                <strong>{event.description ?? event.eventType}</strong>
                <p className="muted-text">{formatDate(event.eventDateTime, locale)}</p>
                {event.location?.name ? <p className="muted-text">{event.location.name}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tracking.shipmentReference ? (
        <p className="muted-text" style={{ marginTop: '1rem' }}>
          <Link href="/logistics" className="portal-link">
            {t('viewInternalRecord')} ({tracking.shipmentReference})
          </Link>
        </p>
      ) : null}
    </div>
  );
}
