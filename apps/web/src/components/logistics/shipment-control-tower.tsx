'use client';

import { OceanTrackingSearchType } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { DocumentChecklistPanel } from '@/components/logistics/document-checklist-panel';
import { LogisticsConversationPanel } from '@/components/logistics/logistics-conversation-panel';
import { LogisticsOrderManagement } from '@/components/logistics/logistics-order-management';
import { LogisticsStatusTimeline } from '@/components/logistics/logistics-status-timeline';
import { OceanTrackingResult } from '@/components/ocean/ocean-tracking-result';
import { DataSourceBadge } from '@/components/ui/premium';
import { Link } from '@/i18n/navigation';
import { listMissingDocuments, respondLogisticsQuote, trackOceanShipment } from '@/lib/api';
import { formatDate } from '@/lib/shipment-utils';
import type {
  DocumentChecklistItem,
  LogisticsOrder,
  StatusHistoryEntry,
} from '@/types/logistics';
import type { NormalizedOceanTracking } from '@/types/ocean';

const TABS = [
  'overview',
  'tracking',
  'containers',
  'documents',
  'customs',
  'transport',
  'charges',
  'quotes',
  'messages',
  'activity',
] as const;

type TabId = (typeof TABS)[number];

type Props = {
  order: LogisticsOrder;
  timeline: StatusHistoryEntry[];
  isAdmin: boolean;
  onReload: () => void;
};

