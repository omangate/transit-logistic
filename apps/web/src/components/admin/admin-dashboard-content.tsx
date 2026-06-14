'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { StatCard } from '../portal/stat-card';
import { StatusBadge } from '../portal/status-badge';

import { AdminShell } from './admin-shell';

import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { Link } from '@/i18n/navigation';
import { getAdminDashboardMetrics } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatAmount, formatDate, formatRoute } from '@/lib/shipment-utils';
import type { AdminDashboardMetrics } from '@/types/admin';

export function AdminDashboardContent() {
  const t = useTranslations('admin');
  const tShipments = useTranslations('shipments');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getAdminDashboardMetrics();
        if (!cancelled) {
          setMetrics(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            isApiClientError(loadError)
              ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
              : t('errors.generic'),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isReady, user, locale, t]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <AdminShell user={user} title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}>
      <FormError message={error} />

      {isLoading || !metrics ? (
        <p className="muted-text">{t('loading')}</p>
      ) : (
        <>
          <section className="stats-grid">
            <StatCard label={t('metrics.total')} value={metrics.shipments.total} />
            <StatCard label={t('metrics.active')} value={metrics.shipments.active} />
            <StatCard label={t('metrics.completed')} value={metrics.shipments.completed} />
            <StatCard label={t('metrics.cancelled')} value={metrics.shipments.cancelled} />
            <StatCard
              label={t('metrics.revenue')}
              value={formatAmount(metrics.revenue.total, metrics.revenue.currency)}
            />
            <StatCard
              label={t('metrics.pendingPayments')}
              value={metrics.pendingPayments.count}
            />
            <StatCard label={t('metrics.fleetOwners')} value={metrics.fleet.owners} />
            <StatCard label={t('metrics.drivers')} value={metrics.fleet.drivers} />
            <StatCard label={t('metrics.vehicles')} value={metrics.fleet.vehicles} />
            <StatCard
              label={t('metrics.pendingPayouts')}
              value={metrics.pendingPayoutRequests}
            />
          </section>

          <section className="panel" style={{ marginTop: '1.5rem' }}>
            <div className="panel__header">
              <h2 className="panel__title">{t('dashboard.recentTitle')}</h2>
              <Link href="/admin/shipments" className="portal-link">
                {t('dashboard.viewAll')}
              </Link>
            </div>

            {metrics.recentShipments.length === 0 ? (
              <p className="muted-text">{t('dashboard.emptyRecent')}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{tShipments('table.reference')}</th>
                      <th>{tShipments('table.route')}</th>
                      <th>{tShipments('table.status')}</th>
                      <th>{tShipments('table.created')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.recentShipments.map((shipment) => (
                      <tr key={shipment.id}>
                        <td>
                          <Link href={`/admin/shipments/${shipment.id}`} className="portal-link">
                            {shipment.referenceNumber}
                          </Link>
                        </td>
                        <td>{formatRoute(shipment)}</td>
                        <td>
                          <StatusBadge
                            status={shipment.status}
                            label={tShipments(`status.${shipment.status}`)}
                          />
                        </td>
                        <td>{formatDate(shipment.createdAt, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel" style={{ marginTop: '1.5rem' }}>
            <div className="panel__header">
              <h2 className="panel__title">{t('dashboard.notificationsTitle')}</h2>
              <Link href="/notifications" className="portal-link">
                {t('dashboard.viewNotifications')}
              </Link>
            </div>

            {metrics.latestNotifications.length === 0 ? (
              <p className="muted-text">{t('dashboard.emptyNotifications')}</p>
            ) : (
              <ul className="notification-list">
                {metrics.latestNotifications.map((notification) => (
                  <li key={notification.id} className="notification-list__item">
                    <strong>
                      {locale === 'ar' ? notification.titleAr : notification.titleEn}
                    </strong>
                    <p className="muted-text">
                      {locale === 'ar' ? notification.bodyAr : notification.bodyEn}
                    </p>
                    <span className="muted-text" style={{ fontSize: '0.8125rem' }}>
                      {formatDate(notification.createdAt, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
