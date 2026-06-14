'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { AdminShell } from './admin-shell';

import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { listFleetOwners } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { FleetOwnerOption } from '@/types/admin';

export function AdminFleetOwnersContent() {
  const t = useTranslations('admin.fleetOwners');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [owners, setOwners] = useState<FleetOwnerOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listFleetOwners();
        if (!cancelled) setOwners(data);
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
      ) : owners.length === 0 ? (
        <p className="muted-text">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('company')}</th>
                <th>{t('email')}</th>
                <th>{t('phone')}</th>
                <th>{t('drivers')}</th>
                <th>{t('vehicles')}</th>
                <th>{t('kyc')}</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((owner) => (
                <tr key={owner.id}>
                  <td>{owner.companyName}</td>
                  <td>{owner.user.email}</td>
                  <td>{owner.user.phone ?? '—'}</td>
                  <td>{owner.driverCount}</td>
                  <td>{owner.vehicleCount}</td>
                  <td>{t(`kycStatus.${owner.kycStatus}`)}</td>
                  <td>{owner.user.isActive ? t('active') : t('inactive')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
