'use client';

import { ShipmentStatus } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { StatusBadge } from '../portal/status-badge';

import { DriverShell } from './driver-shell';

import { useRequireDriverAuth } from '@/hooks/use-require-driver-auth';
import { Link } from '@/i18n/navigation';
import {
  driverDeliver,
  driverPickup,
  driverStartTransit,
  getShipment,
  getShipmentTimeline,
  recordDriverTrackingPoint,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import {
  formatDate,
  formatRoute,
  getDeliveryStop,
  getPickupStop,
  isOneOfShipmentStatuses,
} from '@/lib/shipment-utils';
import type { Shipment, ShipmentTimeline } from '@/types/shipment';

type DriverShipmentContentProps = {
  shipmentId: string;
};

export function DriverShipmentContent({ shipmentId }: DriverShipmentContentProps) {
  const t = useTranslations('driver');
  const tShipments = useTranslations('shipments');
  const locale = useLocale();
  const { user, isReady } = useRequireDriverAuth();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [timeline, setTimeline] = useState<ShipmentTimeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);

  const loadShipment = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [shipmentData, timelineData] = await Promise.all([
        getShipment(shipmentId),
        getShipmentTimeline(shipmentId),
      ]);
      setShipment(shipmentData);
      setTimeline(timelineData);
    } catch (loadError) {
      setError(
        isApiClientError(loadError)
          ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
          : t('errors.generic'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [shipmentId, locale, t]);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    void loadShipment();
  }, [isReady, user, loadShipment]);

  useEffect(() => {
    if (
      !shipment ||
      !isOneOfShipmentStatuses(shipment.status, [
        ShipmentStatus.PICKED_UP,
        ShipmentStatus.IN_TRANSIT,
      ])
    ) {
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        void recordDriverTrackingPoint(shipment.id, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed ?? undefined,
        }).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [shipment?.id, shipment?.status]);

  async function runAction(action: 'pickup' | 'startTransit' | 'deliver') {
    if (!shipment) {
      return;
    }

    setIsActionPending(true);
    setError(null);

    try {
      const updated =
        action === 'pickup'
          ? await driverPickup(shipment.id)
          : action === 'startTransit'
            ? await driverStartTransit(shipment.id)
            : await driverDeliver(shipment.id);

      setShipment(updated);
      const timelineData = await getShipmentTimeline(shipment.id);
      setTimeline(timelineData);
    } catch (actionError) {
      setError(
        isApiClientError(actionError)
          ? getLocalizedApiMessage(actionError, locale as 'en' | 'ar')
          : t('errors.generic'),
      );
    } finally {
      setIsActionPending(false);
    }
  }

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  if (isLoading) {
    return (
      <DriverShell user={user} title={t('shipment.title')} subtitle={t('shipment.loading')}>
        <p className="muted-text">{t('loading')}</p>
      </DriverShell>
    );
  }

  if (!shipment) {
    return (
      <DriverShell user={user} title={t('shipment.title')} subtitle={t('shipment.notFound')}>
        <FormError message={error} />
        <Link href="/driver/dashboard" className="portal-button portal-button--primary">
          {t('shipment.backToDashboard')}
        </Link>
      </DriverShell>
    );
  }

  const pickup = getPickupStop(shipment);
  const delivery = getDeliveryStop(shipment);
  const canPickup = shipment.status === ShipmentStatus.ASSIGNED;
  const canStartTransit = shipment.status === ShipmentStatus.PICKED_UP;
  const canDeliver = shipment.status === ShipmentStatus.IN_TRANSIT;

  return (
    <DriverShell
      user={user}
      title={shipment.referenceNumber}
      subtitle={formatRoute(shipment)}
      action={
        <Link href="/driver/dashboard" className="portal-button portal-button--ghost">
          {t('shipment.backToDashboard')}
        </Link>
      }
    >
      <FormError message={error} />

      <div className="details-header">
        <StatusBadge status={shipment.status} label={tShipments(`status.${shipment.status}`)} />
        <div className="details-actions">
          {canPickup ? (
            <button
              type="button"
              className="portal-button portal-button--primary"
              disabled={isActionPending}
              onClick={() => void runAction('pickup')}
            >
              {isActionPending ? t('working') : t('actions.pickup')}
            </button>
          ) : null}
          {canStartTransit ? (
            <button
              type="button"
              className="portal-button portal-button--primary"
              disabled={isActionPending}
              onClick={() => void runAction('startTransit')}
            >
              {isActionPending ? t('working') : t('actions.startTransit')}
            </button>
          ) : null}
          {canDeliver ? (
            <button
              type="button"
              className="portal-button portal-button--primary"
              disabled={isActionPending}
              onClick={() => void runAction('deliver')}
            >
              {isActionPending ? t('working') : t('actions.deliver')}
            </button>
          ) : null}
          {isOneOfShipmentStatuses(shipment.status, [
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.IN_TRANSIT,
          ]) ? (
            <button
              type="button"
              className="portal-button portal-button--ghost"
              disabled={isActionPending}
              onClick={() => {
                if (!navigator.geolocation) {
                  setError(t('errors.generic'));
                  return;
                }

                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    void recordDriverTrackingPoint(shipment.id, {
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                      speed: position.coords.speed ?? undefined,
                    }).catch((trackingError) => {
                      setError(
                        isApiClientError(trackingError)
                          ? getLocalizedApiMessage(trackingError, locale as 'en' | 'ar')
                          : t('errors.generic'),
                      );
                    });
                  },
                  () => setError(t('errors.generic')),
                );
              }}
            >
              {t('actions.shareLocation')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="details-grid">
        <section className="panel">
          <h2 className="panel__title">{tShipments('sections.overview')}</h2>
          <dl className="details-list">
            <div>
              <dt>{tShipments('fields.cargoDescription')}</dt>
              <dd>{shipment.cargoDescription ?? '—'}</dd>
            </div>
            <div>
              <dt>{tShipments('fields.scheduledAt')}</dt>
              <dd>{formatDate(shipment.scheduledAt, locale)}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2 className="panel__title">{tShipments('sections.pickup')}</h2>
          {pickup ? (
            <dl className="details-list">
              <div>
                <dt>{tShipments('fields.address')}</dt>
                <dd>{pickup.address}</dd>
              </div>
              <div>
                <dt>{tShipments('fields.city')}</dt>
                <dd>{pickup.city}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        <section className="panel">
          <h2 className="panel__title">{tShipments('sections.delivery')}</h2>
          {delivery ? (
            <dl className="details-list">
              <div>
                <dt>{tShipments('fields.address')}</dt>
                <dd>{delivery.address}</dd>
              </div>
              <div>
                <dt>{tShipments('fields.city')}</dt>
                <dd>{delivery.city}</dd>
              </div>
            </dl>
          ) : null}
        </section>
      </div>

      {timeline ? (
        <section className="panel">
          <h2 className="panel__title">{tShipments('sections.timeline')}</h2>
          {timeline.history.length === 0 ? (
            <p className="muted-text">{tShipments('timeline.empty')}</p>
          ) : (
            <ul className="timeline-list">
              {timeline.history.map((entry) => (
                <li key={entry.id}>
                  <span className="timeline-list__status">
                    {entry.fromStatus
                      ? `${tShipments(`status.${entry.fromStatus}`)} → ${tShipments(`status.${entry.toStatus}`)}`
                      : tShipments(`status.${entry.toStatus}`)}
                  </span>
                  <span className="timeline-list__date">{formatDate(entry.createdAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </DriverShell>
  );
}
