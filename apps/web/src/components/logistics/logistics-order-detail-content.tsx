'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import { LogisticsConversationPanel } from '@/components/logistics/logistics-conversation-panel';
import { LogisticsOrderManagement } from '@/components/logistics/logistics-order-management';
import { LogisticsStatusTimeline } from '@/components/logistics/logistics-status-timeline';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link } from '@/i18n/navigation';
import { getLogisticsOrder, getLogisticsOrderTimeline, respondLogisticsQuote } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { LogisticsOrder, StatusHistoryEntry } from '@/types/logistics';

export function LogisticsOrderDetailContent({ id }: { id: string }) {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireAuth();
  const [order, setOrder] = useState<LogisticsOrder | null>(null);
  const [timeline, setTimeline] = useState<StatusHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = user?.role === 'admin';

  const reload = () => {
    if (!user) return;
    Promise.all([getLogisticsOrder(id), getLogisticsOrderTimeline(id)])
      .then(([orderData, timelineData]) => {
        setOrder(orderData);
        setTimeline(timelineData);
        setError(null);
      })
      .catch((err) => setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic')))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!isReady || !user) return;
    reload();
  }, [id, isReady, locale, t, user]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <PortalShell user={user} title={t('order.title')} subtitle={order?.referenceNumber}>
      {error ? <FormError message={error} /> : null}
      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : order ? (
        <div className="logistics-detail-grid">
          <section className="logistics-panel">
            <h2>{order.title ?? order.referenceNumber}</h2>
            <span className="logistics-badge logistics-badge--lg">{order.status.replace(/_/g, ' ')}</span>
            <div className="logistics-hero__actions">
              <Link href={`/freight/request?orderId=${order.id}`} className="rental-btn rental-btn--ghost">{t('order.addFreight')}</Link>
              <Link href={`/customs/new?orderId=${order.id}`} className="rental-btn rental-btn--ghost">{t('order.addCustoms')}</Link>
              <Link href="/marketplace" className="rental-btn rental-btn--ghost">{t('order.addTruck')}</Link>
            </div>
          </section>

          <section className="logistics-panel">
            <h2>{t('order.timeline')}</h2>
            <LogisticsStatusTimeline entries={timeline.length ? timeline : order.statusHistory ?? []} />
          </section>

          {(order.quotes ?? []).length ? (
            <section className="logistics-panel">
              <h2>{t('quotes.latest')}</h2>
              {(order.quotes ?? []).map((quote) => (
                <div key={quote.id} className="logistics-table__row logistics-table__row--admin">
                  <strong>{quote.referenceNumber}</strong>
                  <span>{Number(quote.totalAmount).toFixed(3)} {quote.currency}</span>
                  <span className="logistics-badge">{quote.status.replace(/_/g, ' ')}</span>
                  {quote.status === 'sent' && user.role === 'customer' ? (
                    <button type="button" className="rental-btn rental-btn--primary" onClick={() => void respondLogisticsQuote(quote.id, 'accept').then(reload)}>
                      {t('quotes.accept')}
                    </button>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}

          <section className="logistics-panel">
            <h2>{t('order.services')}</h2>
            <h3>{t('order.customsLink')}</h3>
            <div className="logistics-table">
              {(order.customsRequests ?? []).map((item) => (
                <Link key={item.id} href={`/customs/requests/${item.id}`} className="logistics-table__row">
                  <strong>{item.referenceNumber}</strong>
                  <span className="logistics-badge">{item.status.replace(/_/g, ' ')}</span>
                </Link>
              ))}
            </div>
            <h3>{t('order.freightLink')}</h3>
            <div className="logistics-table">
              {(order.freightRequests ?? []).map((item) => (
                <Link key={item.id} href={`/freight/shipments/${item.id}`} className="logistics-table__row">
                  <strong>{item.referenceNumber}</strong>
                  <span className="logistics-badge">{item.status.replace(/_/g, ' ')}</span>
                </Link>
              ))}
            </div>
          </section>

          <LogisticsOrderManagement
            orderId={id}
            isAdmin={isAdmin}
            initialContainers={order.containers}
            initialVehicles={order.vehicleShipments}
            initialCharges={order.charges}
          />
          <LogisticsConversationPanel context={{ logisticsOrderId: id }} />
        </div>
      ) : null}
    </PortalShell>
  );
}
