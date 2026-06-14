'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { AdminShell } from './admin-shell';

import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { listFleetVehicles } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { FleetVehicleOption } from '@/types/admin';

export function AdminVehiclesContent() {
  const t = useTranslations('admin.vehicles');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [vehicles, setVehicles] = useState<FleetVehicleOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listFleetVehicles();
        if (!cancelled) setVehicles(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            isApiClientError(loadError)
              ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
              : t('errors.generic'),
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [isReady, user, locale, t]);

  if (!isReady || !user) return <LoadingState message={t('loading')} />;

  return (
    <AdminShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <FormError message={error} />
      {isLoading ? (
        <p className="muted-text">{t('loading')}</p>
      ) : vehicles.length === 0 ? (
        <p className="muted-text">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('plate')}</th>
                <th>{t('type')}</th>
                <th>{t('capacity')}</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.plateNumber}</td>
                  <td>{vehicle.vehicleType}</td>
                  <td>{vehicle.capacityKg ? `${vehicle.capacityKg} kg` : '—'}</td>
                  <td>{vehicle.isActive ? t('active') : t('inactive')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
