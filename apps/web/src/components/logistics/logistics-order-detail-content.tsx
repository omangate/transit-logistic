'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import { LogisticsStatusTimeline } from '@/components/logistics/logistics-status-timeline';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link } from '@/i18n/navigation';
import { getLogisticsOrder, getLogisticsOrderTimeline } from '@/lib/api';
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

  useEffect(() => {
    if (!isReady || !user) return;

    let cancelled = false;
    setIsLoading(true);

    Promise.all([getLogisticsOrder(id), getLogisticsOrderTimeline(id)])
      .then(([orderData, timelineData]) => {
        if (!cancelled) {
          setOrder(orderData);
          setTimeline(timelineData);
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
          </section>

          <section className="logistics-panel">
            <h2>{t('order.timeline')}</h2>
            <LogisticsStatusTimeline entries={timeline.length ? timeline : order.statusHistory ?? []} />
          </section>

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
        </div>
      ) : null}
    </PortalShell>
  );
}
