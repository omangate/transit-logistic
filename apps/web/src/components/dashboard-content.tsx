'use client';

import { ShipmentStatus } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { FormError } from './form-error';
import { LoadingState } from './portal/loading-state';
import { PortalShell } from './portal/portal-shell';
import { StatusBadge } from './portal/status-badge';
import { EmptyPanel, KpiCard, ShipmentPipeline } from './ui/premium';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link, useRouter } from '@/i18n/navigation';
import { getLogisticsDashboard, getTrackingSummary, listShipments } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { countActiveShipments, countShipmentsByStatus, formatDate, formatRoute } from '@/lib/shipment-utils';
import type { TrackingSummary } from '@/types/global-tracking';
import type { LogisticsDashboard } from '@/types/logistics';
import { SHIPMENT_PIPELINE_STAGES, type ShipmentPipelineStage } from '@/types/ocean';
import type { Shipment } from '@/types/shipment';

function mapStatusToPipelineStage(status: string): ShipmentPipelineStage {
  switch (status) {
    case ShipmentStatus.DRAFT:
    case 'draft':
      return 'booking';
    case ShipmentStatus.PENDING_ASSIGNMENT:
    case 'pending_assignment':
    case ShipmentStatus.ASSIGNED:
    case 'assigned':
      return 'confirmed';
    case ShipmentStatus.PICKED_UP:
    case 'picked_up':
      return 'origin';
    case ShipmentStatus.IN_TRANSIT:
    case 'in_transit':
      return 'in_transit';
    case ShipmentStatus.DELIVERED:
    case 'delivered':
      return 'delivery';
    case ShipmentStatus.COMPLETED:
    case 'completed':
      return 'completed';
    default:
      return 'booking';
  }
}

