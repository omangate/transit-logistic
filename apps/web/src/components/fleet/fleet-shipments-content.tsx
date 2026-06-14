'use client';

import { ShipmentStatus } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { StatusBadge } from '../portal/status-badge';

import { FleetShell } from './fleet-shell';

import { useRequireFleetAuth } from '@/hooks/use-require-fleet-auth';
import {
  acceptFleetShipment,
  listAvailableFleetShipments,
  listFleetDrivers,
  listFleetVehicles,
  listShipments,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatDate, formatRoute } from '@/lib/shipment-utils';
import type { FleetDriverOption, FleetVehicleOption } from '@/types/admin';
import type { Shipment } from '@/types/shipment';

export function FleetShipmentsContent() {
  const t = useTranslations('fleet');
  const tShipments = useTranslations('shipments');
  const locale = useLocale();
  const { user, isReady } = useRequireFleetAuth();
  const [available, setAvailable] = useState<Shipment[]>([]);
  const [assigned, setAssigned] = useState<Shipment[]>([]);
  const [drivers, setDrivers] = useState<FleetDriverOption[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicleOption[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);

  async function loadData() {
    setIsLoading(true);
    setError(null);

    try {
      const [availableResponse, assignedResponse, driversData, vehiclesData] = await Promise.all([
        listAvailableFleetShipments({ page: 1, limit: 50 }),
        listShipments({ page: 1, limit: 50 }),
        listFleetDrivers(),
        listFleetVehicles(),
      ]);

      setAvailable(availableResponse.data);
      setAssigned(
        assignedResponse.data.filter((shipment) =>
          [
            ShipmentStatus.ASSIGNED,
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.IN_TRANSIT,
            ShipmentStatus.DELIVERED,
            ShipmentStatus.COMPLETED,
          ].includes(shipment.status),
        ),
      );
      setDrivers(driversData);
      setVehicles(vehiclesData);
    } catch (loadError) {
      setError(
        isApiClientError(loadError)
          ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
          : t('errors.generic'),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    void loadData();
  }, [isReady, user, locale, t]);

  async function handleAccept(shipmentId: string) {
    if (!selectedDriver || !selectedVehicle) {
      setError(t('shipments.acceptRequired'));
      return;
    }

    setIsActionPending(true);
    setError(null);

    try {
      await acceptFleetShipment(shipmentId, {
        driverId: selectedDriver,
        vehicleId: selectedVehicle,
      });
      setAcceptingId(null);
      setSelectedDriver('');
      setSelectedVehicle('');
      await loadData();
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

  return (
    <FleetShell user={user} title={t('shipments.title')} subtitle={t('shipments.subtitle')}>
      <FormError message={error} />

      {isLoading ? (
        <p className="muted-text">{t('loading')}</p>
      ) : (
        <>
          <section className="panel">
            <h2 className="panel__title">{t('shipments.availableTitle')}</h2>
            {available.length === 0 ? (
              <p className="muted-text">{t('shipments.emptyAvailable')}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{tShipments('table.reference')}</th>
                      <th>{tShipments('table.route')}</th>
                      <th>{tShipments('table.cargo')}</th>
                      <th>{tShipments('table.created')}</th>
                      <th>{t('shipments.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {available.map((shipment) => (
                      <tr key={shipment.id}>
                        <td>{shipment.referenceNumber}</td>
                        <td>{formatRoute(shipment)}</td>
                        <td>{shipment.cargoDescription ?? '—'}</td>
                        <td>{formatDate(shipment.createdAt, locale)}</td>
                        <td>
                          {acceptingId === shipment.id ? (
                            <div className="inline-form">
                              <select
                                value={selectedDriver}
                                onChange={(event) => setSelectedDriver(event.target.value)}
                                disabled={isActionPending}
                              >
                                <option value="">{t('shipments.selectDriver')}</option>
                                {drivers.map((driver) => (
                                  <option key={driver.id} value={driver.id}>
                                    {driver.user.email}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={selectedVehicle}
                                onChange={(event) => setSelectedVehicle(event.target.value)}
                                disabled={isActionPending}
                              >
                                <option value="">{t('shipments.selectVehicle')}</option>
                                {vehicles.map((vehicle) => (
                                  <option key={vehicle.id} value={vehicle.id}>
                                    {vehicle.plateNumber}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="portal-button portal-button--primary"
                                disabled={isActionPending}
                                onClick={() => void handleAccept(shipment.id)}
                              >
                                {isActionPending ? t('working') : t('shipments.accept')}
                              </button>
                              <button
                                type="button"
                                className="portal-button portal-button--ghost"
                                disabled={isActionPending}
                                onClick={() => setAcceptingId(null)}
                              >
                                {tShipments('cancel')}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="portal-button portal-button--primary"
                              onClick={() => setAcceptingId(shipment.id)}
                            >
                              {t('shipments.accept')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="panel__title">{t('shipments.assignedTitle')}</h2>
            {assigned.length === 0 ? (
              <p className="muted-text">{t('shipments.emptyAssigned')}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{tShipments('table.reference')}</th>
                      <th>{tShipments('table.route')}</th>
                      <th>{tShipments('table.status')}</th>
                      <th>{tShipments('table.created')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigned.map((shipment) => (
                      <tr key={shipment.id}>
                        <td>{shipment.referenceNumber}</td>
                        <td>{formatRoute(shipment)}</td>
                        <td>
                          <StatusBadge
                            status={shipment.status}
                            label={tShipments(`status.${shipment.status}`)}
                          />
                        </td>
                        <td>{formatDate(shipment.createdAt, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </FleetShell>
  );
}
