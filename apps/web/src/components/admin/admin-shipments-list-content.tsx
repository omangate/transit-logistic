'use client';

import { ShipmentStatus } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { StatusBadge } from '../portal/status-badge';

import { AdminShell } from './admin-shell';

import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { Link } from '@/i18n/navigation';
import { exportAdminShipmentsCsv, exportAdminShipmentsPdf, listShipments } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatDate, formatRoute } from '@/lib/shipment-utils';
import type { Shipment } from '@/types/shipment';

const STATUS_FILTERS: Array<ShipmentStatus | 'all'> = [
  'all',
  ShipmentStatus.PENDING_ASSIGNMENT,
  ShipmentStatus.ASSIGNED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.COMPLETED,
  ShipmentStatus.CANCELLED,
];

export function AdminShipmentsListContent() {
  const t = useTranslations('admin');
  const tShipments = useTranslations('shipments');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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
        const response = await listShipments({
          page,
          limit: 20,
          ...(statusFilter === 'all' ? {} : { status: statusFilter }),
          ...(search ? { search } : {}),
        });
        if (!cancelled) {
          setShipments(response.data);
          setTotalPages(response.meta.totalPages);
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
  }, [isReady, user, locale, statusFilter, search, page, t]);

  async function downloadExport(kind: 'csv' | 'pdf') {
    const query = {
      page: 1,
      limit: 1000,
      ...(statusFilter === 'all' ? {} : { status: statusFilter }),
      ...(search ? { search } : {}),
    };

    const blob =
      kind === 'csv'
        ? await exportAdminShipmentsCsv(query)
        : await exportAdminShipmentsPdf(query);

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `shipments.${kind}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <AdminShell user={user} title={t('shipments.title')} subtitle={t('shipments.subtitle')}>
      <FormError message={error} />

      <div className="filter-bar filter-bar--stacked">
        <input
          type="search"
          className="portal-input"
          placeholder={t('shipments.searchPlaceholder')}
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />

        <div className="filter-bar">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              className={`filter-chip${statusFilter === status ? ' filter-chip--active' : ''}`}
              onClick={() => {
                setPage(1);
                setStatusFilter(status);
              }}
            >
              {status === 'all' ? t('shipments.filters.all') : tShipments(`status.${status}`)}
            </button>
          ))}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="portal-button portal-button--ghost"
            onClick={() => void downloadExport('csv')}
          >
            {t('shipments.exportCsv')}
          </button>
          <button
            type="button"
            className="portal-button portal-button--ghost"
            onClick={() => void downloadExport('pdf')}
          >
            {t('shipments.exportPdf')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="muted-text">{t('loading')}</p>
      ) : shipments.length === 0 ? (
        <div className="empty-state">
          <p>{t('shipments.empty')}</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{tShipments('table.reference')}</th>
                  <th>{tShipments('table.route')}</th>
                  <th>{tShipments('table.cargo')}</th>
                  <th>{tShipments('table.status')}</th>
                  <th>{tShipments('table.created')}</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment) => (
                  <tr key={shipment.id}>
                    <td>
                      <Link href={`/admin/shipments/${shipment.id}`} className="portal-link">
                        {shipment.referenceNumber}
                      </Link>
                    </td>
                    <td>{formatRoute(shipment)}</td>
                    <td>{shipment.cargoDescription ?? '—'}</td>
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

          <div className="pagination-bar">
            <button
              type="button"
              className="portal-button portal-button--ghost"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t('shipments.pagination.prev')}
            </button>
            <span className="muted-text">
              {t('shipments.pagination.page', { page, total: totalPages })}
            </span>
            <button
              type="button"
              className="portal-button portal-button--ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('shipments.pagination.next')}
            </button>
          </div>
        </>
      )}
    </AdminShell>
  );
}