export function DashboardContent() {
  const t = useTranslations('dashboard');
  const tPortal = useTranslations('portal');
  const tShipments = useTranslations('shipments');
  const locale = useLocale();
  const router = useRouter();
  const { user, isReady } = useRequireAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [logistics, setLogistics] = useState<LogisticsDashboard | null>(null);
  const [trackingSummary, setTrackingSummary] = useState<TrackingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const [shipmentResponse, logisticsResponse, summaryResponse] = await Promise.all([
          listShipments({ page: 1, limit: 100 }),
          getLogisticsDashboard().catch(() => null),
          getTrackingSummary().catch(() => null),
        ]);

        if (!cancelled) {
          setShipments(shipmentResponse.data);
          setLogistics(logisticsResponse);
          setTrackingSummary(summaryResponse);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            isApiClientError(loadError)
              ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
              : tPortal('errors.generic'),
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
  }, [isReady, user, locale, tPortal]);

  const attentionItems = useMemo(() => {
    const items: Array<{ id: string; label: string; href: string }> = [];
    if (logistics?.counts.pendingQuotes) {
      items.push({
        id: 'quotes',
        label: t('attention.pendingQuotes', { count: logistics.counts.pendingQuotes }),
        href: '/freight/request',
      });
    }
    if (logistics?.counts.customs) {
      items.push({
        id: 'customs',
        label: t('attention.customs', { count: logistics.counts.customs }),
        href: '/customs/requests',
      });
    }
    const draftCount = countShipmentsByStatus(shipments, ShipmentStatus.DRAFT);
    if (draftCount > 0) {
      items.push({
        id: 'drafts',
        label: t('attention.draftShipments', { count: draftCount }),
        href: '/shipments',
      });
    }
    return items.slice(0, 5);
  }, [logistics, shipments, t]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  const recentShipments = shipments.slice(0, 5);
  const inTransitCount = countShipmentsByStatus(shipments, ShipmentStatus.IN_TRANSIT);
  const activePipelineStage = mapStatusToPipelineStage(
    recentShipments[0]?.status ?? ShipmentStatus.DRAFT,
  );

  return (
    <PortalShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <FormError message={error} />

      <section className="dashboard-hero">
        <div className="dashboard-hero__top">
          <div className="dashboard-hero__welcome">
            <h2>{t('welcome', { name: user.email.split('@')[0] ?? user.email })}</h2>
            <p>{t('todayFocus')}</p>
          </div>
          <div className="dashboard-hero__actions">
            <Link href="/shipments/new" className="portal-button portal-button--primary">
              {t('actions.createShipment')}
            </Link>
            <Link href="/freight/request" className="portal-button portal-button--secondary">
              {t('actions.requestQuote')}
            </Link>
            <Link href="/track" className="portal-button portal-button--ghost">
              {t('actions.trackShipment')}
            </Link>
          </div>
        </div>

        <form
          className="dashboard-search"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = searchQuery.trim();
            if (trimmed) {
              router.push(`/track/${encodeURIComponent(trimmed)}`);
            }
          }}
        >
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
          />
          <button type="submit" className="portal-button portal-button--primary">
            {t('actions.trackShipment')}
          </button>
        </form>
      </section>

      <section className="kpi-grid">
        <KpiCard label={t('stats.activeShipments')} value={isLoading ? '…' : countActiveShipments(shipments)} />
        <KpiCard label={t('stats.inTransit')} value={isLoading ? '…' : inTransitCount} />
        <KpiCard label={t('stats.oceanActive')} value={isLoading ? '…' : (trackingSummary?.ocean.active ?? 0)} />
        <KpiCard label={t('stats.airActive')} value={isLoading ? '…' : (trackingSummary?.air.active ?? 0)} />
        <KpiCard label={t('stats.roadActive')} value={isLoading ? '…' : (trackingSummary?.road.active ?? 0)} />
        <KpiCard
          label={t('stats.trackingActionRequired')}
          value={
            isLoading
              ? '…'
              : (trackingSummary?.ocean.actionRequired ?? 0) +
                (trackingSummary?.air.actionRequired ?? 0) +
                (trackingSummary?.road.actionRequired ?? 0)
          }
        />
        <KpiCard
          label={t('stats.customsClearance')}
          value={isLoading ? '…' : (logistics?.counts.customs ?? 0)}
        />
        <KpiCard
          label={t('stats.outstandingQuotes')}
          value={isLoading ? '…' : (logistics?.counts.pendingQuotes ?? 0)}
        />
        <KpiCard label={t('stats.outstandingPayments')} value={isLoading ? '…' : '—'} />
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2 className="panel__title">{t('pipelineTitle')}</h2>
        </div>
        <ShipmentPipeline
          stages={SHIPMENT_PIPELINE_STAGES}
          activeStage={activePipelineStage}
          labelForStage={(stage) => t(`pipeline.${stage}`)}
        />
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-grid__main">
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
              <EmptyPanel
                title={t('emptyRecent')}
                action={
                  <Link href="/shipments/new" className="portal-button portal-button--primary">
                    {t('createFirst')}
                  </Link>
                }
              />
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

          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">{t('recentQuotesTitle')}</h2>
            </div>
            {logistics?.recentOrders?.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('table.reference')}</th>
                      <th>{tShipments('table.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logistics.recentOrders.slice(0, 5).map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/logistics/orders/${order.id}`} className="portal-link">
                            {order.referenceNumber}
                          </Link>
                        </td>
                        <td>{order.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted-text">{t('emptyQuotes')}</p>
            )}
          </section>
        </div>

        <aside className="dashboard-grid__aside">
          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">{t('attentionTitle')}</h2>
            </div>
            {attentionItems.length === 0 ? (
              <p className="muted-text">{t('attention.empty')}</p>
            ) : (
              <ul className="attention-list">
                {attentionItems.map((item) => (
                  <li key={item.id} className="attention-list__item">
                    <span>{item.label}</span>
                    <Link href={item.href} className="portal-link">
                      {t('attention.review')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">{t('quickLinksTitle')}</h2>
            </div>
            <div className="dashboard-hero__actions">
              <Link href="/ocean/carriers" className="portal-button portal-button--ghost">
                {t('quickLinks.carriers')}
              </Link>
              <Link href="/ocean/schedules" className="portal-button portal-button--ghost">
                {t('quickLinks.schedules')}
              </Link>
              <Link href="/customs/requests" className="portal-button portal-button--ghost">
                {t('quickLinks.customs')}
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </PortalShell>
  );
}
