'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { AdminShell } from './admin-shell';

import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { listFleetDrivers } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { FleetDriverOption } from '@/types/admin';

export function AdminDriversContent() {
  const t = useTranslations('admin.drivers');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [drivers, setDrivers] = useState<FleetDriverOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listFleetDrivers();
        if (!cancelled) setDrivers(data);
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
      ) : drivers.length === 0 ? (
        <p className="muted-text">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('email')}</th>
                <th>{t('phone')}</th>
                <th>{t('license')}</th>
                <th>{t('available')}</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td>{driver.user.email}</td>
                  <td>{driver.user.phone ?? '—'}</td>
                  <td>{driver.licenseNumber}</td>
                  <td>{driver.isAvailable ? t('yes') : t('no')}</td>
                  <td>{driver.user.isActive ? t('active') : t('inactive')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
