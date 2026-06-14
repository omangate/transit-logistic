'use client';

import { ShipmentStatus } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from './form-error';
import { LoadingState } from './portal/loading-state';
import { PortalShell } from './portal/portal-shell';
import { StatCard } from './portal/stat-card';
import { StatusBadge } from './portal/status-badge';


import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link } from '@/i18n/navigation';
import { listShipments } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { countActiveShipments, countShipmentsByStatus, formatDate, formatRoute } from '@/lib/shipment-utils';
import type { Shipment } from '@/types/shipment';

export function DashboardContent() {
  const t = useTranslations('dashboard');
  const tPortal = useTranslations('portal');
  const tShipments = useTranslations('shipments');
  const locale = useLocale();
  const { user, isReady } = useRequireAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
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
        const response = await listShipments({ page: 1, limit: 100 });
        if (!cancelled && currentLoad === loadVersion) {
          setShipments(response.data);
          setTotal(response.meta.total);
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
    return <LoadingState message={t('loading')} />;
  }

  const recentShipments = shipments.slice(0, 5);

  return (
    <PortalShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <FormError message={error} />

      <section className="stats-grid">
        <StatCard label={t('stats.total')} value={isLoading ? '…' : total} />
        <StatCard
          label={t('stats.active')}
          value={isLoading ? '…' : countActiveShipments(shipments)}
        />
        <StatCard
          label={t('stats.draft')}
          value={isLoading ? '…' : countShipmentsByStatus(shipments, ShipmentStatus.DRAFT)}
        />
        <StatCard
          label={t('stats.completed')}
          value={isLoading ? '…' : countShipmentsByStatus(shipments, ShipmentStatus.COMPLETED)}
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2 className="panel__title">{t('recentTitle')}</h2>
          <Link href="/shipments" className="portal-link">
            {t('viewAll')}
          </Link>
        </div>

        {isLoading ? (
          <p className="muted-text">{t('loading')}</p>
        ) : recentShipments.length === 0 ? (
          <div className="empty-state">
            <p>{t('emptyRecent')}</p>
            <Link href="/shipments/new" className="portal-button portal-button--primary">
              {t('createFirst')}
            </Link>
          </div>
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
                {recentShipments.map((shipment) => (
                  <tr key={shipment.id}>
                    <td>
                      <Link href={`/shipments/${shipment.id}`} className="portal-link">
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
    </PortalShell>
  );
}
