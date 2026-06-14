'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { PortalShell } from '../portal/portal-shell';
import { StatusBadge } from '../portal/status-badge';

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
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('table.reference')}</th>
                <th>{t('table.route')}</th>
                <th>{t('table.cargo')}</th>
                <th>{t('table.status')}</th>
                <th>{t('table.created')}</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td>
                    <Link href={`/shipments/${shipment.id}`} className="portal-link">
                      {shipment.referenceNumber}
                    </Link>
                  </td>
                  <td>{formatRoute(shipment)}</td>
                  <td>{shipment.cargoDescription ?? '—'}</td>
                  <td>
                    <StatusBadge
                      status={shipment.status}
                      label={t(`status.${shipment.status}`)}
                    />
                  </td>
                  <td>{formatDate(shipment.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalShell>
  );
}
