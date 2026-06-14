'use client';

import { ShipmentStatus } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { StatusBadge } from '../portal/status-badge';

import { AdminShipmentTrackingSection } from './admin-shipment-tracking-section';
import { AdminShell } from './admin-shell';

import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { Link } from '@/i18n/navigation';
import {
  adminAssignShipment,
  adminUpdateShipmentStatus,
  getShipment,
  getShipmentTimeline,
  listFleetDrivers,
  listFleetOwners,
  listFleetVehicles,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import {
  formatAmount,
  formatDate,
  formatRoute,
  getDeliveryStop,
  getPickupStop,
} from '@/lib/shipment-utils';
import type { FleetDriverOption, FleetOwnerOption, FleetVehicleOption } from '@/types/admin';
import type { Shipment, ShipmentTimeline } from '@/types/shipment';

const NEXT_STATUS: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  [ShipmentStatus.PENDING_ASSIGNMENT]: [ShipmentStatus.CANCELLED],
  [ShipmentStatus.ASSIGNED]: [ShipmentStatus.PICKED_UP, ShipmentStatus.CANCELLED],
  [ShipmentStatus.PICKED_UP]: [ShipmentStatus.IN_TRANSIT],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED],
  [ShipmentStatus.DELIVERED]: [ShipmentStatus.COMPLETED],
};

type AdminShipmentDetailsContentProps = {
  shipmentId: string;
};

const selectStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  padding: '0.625rem 0.75rem',
  font: 'inherit',
  width: '100%',
};