export function ShipmentControlTower({ order, timeline, isAdmin, onReload }: Props) {
  const t = useTranslations('controlTower');
  const locale = useLocale();
  const [tab, setTab] = useState<TabId>('overview');
  const [tracking, setTracking] = useState<NormalizedOceanTracking | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<DocumentChecklistItem[]>([]);

  const primaryFreight = order.freightRequests?.[0];
  const primaryCustoms = order.customsRequests?.[0];
  const primaryContainer = order.containers?.[0];

  const attentionItems = useMemo(() => {
    const items: string[] = [];
    const missingDocs = checklist.filter((item) => item.status === 'missing' || item.status === 'required');
    if (missingDocs.length) items.push(t('alerts.missingDocs', { count: missingDocs.length }));
    const pendingQuotes = (order.quotes ?? []).filter((q) => q.status === 'sent');
    if (pendingQuotes.length) items.push(t('alerts.pendingQuotes', { count: pendingQuotes.length }));
    return items;
  }, [checklist, order.quotes, t]);

  const loadTracking = () => {
    const ref =
      primaryContainer?.containerNumber ??
      primaryCustoms?.referenceNumber ??
      order.referenceNumber;
    if (!ref) return;
    void trackOceanShipment({ searchType: OceanTrackingSearchType.REFERENCE, searchValue: ref })
      .then(setTracking)
      .catch(() => setTrackingError(t('trackingUnavailable')));
  };

  const loadChecklist = () => {
    const customsId = primaryCustoms?.id;
    const freightId = primaryFreight?.id;
    if (!customsId && !freightId) return;
    void listMissingDocuments({ customsRequestId: customsId, freightRequestId: freightId })
      .then((items) => setChecklist(items as DocumentChecklistItem[]))
      .catch(() => setChecklist([]));
  };

  useEffect(() => {
    loadChecklist();
  }, [order.id, primaryCustoms?.id, primaryFreight?.id]);

  useEffect(() => {
    if (tab === 'tracking') loadTracking();
  }, [tab, order.id]);

  return (
    <div className="control-tower">
      <header className="control-tower__header">
        <div>
          <h2>{order.title ?? order.referenceNumber}</h2>
          <p className="muted-text">{order.referenceNumber}</p>
        </div>
        <span className="logistics-badge logistics-badge--lg">{order.status.replace(/_/g, ' ')}</span>
        <div className="dashboard-hero__actions">
          <Link href={`/freight/request?orderId=${order.id}`} className="portal-button portal-button--secondary">
            {t('actions.requestQuote')}
          </Link>
          <Link href={`/track/${encodeURIComponent(order.referenceNumber)}`} className="portal-button portal-button--ghost">
            {t('actions.track')}
          </Link>
        </div>
      </header>

      {attentionItems.length > 0 ? (
        <ul className="attention-list">
          {attentionItems.map((item) => (
            <li key={item} className="attention-list__item">
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="control-tower__summary">
        <div><span>{t('summary.carrier')}</span><strong>{primaryContainer?.shippingLine ?? tracking?.carrierName ?? '—'}</strong></div>
        <div><span>{t('summary.vessel')}</span><strong>{tracking?.vesselName ?? '—'}</strong></div>
        <div><span>{t('summary.pol')}</span><strong>{tracking?.pol?.name ?? tracking?.pol?.unlocode ?? '—'}</strong></div>
        <div><span>{t('summary.pod')}</span><strong>{tracking?.pod?.name ?? tracking?.pod?.unlocode ?? '—'}</strong></div>
        <div><span>{t('summary.eta')}</span><strong>{tracking?.eta ? formatDate(tracking.eta, locale) : '—'}</strong></div>
        <div><span>{t('summary.container')}</span><strong>{primaryContainer?.containerNumber ?? '—'}</strong></div>
      </div>

      <nav className="control-tower__tabs" aria-label={t('tabsLabel')}>
        {TABS.map((tabId) => (
          <button
            key={tabId}
            type="button"
            className={`control-tower__tab${tab === tabId ? ' control-tower__tab--active' : ''}`}
            onClick={() => setTab(tabId)}
          >
            {t(`tabs.${tabId}`)}
          </button>
        ))}
      </nav>

      <div className="control-tower__panel">
        {tab === 'overview' ? (
          <div className="control-tower__grid">
            <section>
              <h3>{t('overview.timeline')}</h3>
              <LogisticsStatusTimeline entries={timeline.length ? timeline : order.statusHistory ?? []} />
            </section>
            <section>
              <h3>{t('overview.services')}</h3>
              {(order.freightRequests ?? []).map((f) => (
                <Link key={f.id} href={`/freight/shipments/${f.id}`} className="portal-link">{f.referenceNumber}</Link>
              ))}
              {(order.customsRequests ?? []).map((c) => (
                <Link key={c.id} href={`/customs/requests/${c.id}`} className="portal-link">{c.referenceNumber}</Link>
              ))}
            </section>
          </div>
        ) : null}

        {tab === 'tracking' ? (
          tracking ? (
            <OceanTrackingResult tracking={tracking} />
          ) : (
            <p className="muted-text">{trackingError ?? t('trackingLoading')}</p>
          )
        ) : null}

        {tab === 'containers' || tab === 'charges' ? (
          <LogisticsOrderManagement
            orderId={order.id}
            isAdmin={isAdmin}
            initialContainers={order.containers}
            initialVehicles={order.vehicleShipments}
            initialCharges={order.charges}
          />
        ) : null}

        {tab === 'documents' ? (
          <div>
            <DocumentChecklistPanel items={checklist} isAdmin={isAdmin} onUpdated={loadChecklist} />
            {(order.documents ?? []).length ? (
              <ul className="attention-list">
                {order.documents!.map((doc) => (
                  <li key={doc.id} className="attention-list__item">
                    <span>{doc.category}</span>
                    <DataSourceBadge quality="manual" label={doc.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-text">{t('noDocuments')}</p>
            )}
          </div>
        ) : null}

        {tab === 'customs' ? (
          <div className="logistics-table">
            {(order.customsRequests ?? []).map((item) => (
              <Link key={item.id} href={`/customs/requests/${item.id}`} className="logistics-table__row">
                <strong>{item.referenceNumber}</strong>
                <span className="logistics-badge">{item.status.replace(/_/g, ' ')}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {tab === 'transport' ? (
          <div>
            <p>{t('transportHint')}</p>
            <Link href="/marketplace" className="portal-link">{t('bookTruck')}</Link>
          </div>
        ) : null}

        {tab === 'quotes' ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('quotes.reference')}</th>
                  <th>{t('quotes.total')}</th>
                  <th>{t('quotes.status')}</th>
                  <th>{t('quotes.validUntil')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(order.quotes ?? []).map((quote) => (
                  <tr key={quote.id}>
                    <td>{quote.referenceNumber}</td>
                    <td>{Number(quote.totalAmount).toFixed(3)} {quote.currency}</td>
                    <td>{quote.status}</td>
                    <td>—</td>
                    <td>
                      {quote.status === 'sent' && !isAdmin ? (
                        <button type="button" className="portal-button portal-button--primary" onClick={() => void respondLogisticsQuote(quote.id, 'accept').then(onReload)}>
                          {t('quotes.accept')}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'messages' ? <LogisticsConversationPanel context={{ logisticsOrderId: order.id }} /> : null}

        {tab === 'activity' ? (
          <LogisticsStatusTimeline entries={timeline.length ? timeline : order.statusHistory ?? []} />
        ) : null}
      </div>
    </div>
  );
}
