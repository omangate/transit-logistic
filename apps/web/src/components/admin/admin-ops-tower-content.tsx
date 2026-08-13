'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/admin/admin-shell';
import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { Link } from '@/i18n/navigation';
import { getAdminCustomsDashboard, getAdminLogisticsDashboard, listAdminOceanCarriers } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { AdminCustomsDashboard, AdminLogisticsDashboard } from '@/types/logistics';
import type { AdminCarrierConnection } from '@/types/ocean';

export function AdminOpsTowerContent() {
  const t = useTranslations('adminOpsTower');
  const tPortal = useTranslations('portal');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [ops, setOps] = useState<AdminLogisticsDashboard | null>(null);
  const [customs, setCustoms] = useState<AdminCustomsDashboard | null>(null);
  const [carriers, setCarriers] = useState<AdminCarrierConnection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    void Promise.all([getAdminLogisticsDashboard(), getAdminCustomsDashboard(), listAdminOceanCarriers()])
      .then(([opsData, customsData, carrierData]) => {
        setOps(opsData);
        setCustoms(customsData);
        setCarriers(carrierData);
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

  const carrierFailures = carriers.filter((carrier) => carrier.status === 'error' || carrier.lastError);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <AdminShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <FormError message={error} />
      {isLoading || !ops ? (
        <LoadingState message={t('loading')} />
      ) : (
        <>
          <section className="kpi-grid">
            <article className="kpi-card">
              <div className="kpi-card__label">{t('kpis.attention')}</div>
              <div className="kpi-card__value">{ops.kpis.pendingDocuments + ops.kpis.pendingQuotes}</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-card__label">{t('kpis.customsHolds')}</div>
              <div className="kpi-card__value">{customs?.awaitingDocs ?? 0}</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-card__label">{t('kpis.overdueCustoms')}</div>
              <div className="kpi-card__value">{ops.kpis.overdueCustoms}</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-card__label">{t('kpis.unpaid')}</div>
              <div className="kpi-card__value">{ops.kpis.transportPending}</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-card__label">{t('kpis.activeOrders')}</div>
              <div className="kpi-card__value">{ops.kpis.activeOrders}</div>
            </article>
            <article className="kpi-card">
              <div className="kpi-card__label">{t('kpis.carrierFailures')}</div>
              <div className="kpi-card__value">{carrierFailures.length}</div>
            </article>
          </section>

          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel__header">
                <h2 className="panel__title">{t('recentOrders')}</h2>
                <Link href="/admin/logistics" className="portal-link">
                  {t('viewAll')}
                </Link>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('table.reference')}</th>
                      <th>{t('table.status')}</th>
                      <th>{t('table.customer')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ops.recentOrders.slice(0, 8).map((order) => (
                      <tr key={order.id}>
                        <td>{order.referenceNumber}</td>
                        <td>{order.status}</td>
                        <td>{order.customer?.email ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="dashboard-grid__aside">
              <section className="panel">
                <div className="panel__header">
                  <h2 className="panel__title">{t('carrierAlerts')}</h2>
                  <Link href="/admin/integrations/ocean-carriers" className="portal-link">
                    {t('manage')}
                  </Link>
                </div>
                {carrierFailures.length === 0 ? (
                  <p className="muted-text">{t('noCarrierAlerts')}</p>
                ) : (
                  <ul className="attention-list">
                    {carrierFailures.map((carrier) => (
                      <li key={carrier.id} className="attention-list__item">
                        <span>
                          {carrier.displayName}: {carrier.lastError ?? carrier.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </AdminShell>
  );
}
