'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { FleetShell } from './fleet-shell';

import { useRequireFleetAuth } from '@/hooks/use-require-fleet-auth';
import { createFleetVehicle, deleteFleetVehicle, listFleetVehicles, updateFleetVehicle } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { FleetVehicleOption } from '@/types/admin';

export function FleetVehiclesContent() {
  const t = useTranslations('fleet');
  const locale = useLocale();
  const { user, isReady } = useRequireFleetAuth();
  const [vehicles, setVehicles] = useState<FleetVehicleOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await listFleetVehicles();
        if (!cancelled) {
          setVehicles(data);
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

  return (
    <FleetShell user={user} title={t('vehicles.title')} subtitle={t('vehicles.subtitle')}>
      <FormError message={error} />

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <h2 className="panel__title">{t('vehicles.addTitle')}</h2>
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setIsCreating(true);
            const formData = new FormData(event.currentTarget);
            try {
              const created = await createFleetVehicle({
                plateNumber: String(formData.get('plateNumber') ?? ''),
                vehicleType: String(formData.get('vehicleType') ?? 'flatbed'),
                capacityKg: formData.get('capacityKg')
                  ? Number(formData.get('capacityKg'))
                  : undefined,
              });
              setVehicles((current) => [created, ...current]);
              event.currentTarget.reset();
            } catch (submitError) {
              setError(
                isApiClientError(submitError)
                  ? getLocalizedApiMessage(submitError, locale as 'en' | 'ar')
                  : t('errors.generic'),
              );
            } finally {
              setIsCreating(false);
            }
          }}
        >
          <input name="plateNumber" type="text" required placeholder={t('vehicles.plate')} />
          <select name="vehicleType" defaultValue="flatbed">
            <option value="flatbed">flatbed</option>
            <option value="refrigerated">refrigerated</option>
            <option value="container">container</option>
            <option value="tanker">tanker</option>
            <option value="other">other</option>
          </select>
          <input name="capacityKg" type="number" min="0" placeholder={t('vehicles.capacity')} />
          <button type="submit" className="portal-button portal-button--primary" disabled={isCreating}>
            {isCreating ? t('vehicles.creating') : t('vehicles.create')}
          </button>
        </form>
      </section>

      {isLoading ? (
        <p className="muted-text">{t('loading')}</p>
      ) : vehicles.length === 0 ? (
        <p className="muted-text">{t('vehicles.empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('vehicles.plate')}</th>
                <th>{t('vehicles.type')}</th>
                <th>{t('vehicles.capacity')}</th>
                <th>{t('vehicles.active')}</th>
                <th>{t('vehicles.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.plateNumber}</td>
                  <td>{vehicle.vehicleType}</td>
                  <td>{vehicle.capacityKg ? `${vehicle.capacityKg} kg` : '—'}</td>
                  <td>{vehicle.isActive ? t('vehicles.yes') : t('vehicles.no')}</td>
                  <td>
                    <div className="details-actions">
                      <button
                        type="button"
                        className="portal-button portal-button--ghost"
                        onClick={() => {
                          void updateFleetVehicle(vehicle.id, { isActive: !vehicle.isActive })
                            .then((updated) => {
                              setVehicles((current) =>
                                current.map((item) => (item.id === updated.id ? updated : item)),
                              );
                            })
                            .catch((actionError) => {
                              setError(
                                isApiClientError(actionError)
                                  ? getLocalizedApiMessage(actionError, locale as 'en' | 'ar')
                                  : t('errors.generic'),
                              );
                            });
                        }}
                      >
                        {t('vehicles.toggleActive')}
                      </button>
                      <button
                        type="button"
                        className="portal-button portal-button--danger"
                        onClick={() => {
                          if (!window.confirm(t('vehicles.confirmDelete'))) {
                            return;
                          }
                          void deleteFleetVehicle(vehicle.id)
                            .then(() => {
                              setVehicles((current) =>
                                current.filter((item) => item.id !== vehicle.id),
                              );
                            })
                            .catch((actionError) => {
                              setError(
                                isApiClientError(actionError)
                                  ? getLocalizedApiMessage(actionError, locale as 'en' | 'ar')
                                  : t('errors.generic'),
                              );
                            });
                        }}
                      >
                        {t('vehicles.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FleetShell>
  );
}
