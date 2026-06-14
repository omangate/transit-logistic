'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { AdminShell } from './admin-shell';

import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { listAdminRatings } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatDate } from '@/lib/shipment-utils';
import type { AdminRating } from '@/types/admin';

export function AdminRatingsContent() {
  const t = useTranslations('admin.ratings');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [ratings, setRatings] = useState<AdminRating[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listAdminRatings();
        if (!cancelled) setRatings(data.data);
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
      ) : ratings.length === 0 ? (
        <p className="muted-text">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('shipment')}</th>
                <th>{t('customer')}</th>
                <th>{t('fleetOwner')}</th>
                <th>{t('score')}</th>
                <th>{t('comment')}</th>
                <th>{t('date')}</th>
              </tr>
            </thead>
            <tbody>
              {ratings.map((rating) => (
                <tr key={rating.id}>
                  <td>{rating.shipmentReference}</td>
                  <td>{rating.customerName ?? rating.customerEmail}</td>
                  <td>{rating.fleetOwnerName}</td>
                  <td>{rating.score}/5</td>
                  <td>{rating.comment ?? '—'}</td>
                  <td>{formatDate(rating.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
