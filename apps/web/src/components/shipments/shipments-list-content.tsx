'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { PortalShell } from '../portal/portal-shell';
import { StatusBadge } from '../portal/status-badge';

import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link } from '@/i18n/navigation';
import { listShipments } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatDate, formatRoute } from '@/lib/shipment-utils';
import type { Shipment } from '@/types/shipment';

export function ShipmentsListContent() {
  const t = useTranslations('shipments');
  const tPortal = useTranslations('portal');
  const locale = useLocale();
  const { user, isReady } = useRequireAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    let cancelled = false;
    let loadVersion = 0;

    async function load() {
      const currentLoad = ++loadVersion;
      setIsLoading(true);
      setError(null);

      try {
        const response = await listShipments({ page: 1, limit: 50 });
        if (!cancelled && currentLoad === loadVersion) {
          setShipments(response.data);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled && currentLoad === loadVersion) {
          setError(
            isApiClientError(loadError)
              ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
              : tPortal('errors.generic'),
          );
        }
      } finally {
        if (!cancelled && currentLoad === loadVersion) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isReady, user, locale]);

  if (!isReady || !user) {
    return <LoadingState message={tPortal('loading')} />;
  }

  const columns: DataTableColumn<Shipment>[] = [
    {
      id: 'reference',
      header: t('table.reference'),
      accessor: (s) => s.referenceNumber,
      render: (s) => (
        <Link href={`/shipments/${s.id}`} className="portal-link">
          {s.referenceNumber}
        </Link>
      ),
    },
    { id: 'route', header: t('table.route'), accessor: (s) => formatRoute(s) },
    { id: 'cargo', header: t('table.cargo'), accessor: (s) => s.cargoDescription ?? '—' },
    {
      id: 'status',
      header: t('table.status'),
      accessor: (s) => s.status,
      render: (s) => <StatusBadge status={s.status} label={t(`status.${s.status}`)} />,
    },
    { id: 'created', header: t('table.created'), accessor: (s) => formatDate(s.createdAt, locale) },
  ];

  return (
    <PortalShell
      user={user}
      title={t('listTitle')}
      subtitle={t('listSubtitle')}
      action={
        <Link href="/shipments/new" className="portal-button portal-button--primary">
          {t('createButton')}
        </Link>
      }
    >
      <FormError message={error} />

      {isLoading ? (
        <p className="muted-text">{tPortal('loading')}</p>
      ) : shipments.length === 0 ? (
        <div className="empty-state">
          <p>{t('emptyList')}</p>
          <Link href="/shipments/new" className="portal-button portal-button--primary">
            {t('createButton')}
          </Link>
        </div>
      ) : (
        <section className="panel">
          <DataTable
            rows={shipments}
            columns={columns}
            searchPlaceholder={t('listSubtitle')}
            emptyMessage={t('emptyList')}
            exportFileName="shipments.csv"
            mobileCardTitle={(s) => s.referenceNumber}
            mobileCardSubtitle={(s) => formatRoute(s)}
          />
        </section>
      )}
    </PortalShell>
  );
}
