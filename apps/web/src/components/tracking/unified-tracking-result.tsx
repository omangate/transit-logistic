'use client';

import { TrackingMode } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { TrackingMap } from '@/components/tracking/tracking-map';
import { DataSourceBadge } from '@/components/ui/premium';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/shipment-utils';
import type { UnifiedTrackingResult } from '@/types/global-tracking';

type UnifiedTrackingResultProps = {
  tracking: UnifiedTrackingResult;
};

export function UnifiedTrackingResultView({ tracking }: UnifiedTrackingResultProps) {
  const t = useTranslations('globalTracking');
  const locale = useLocale();

  const modeLabel = useMemo(() => t(`modes.${tracking.mode}`), [t, tracking.mode]);
  const dataSourceLabel = useMemo(() => {
    switch (tracking.dataQuality) {
      case 'live':
        return t('dataSource.live');
      case 'external':
        return t('dataSource.external');
      default:
        return t('dataSource.manual');
    }
  }, [t, tracking.dataQuality]);

  const routeLabel = [tracking.origin?.name ?? tracking.origin?.code, tracking.destination?.name ?? tracking.destination?.code]
    .filter(Boolean)
    .join(' → ');

  return (
    <div className="global-tracking-result">
      <header className="global-tracking-result__header">
        <div>
          <div className="global-tracking-result__badges">
            <span className={`global-tracking-mode global-tracking-mode--${tracking.mode}`}>{modeLabel}</span>
            <DataSourceBadge quality={tracking.dataQuality} label={dataSourceLabel} />
          </div>
          <h1 className="global-tracking-result__title">{tracking.reference}</h1>
          <p className="global-tracking-result__provider">{tracking.providerName ?? t('unknownProvider')}</p>
        </div>
        <div className="global-tracking-result__status-block">
          <div className="global-tracking-result__status">{tracking.currentStatus ?? t('statusUnknown')}</div>
          {tracking.lastUpdate ? (
            <div className="global-tracking-result__updated">
              {t('lastUpdate')}: {formatDate(tracking.lastUpdate, locale)}
            </div>
          ) : null}
        </div>
      </header>

      <div className="global-tracking-result__grid">
        <section className="global-tracking-result__panel">
          <h2>{t('journey')}</h2>
          {routeLabel ? <p className="global-tracking-result__route">{routeLabel}</p> : <p className="muted-text">{t('routeUnavailable')}</p>}
          <dl className="details-list">
            {tracking.eta ? (
              <div>
                <dt>{t('eta')}</dt>
                <dd>{formatDate(tracking.eta, locale)}</dd>
              </div>
            ) : null}
            {tracking.nextMilestone ? (
              <div>
                <dt>{t('nextMilestone')}</dt>
                <dd>{tracking.nextMilestone}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="global-tracking-result__panel">
          <h2>{t('details')}</h2>
          <dl className="details-list">
            {tracking.mode === TrackingMode.OCEAN && tracking.ocean ? (
              <>
                {tracking.ocean.vesselName ? <div><dt>{t('ocean.vessel')}</dt><dd>{tracking.ocean.vesselName}</dd></div> : null}
                {tracking.ocean.containerNumber ? <div><dt>{t('ocean.container')}</dt><dd>{tracking.ocean.containerNumber}</dd></div> : null}
                {tracking.ocean.pol?.name ? <div><dt>{t('ocean.pol')}</dt><dd>{tracking.ocean.pol.name}</dd></div> : null}
                {tracking.ocean.pod?.name ? <div><dt>{t('ocean.pod')}</dt><dd>{tracking.ocean.pod.name}</dd></div> : null}
              </>
            ) : null}
            {tracking.mode === TrackingMode.AIR && tracking.air ? (
              <>
                {tracking.air.airline ? <div><dt>{t('air.airline')}</dt><dd>{tracking.air.airline}</dd></div> : null}
                {tracking.air.awb ? <div><dt>{t('air.awb')}</dt><dd>{tracking.air.awb}</dd></div> : null}
                {tracking.air.flightNumber ? <div><dt>{t('air.flight')}</dt><dd>{tracking.air.flightNumber}</dd></div> : null}
              </>
            ) : null}
            {tracking.mode === TrackingMode.ROAD && tracking.road ? (
              <>
                {tracking.road.fleetCompany ? <div><dt>{t('road.fleet')}</dt><dd>{tracking.road.fleetCompany}</dd></div> : null}
                {tracking.road.truckIdentifier ? <div><dt>{t('road.truck')}</dt><dd>{tracking.road.truckIdentifier}</dd></div> : null}
                {tracking.road.pickup?.name ? <div><dt>{t('road.pickup')}</dt><dd>{tracking.road.pickup.name}</dd></div> : null}
                {tracking.road.delivery?.name ? <div><dt>{t('road.delivery')}</dt><dd>{tracking.road.delivery.name}</dd></div> : null}
              </>
            ) : null}
          </dl>
        </section>
      </div>

      {tracking.road?.livePosition ? (
        <TrackingMap
          center={{
            latitude: tracking.road.livePosition.latitude,
            longitude: tracking.road.livePosition.longitude,
          }}
          title={t('liveMap')}
        />
      ) : null}

      {tracking.events.length > 0 ? (
        <section className="panel">
          <h2 className="panel__title">{t('timeline')}</h2>
          <ul className="ocean-timeline">
            {tracking.events.map((event, index) => (
              <li key={`${event.eventDateTime}-${index}`} className="ocean-timeline__item">
                <div className="ocean-timeline__title">{event.description ?? event.eventType}</div>
                <div className="ocean-timeline__meta">{formatDate(event.eventDateTime, locale)}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="global-tracking-result__actions">
        {tracking.externalTrackingUrl ? (
          <a href={tracking.externalTrackingUrl} className="portal-button portal-button--secondary" target="_blank" rel="noopener noreferrer">
            {t('openExternalTracking')} ↗
          </a>
        ) : null}
        {tracking.entityId && tracking.entityType === 'shipment' ? (
          <Link href={`/shipments/${tracking.entityId}`} className="portal-button portal-button--ghost">
            {t('viewShipment')}
          </Link>
        ) : null}
        {tracking.entityId && tracking.entityType === 'freight_request' ? (
          <Link href={`/logistics/freight/${tracking.entityId}`} className="portal-button portal-button--ghost">
            {t('viewTransaction')}
          </Link>
        ) : null}
        <Link href="/documents" className="portal-button portal-button--ghost">{t('documents')}</Link>
      </div>
    </div>
  );
}