export function AdminShipmentDetailsContent({ shipmentId }: AdminShipmentDetailsContentProps) {
  const t = useTranslations('admin');
  const tShipments = useTranslations('shipments');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [timeline, setTimeline] = useState<ShipmentTimeline | null>(null);
  const [fleetOwners, setFleetOwners] = useState<FleetOwnerOption[]>([]);
  const [drivers, setDrivers] = useState<FleetDriverOption[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicleOption[]>([]);
  const [selectedFleetOwnerId, setSelectedFleetOwnerId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);

  const filteredDrivers = useMemo(
    () => drivers.filter((driver) => driver.fleetOwnerId === selectedFleetOwnerId),
    [drivers, selectedFleetOwnerId],
  );

  const filteredVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.fleetOwnerId === selectedFleetOwnerId),
    [vehicles, selectedFleetOwnerId],
  );

  const loadShipment = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [shipmentData, timelineData, fleetOwnerData, driverData, vehicleData] =
        await Promise.all([
          getShipment(shipmentId),
          getShipmentTimeline(shipmentId),
          listFleetOwners(),
          listFleetDrivers(),
          listFleetVehicles(),
        ]);

      setShipment(shipmentData);
      setTimeline(timelineData);
      setFleetOwners(fleetOwnerData);
      setDrivers(driverData);
      setVehicles(vehicleData);
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

  async function handleAssign() {
    if (!shipment || !selectedFleetOwnerId || !selectedDriverId || !selectedVehicleId) {
      setError(t('shipments.assign.required'));
      return;
    }

    setIsActionPending(true);
    setError(null);

    try {
      const updated = await adminAssignShipment(shipment.id, {
        fleetOwnerId: selectedFleetOwnerId,
        driverId: selectedDriverId,
        vehicleId: selectedVehicleId,
      });
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

  async function handleStatusChange(nextStatus: ShipmentStatus) {
    if (!shipment) {
      return;
    }

    setIsActionPending(true);
    setError(null);

    try {
      const updated = await adminUpdateShipmentStatus(shipment.id, {
        status: nextStatus,
        note: `Admin updated status to ${nextStatus}`,
      });
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
      <AdminShell user={user} title={t('shipments.detailsTitle')} subtitle={t('loading')}>
        <p className="muted-text">{t('loading')}</p>
      </AdminShell>
    );
  }

  if (!shipment) {
    return (
      <AdminShell user={user} title={t('shipments.detailsTitle')} subtitle={t('shipments.notFound')}>
        <FormError message={error} />
        <Link href="/admin/shipments" className="portal-button portal-button--primary">
          {t('shipments.backToList')}
        </Link>
      </AdminShell>
    );
  }

  const pickup = getPickupStop(shipment);
  const delivery = getDeliveryStop(shipment);
  const canAssign = shipment.status === ShipmentStatus.PENDING_ASSIGNMENT;
  const nextStatuses = NEXT_STATUS[shipment.status] ?? [];

  return (
    <AdminShell
      user={user}
      title={shipment.referenceNumber}
      subtitle={formatRoute(shipment)}
      action={
        <Link href="/admin/shipments" className="portal-button portal-button--ghost">
          {t('shipments.backToList')}
        </Link>
      }
    >
      <FormError message={error} />

      <div className="details-header">
        <StatusBadge status={shipment.status} label={tShipments(`status.${shipment.status}`)} />
        <div className="details-actions">
          {nextStatuses.map((status) => (
            <button
              key={status}
              type="button"
              className="portal-button portal-button--ghost"
              disabled={isActionPending}
              onClick={() => void handleStatusChange(status)}
            >
              {t('shipments.actions.setStatus', {
                status: tShipments(`status.${status}`),
              })}
            </button>
          ))}
        </div>
      </div>

      {canAssign ? (
        <section className="panel">
          <h2 className="panel__title">{t('shipments.assign.title')}</h2>
          <div className="form-grid">
            <label className="payment-field">
              <span>{t('shipments.assign.fleetOwner')}</span>
              <select
                value={selectedFleetOwnerId}
                onChange={(event) => {
                  setSelectedFleetOwnerId(event.target.value);
                  setSelectedDriverId('');
                  setSelectedVehicleId('');
                }}
                style={selectStyle}
                disabled={isActionPending}
              >
                <option value="">{t('shipments.assign.selectFleetOwner')}</option>
                {fleetOwners.map((fleetOwner) => (
                  <option key={fleetOwner.id} value={fleetOwner.id}>
                    {fleetOwner.companyName}
                  </option>
                ))}
              </select>
            </label>
            <label className="payment-field">
              <span>{t('shipments.assign.driver')}</span>
              <select
                value={selectedDriverId}
                onChange={(event) => setSelectedDriverId(event.target.value)}
                style={selectStyle}
                disabled={!selectedFleetOwnerId || isActionPending}
              >
                <option value="">{t('shipments.assign.selectDriver')}</option>
                {filteredDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="payment-field">
              <span>{t('shipments.assign.vehicle')}</span>
              <select
                value={selectedVehicleId}
                onChange={(event) => setSelectedVehicleId(event.target.value)}
                style={selectStyle}
                disabled={!selectedFleetOwnerId || isActionPending}
              >
                <option value="">{t('shipments.assign.selectVehicle')}</option>
                {filteredVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plateNumber}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="portal-button portal-button--primary"
              disabled={isActionPending}
              onClick={() => void handleAssign()}
            >
              {isActionPending ? t('working') : t('shipments.assign.submit')}
            </button>
          </div>
        </section>
      ) : null}

      <div className="details-grid">
        <section className="panel">
          <h2 className="panel__title">{tShipments('sections.overview')}</h2>
          <dl className="details-list">
            <div>
              <dt>{tShipments('fields.cargoDescription')}</dt>
              <dd>{shipment.cargoDescription ?? '—'}</dd>
            </div>
            <div>
              <dt>{tShipments('table.created')}</dt>
              <dd>{formatDate(shipment.createdAt, locale)}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2 className="panel__title">{tShipments('sections.pricing')}</h2>
          {shipment.pricing ? (
            <dl className="details-list">
              <div>
                <dt>{tShipments('pricing.total')}</dt>
                <dd>
                  {formatAmount(shipment.pricing.totalAmount, shipment.pricing.currency)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="muted-text">{tShipments('pricing.pending')}</p>
          )}
        </section>

        <section className="panel">
          <h2 className="panel__title">{tShipments('sections.pickup')}</h2>
          {pickup ? (
            <dl className="details-list">
              <div>
                <dt>{tShipments('fields.city')}</dt>
                <dd>{pickup.city}</dd>
              </div>
              <div>
                <dt>{tShipments('fields.address')}</dt>
                <dd>{pickup.address}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        <section className="panel">
          <h2 className="panel__title">{tShipments('sections.delivery')}</h2>
          {delivery ? (
            <dl className="details-list">
              <div>
                <dt>{tShipments('fields.city')}</dt>
                <dd>{delivery.city}</dd>
              </div>
              <div>
                <dt>{tShipments('fields.address')}</dt>
                <dd>{delivery.address}</dd>
              </div>
            </dl>
          ) : null}
        </section>
      </div>

      <AdminShipmentTrackingSection shipment={shipment} />

      {timeline ? (
        <section className="panel">
          <h2 className="panel__title">{tShipments('sections.timeline')}</h2>
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
        </section>
      ) : null}
    </AdminShell>
  );
}
