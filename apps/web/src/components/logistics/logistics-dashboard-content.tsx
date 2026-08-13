'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { DataTable } from '@/components/ui/data-table';
import { IntegrationStatusBadge } from '@/components/ui/premium';
import { useRequireCustomerAuth } from '@/hooks/use-require-customer-auth';
import { Link } from '@/i18n/navigation';
import { createLogisticsOrder, getLogisticsDashboard } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { LogisticsDashboard, LogisticsOrder } from '@/types/logistics';

export function LogisticsDashboardContent() {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireCustomerAuth();
  const [data, setData] = useState<LogisticsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;

    let cancelled = false;
    setIsLoading(true);

    void getLogisticsDashboard()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isReady, locale, t, user]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <PortalShell
      user={user}
      title={t('dashboard.title')}
      subtitle={t('dashboard.subtitle')}
      action={
        <button
          type="button"
          className="rental-btn rental-btn--primary"
          onClick={() =>
            void createLogisticsOrder({ title: t('dashboard.defaultOrderTitle') }).then((order) => {
              window.location.href = `/${locale}/logistics/orders/${order.id}`;
            })
          }
        >
          {t('dashboard.newOrder')}
        </button>
      }
    >
      {error ? <FormError message={error} /> : null}
      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : data ? (
        <>
          <div className="logistics-metrics">
            {Object.entries(data.counts).map(([key, value]) => (
              <div key={key} className="logistics-metric">
                <strong>{value}</strong>
                <span>{t(`dashboard.metrics.${key}` as never)}</span>
              </div>
            ))}
          </div>

          <section className="logistics-services">
            <Link href="/customs/requests" className="logistics-service-card">{t('services.customs')}</Link>
            <Link href="/freight/shipments" className="logistics-service-card">{t('services.freight')}</Link>
            <Link href="/shipments" className="logistics-service-card">{t('services.shipments')}</Link>
            <Link href="/marketplace" className="logistics-service-card">{t('services.trucks')}</Link>
            <Link href="/notifications" className="logistics-service-card">{t('portal.notifications')}</Link>
          </section>

          <section className="logistics-panel" style={{ marginTop: '1.5rem' }}>
            <h2>{t('portal.quickLinks')}</h2>
            <div className="logistics-hero__actions">
              <Link href="/customs/new" className="rental-btn rental-btn--ghost">{t('customs.newRequest')}</Link>
              <Link href="/freight/request" className="rental-btn rental-btn--ghost">{t('freight.newRequest')}</Link>
              <Link href="/marketplace/quotes" className="rental-btn rental-btn--ghost">{t('portal.quotes')}</Link>
              <Link href="/payments" className="rental-btn rental-btn--ghost">{t('portal.payments')}</Link>
            </div>
          </section>

          {data.recentOrders.length ? (
            <section className="logistics-panel" style={{ marginTop: '1.5rem' }}>
              <h2>{t('dashboard.recentOrders')}</h2>
              <DataTable
                rows={data.recentOrders as LogisticsOrder[]}
                columns={[
                  {
                    id: 'reference',
                    header: t('dashboard.table.reference'),
                    accessor: (order) => order.referenceNumber,
                    render: (order) => (
                      <Link href={`/logistics/orders/${order.id}`} className="portal-link">
                        {order.referenceNumber}
                      </Link>
                    ),
                  },
                  { id: 'title', header: t('dashboard.table.title'), accessor: (order) => order.title ?? '—' },
                  {
                    id: 'status',
                    header: t('dashboard.table.status'),
                    accessor: (order) => order.status,
                    render: (order) => (
                      <IntegrationStatusBadge status={order.status} label={order.status.replace(/_/g, ' ')} />
                    ),
                  },
                ]}
                searchPlaceholder={t('admin.search')}
                emptyMessage={t('dashboard.noOrders')}
                exportFileName="logistics-orders.csv"
                mobileCardTitle={(order) => order.referenceNumber}
                mobileCardSubtitle={(order) => order.title ?? order.status}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </PortalShell>
  );
}
