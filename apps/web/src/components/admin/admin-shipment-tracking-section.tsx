'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { TrackingMap } from '@/components/tracking/tracking-map';
import { Link } from '@/i18n/navigation';
import { getDeliveryStop, getPickupStop } from '@/lib/shipment-utils';
import type { Shipment, ShipmentStop } from '@/types/shipment';

type AdminShipmentTrackingSectionProps = {
  shipment: Shipment;
};

function getStopCoordinates(stop: ShipmentStop | undefined) {
  if (!stop) {
    return null;
  }

  const latitude = Number(stop.latitude);
  const longitude = Number(stop.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

export function AdminShipmentTrackingSection({ shipment }: AdminShipmentTrackingSectionProps) {
  const t = useTranslations('admin.shipments.tracking');
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  const pickup = getPickupStop(shipment);
  const delivery = getDeliveryStop(shipment);
  const mapCenter = useMemo(
    () => getStopCoordinates(pickup) ?? getStopCoordinates(delivery),
    [pickup, delivery],
  );

  const trackingPath = `/${locale}/track/${encodeURIComponent(shipment.referenceNumber)}`;

  async function handleCopyLink() {
    try {
      const fullUrl = `${window.location.origin}${trackingPath}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="panel">
      <h2 className="panel__title">{t('title')}</h2>

      {mapCenter ? (
        <TrackingMap center={mapCenter} title={t('mapTitle')} embedded />
      ) : (
        <p className="muted-text">{t('noCoordinates')}</p>
      )}

      <dl className="details-list" style={{ marginTop: '1rem' }}>
        <div>
          <dt>{t('publicUrl')}</dt>
          <dd>
            <code>{trackingPath}</code>
          </dd>
        </div>
      </dl>

      <div className="form-actions">
        <button
          type="button"
          className="portal-button portal-button--ghost"
          onClick={() => void handleCopyLink()}
        >
          {copied ? t('copied') : t('copyLink')}
        </button>
        <Link
          href={`/track/${encodeURIComponent(shipment.referenceNumber)}`}
          className="portal-button portal-button--primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('openPage')}
        </Link>
      </div>
    </section>
  );
}
