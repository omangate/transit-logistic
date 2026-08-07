'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/admin/admin-shell';
import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { getAdminCustomsDashboard, updateAdminCustomsStatus } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';

export function AdminLogisticsDashboardContent() {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireAdminAuth();
  const [data, setData] = useState<{ recent: Array<{ id: string; referenceNumber: string; status: string }>; awaitingDocs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = () => {
    if (!user) return;
    setIsLoading(true);
    void getAdminCustomsDashboard()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) => setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic')))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!isReady || !user) return;
    reload();
  }, [isReady, locale, t, user]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <AdminShell user={user} title={t('admin.title')}>
      {error ? <FormError message={error} /> : null}
      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : data ? (
        <>
          <p>{t('admin.awaitingDocs', { count: data.awaitingDocs })}</p>
          <div className="logistics-table">
            {data.recent.map((row) => (
              <div key={row.id} className="logistics-table__row logistics-table__row--admin">
                <strong>{row.referenceNumber}</strong>
                <span className="logistics-badge">{row.status.replace(/_/g, ' ')}</span>
                <button type="button" className="rental-btn rental-btn--ghost" onClick={() => void updateAdminCustomsStatus(row.id, 'clearance_in_progress').then(reload)}>
                  {t('admin.startClearance')}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}
