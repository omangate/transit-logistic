'use client';

import { ShipmentStatus } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { StatCard } from '../portal/stat-card';
import { StatusBadge } from '../portal/status-badge';

import { FleetShell } from './fleet-shell';

import { useRequireFleetAuth } from '@/hooks/use-require-fleet-auth';
import { Link } from '@/i18n/navigation';
import { getMyWallet, listShipments } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { countShipmentsByStatus, formatAmount, formatDate, formatRoute } from '@/lib/shipment-utils';
import type { Shipment } from '@/types/shipment';
import type { Wallet } from '@/types/wallet';

export function FleetDashboardContent() {
  const t = useTranslations('fleet');
  const tShipments = useTranslations('shipments');
  const locale = useLocale();
  const { user, isReady } = useRequireFleetAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
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
        const [shipmentsResponse, walletData] = await Promise.all([
          listShipments({ page: 1, limit: 100 }),
          getMyWallet(),
        ]);

        if (!cancelled && currentLoad === loadVersion) {
          setShipments(shipmentsResponse.data);
          setWallet(walletData);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled && currentLoad === loadVersion) {
          setError(
            isApiClientError(loadError)
              ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
              : t('errors.generic'),
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
    <FleetShell user={user} title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}>
      <FormError message={error} />

      <section className="stats-grid">
        <StatCard
          label={t('dashboard.earnings')}
          value={
            isLoading || !wallet
              ? '…'
              : formatAmount(wallet.balance, wallet.currency)
          }
        />
        <StatCard
          label={t('dashboard.assigned')}
          value={
            isLoading
              ? '…'
              : countShipmentsByStatus(shipments, ShipmentStatus.ASSIGNED)
          }
        />
        <StatCard
          label={t('dashboard.inProgress')}
          value={
            isLoading
              ? '…'
              : countShipmentsByStatus(shipments, ShipmentStatus.PICKED_UP) +
                countShipmentsByStatus(shipments, ShipmentStatus.IN_TRANSIT)
          }
        />
        <StatCard
          label={t('dashboard.completed')}
          value={
            isLoading
              ? '…'
              : countShipmentsByStatus(shipments, ShipmentStatus.COMPLETED)
          }
        />
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2 className="panel__title">{t('dashboard.recentTitle')}</h2>
          <Link href="/fleet/shipments" className="portal-link">
            {t('dashboard.viewAll')}
          </Link>
        </div>

        {isLoading ? (
          <p className="muted-text">{t('loading')}</p>
        ) : recentShipments.length === 0 ? (
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
                {recentShipments.map((shipment) => (
                  <tr key={shipment.id}>
                    <td>{shipment.referenceNumber}</td>
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
    </FleetShell>
  );
}
