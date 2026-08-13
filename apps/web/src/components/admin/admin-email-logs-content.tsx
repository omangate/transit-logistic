'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/admin/admin-shell';
import { LoadingState } from '@/components/portal/loading-state';
import { DataTable } from '@/components/ui/data-table';
import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { getEmailProviderStatus, listAdminEmailDeliveryLogs } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { EmailDeliveryLogEntry, EmailProviderStatus } from '@/types/global-tracking';

export function AdminEmailLogsContent() {
  const t = useTranslations('adminEmailLogs');
  const tPortal = useTranslations('portal');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [rows, setRows] = useState<EmailDeliveryLogEntry[]>([]);
  const [provider, setProvider] = useState<EmailProviderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    setIsLoading(true);
    void Promise.all([listAdminEmailDeliveryLogs({ page: 1, limit: 50 }), getEmailProviderStatus()])
      .then(([logs, status]) => {
        setRows(logs.data);
        setProvider(status);
        setError(null);
      })
      .catch((loadError) => {
        setError(
          isApiClientError(loadError)
            ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
            : tPortal('errors.generic'),
        );
      })
      .finally(() => setIsLoading(false));
  }, [isReady, locale, tPortal]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <AdminShell user={user} title={t('title')} subtitle={t('subtitle')}>
      {provider ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <p>
            {t('provider')}: <strong>{provider.provider}</strong> · {t('from')}: <strong>{provider.from}</strong> ·{' '}
            {provider.configured ? t('configuredYes') : t('configuredNo')}
          </p>
          {provider.missingCredentials?.length ? (
            <p className="form-error-inline">
              {t('missingCredentials')}: {provider.missingCredentials.join(', ')}
            </p>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="form-error-inline">{error}</p> : null}

      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : (
        <DataTable
          rows={rows}
          columns={[
            { id: 'recipient', header: t('table.recipient'), accessor: (row) => row.recipientEmail },
            { id: 'event', header: t('table.event'), accessor: (row) => row.templateEvent },
            { id: 'reference', header: t('table.reference'), accessor: (row) => row.entityId ?? '—' },
            { id: 'provider', header: t('table.provider'), accessor: (row) => row.provider ?? '—' },
            { id: 'status', header: t('table.status'), accessor: (row) => row.status },
            { id: 'sent', header: t('table.sent'), accessor: (row) => row.sentAt ?? '—' },
            { id: 'delivered', header: t('table.delivered'), accessor: (row) => row.deliveredAt ?? '—' },
          ]}
          emptyMessage={t('empty')}
        />
      )}
    </AdminShell>
  );
}
