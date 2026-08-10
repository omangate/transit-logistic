'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { AdminShell } from '@/components/admin/admin-shell';
import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { Link } from '@/i18n/navigation';
import { getAdminCustomsDashboard, getAdminLogisticsDashboard, updateAdminCustomsStatus } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { AdminLogisticsDashboard } from '@/types/logistics';

export function AdminLogisticsDashboardContent() {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireAdminAuth();
  const [customsData, setCustomsData] = useState<{ recent: Array<{ id: string; referenceNumber: string; status: string }>; awaitingDocs: number } | null>(null);
  const [opsData, setOpsData] = useState<AdminLogisticsDashboard | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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

  const filteredOrders = useMemo(() => {
    if (!opsData) return [];
    return opsData.recentOrders.filter((row) => {
      const matchesSearch =
        !search.trim() ||
        row.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
        (row.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (row.customer?.email ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [opsData, search, statusFilter]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <AdminShell
      user={user}
      title={t('admin.title')}
      action={
        <Link href="/admin/logistics/checklist-templates" className="rental-btn rental-btn--ghost">
          {t('checklistTemplates.manage')}
        </Link>
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

          <div className="logistics-form logistics-form--inline" style={{ marginBottom: '1rem' }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.search')} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('admin.filterAll')}</option>
              <option value="draft">{t('admin.filterDraft')}</option>
              <option value="in_progress">{t('admin.filterInProgress')}</option>
              <option value="completed">{t('admin.filterCompleted')}</option>
            </select>
          </div>

          <div className="logistics-table">
            {filteredOrders.map((row) => (
              <div key={row.id} className="logistics-table__row logistics-table__row--admin">
                <Link href={`/logistics/orders/${row.id}`}>
                  <strong>{row.referenceNumber}</strong>
                </Link>
                <span>{row.customer?.customerProfile?.fullName ?? row.customer?.email ?? '—'}</span>
                <span className="logistics-badge">{row.status.replace(/_/g, ' ')}</span>
                {(row.customsRequests ?? []).map((c) => (
                  <button key={c.id} type="button" className="rental-btn rental-btn--ghost" onClick={() => void updateAdminCustomsStatus(c.id, 'clearance_in_progress').then(reload)}>
                    {c.referenceNumber}: {t('admin.startClearance')}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <section className="logistics-panel" style={{ marginTop: '2rem' }}>
            <h2>{t('admin.recentCustoms')}</h2>
            <div className="logistics-table">
              {customsData.recent.map((row) => (
                <div key={row.id} className="logistics-table__row logistics-table__row--admin">
                  <strong>{row.referenceNumber}</strong>
                  <span className="logistics-badge">{row.status.replace(/_/g, ' ')}</span>
                  <button type="button" className="rental-btn rental-btn--ghost" onClick={() => void updateAdminCustomsStatus(row.id, 'clearance_in_progress').then(reload)}>
                    {t('admin.startClearance')}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
