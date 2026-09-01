'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/admin/admin-shell';
import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { IntegrationStatusBadge } from '@/components/ui/premium';
import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { Link } from '@/i18n/navigation';
import { getAdminCustomsDashboard, getAdminLogisticsDashboard, updateAdminCustomsStatus } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { AdminLogisticsDashboard } from '@/types/logistics';

type AdminOrderRow = AdminLogisticsDashboard['recentOrders'][number];
type CustomsRow = { id: string; referenceNumber: string; status: string };

export function AdminLogisticsDashboardContent() {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireAdminAuth();
  const [customsData, setCustomsData] = useState<{ recent: CustomsRow[]; awaitingDocs: number } | null>(null);
  const [opsData, setOpsData] = useState<AdminLogisticsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = () => {
    if (!user) return;
    setIsLoading(true);
    Promise.all([getAdminCustomsDashboard(), getAdminLogisticsDashboard()])
      .then(([customs, ops]) => {
        setCustomsData(customs);
        setOpsData(ops);
        setError(null);
      })
      .catch((err) => setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic')))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!isReady || !user) return;
    reload();
  }, [isReady, locale, t, user]);

  const orderColumns: DataTableColumn<AdminOrderRow>[] = [
    {
      id: 'reference',
      header: t('dashboard.table.reference'),
      accessor: (row) => row.referenceNumber,
      render: (row) => (
        <Link href={`/logistics/orders/${row.id}`} className="portal-link">
          {row.referenceNumber}
        </Link>
      ),
    },
    {
      id: 'customer',
      header: t('admin.table.customer'),
      accessor: (row) => row.customer?.customerProfile?.fullName ?? row.customer?.email ?? '—',
    },
    {
      id: 'status',
      header: t('dashboard.table.status'),
      accessor: (row) => row.status,
      render: (row) => <IntegrationStatusBadge status={row.status} label={row.status.replace(/_/g, ' ')} />,
    },
    {
      id: 'actions',
      header: t('admin.table.actions'),
      accessor: () => '',
      render: (row) => (
        <>
          {(row.customsRequests ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              className="rental-btn rental-btn--ghost"
              onClick={() => void updateAdminCustomsStatus(c.id, 'clearance_in_progress').then(reload)}
            >
              {c.referenceNumber}: {t('admin.startClearance')}
            </button>
          ))}
        </>
      ),
    },
  ];

  const customsColumns: DataTableColumn<CustomsRow>[] = [
    { id: 'reference', header: t('customs.fields.reference'), accessor: (row) => row.referenceNumber },
    {
      id: 'status',
      header: t('customs.fields.status'),
      accessor: (row) => row.status,
      render: (row) => <IntegrationStatusBadge status={row.status} label={row.status.replace(/_/g, ' ')} />,
    },
    {
      id: 'actions',
      header: t('admin.table.actions'),
      accessor: () => '',
      render: (row) => (
        <>
          <Link href={`/admin/logistics/customs/${row.id}/prepare`} className="rental-btn rental-btn--ghost">
            {t('customsPrep.title')}
          </Link>
          <button
            type="button"
            className="rental-btn rental-btn--ghost"
            onClick={() => void updateAdminCustomsStatus(row.id, 'clearance_in_progress').then(reload)}
          >
            {t('admin.startClearance')}
          </button>
        </>
      ),
    },
  ];

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <AdminShell
      user={user}
      title={t('admin.title')}
      action={
        <div className="admin-shell__actions">
          <Link href="/admin/logistics/customs/hs-tariff" className="rental-btn rental-btn--ghost">
            {t('customsPrep.hsAdminTitle')}
          </Link>
          <Link href="/admin/logistics/checklist-templates" className="rental-btn rental-btn--ghost">
            {t('checklistTemplates.manage')}
          </Link>
        </div>
      }
    >
      {error ? <FormError message={error} /> : null}
      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : opsData && customsData ? (
        <>
          <div className="logistics-metrics">
            {Object.entries(opsData.kpis).map(([key, value]) => (
              <div key={key} className="logistics-metric">
                <strong>{value}</strong>
                <span>{t(`admin.kpis.${key}` as never)}</span>
              </div>
            ))}
          </div>

          <p>{t('admin.awaitingDocs', { count: customsData.awaitingDocs })}</p>

          <DataTable
            rows={opsData.recentOrders}
            columns={orderColumns}
            searchPlaceholder={t('admin.search')}
            emptyMessage={t('dashboard.noOrders')}
            exportFileName="admin-logistics-orders.csv"
            mobileCardTitle={(row) => row.referenceNumber}
            mobileCardSubtitle={(row) => row.customer?.email ?? row.status}
          />

          <section className="logistics-panel" style={{ marginTop: '2rem' }}>
            <h2>{t('admin.recentCustoms')}</h2>
            <DataTable
              rows={customsData.recent}
              columns={customsColumns}
              searchPlaceholder={t('admin.search')}
              emptyMessage={t('customs.empty')}
              exportFileName="admin-customs.csv"
              mobileCardTitle={(row) => row.referenceNumber}
              mobileCardSubtitle={(row) => row.status}
            />
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
