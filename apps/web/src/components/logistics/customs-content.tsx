'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import { DocumentChecklistPanel } from '@/components/logistics/document-checklist-panel';
import { LogisticsConversationPanel } from '@/components/logistics/logistics-conversation-panel';
import { LogisticsStatusTimeline } from '@/components/logistics/logistics-status-timeline';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { useRequireCustomerAuth } from '@/hooks/use-require-customer-auth';
import { Link } from '@/i18n/navigation';
import { getCustomsRequest, listCustomsRequests, respondLogisticsQuote } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { CustomsClearanceRequest } from '@/types/logistics';

export function CustomsRequestsContent() {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireCustomerAuth();
  const [items, setItems] = useState<CustomsClearanceRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;

    let cancelled = false;
    setIsLoading(true);

    void listCustomsRequests()
      .then((result) => {
        if (!cancelled) {
          setItems(result);
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
      title={t('customs.myRequests')}
      subtitle={t('customs.myRequestsSubtitle')}
      action={
        <Link href="/customs/new" className="rental-btn rental-btn--primary">{t('customs.newRequest')}</Link>
      }
    >
      {error ? <FormError message={error} /> : null}
      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : (
        <div className="logistics-table">
          {items.map((item) => (
            <Link key={item.id} href={`/customs/requests/${item.id}`} className="logistics-table__row">
              <strong>{item.referenceNumber}</strong>
              <span>{t(`customs.transactionTypes.${item.transactionType}` as never)}</span>
              <span className="logistics-badge">{t(`customs.status.${item.status}` as never)}</span>
            </Link>
          ))}
          {!items.length && !error ? <p>{t('customs.empty')}</p> : null}
        </div>
      )}
    </PortalShell>
  );
}

export function CustomsRequestDetailContent({ id }: { id: string }) {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireCustomerAuth();
  const [request, setRequest] = useState<CustomsClearanceRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;

    let cancelled = false;
    setIsLoading(true);

    void getCustomsRequest(id)
      .then((result) => {
        if (!cancelled) {
          setRequest(result);
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

  const latestQuote = request?.quotes?.[0];

  return (
    <PortalShell
      user={user}
      title={request ? t(`customs.transactionTypes.${request.transactionType}` as never) : t('customs.title')}
      subtitle={request?.referenceNumber}
    >
      {error ? <FormError message={error} /> : null}
      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : request ? (
        <div className="logistics-detail-grid">
          <section className="logistics-panel">
            <span className="logistics-badge logistics-badge--lg">{t(`customs.status.${request.status}` as never)}</span>
            <h2>{t('customs.shipmentInfo')}</h2>
            <dl className="logistics-dl">
              <div><dt>{t('customs.fields.blNumber')}</dt><dd>{request.billOfLadingNumber ?? '—'}</dd></div>
              <div><dt>{t('customs.fields.portOfDischarge')}</dt><dd>{request.portOfDischarge ?? '—'}</dd></div>
              <div><dt>{t('customs.fields.finalDestination')}</dt><dd>{request.finalDestination ?? '—'}</dd></div>
            </dl>
            {request.logisticsOrder ? (
              <Link href={`/logistics/orders/${request.logisticsOrder.id}`}>{request.logisticsOrder.referenceNumber}</Link>
            ) : null}
          </section>

          <section className="logistics-panel">
            <h2>{t('customs.timeline')}</h2>
            <LogisticsStatusTimeline entries={request.statusHistory ?? []} />
          </section>

          <section className="logistics-panel">
            <DocumentChecklistPanel items={request.checklistItems ?? []} />
          </section>

          {latestQuote ? (
            <section className="logistics-panel">
              <h2>{t('quotes.latest')}</h2>
              <p>{latestQuote.totalAmount} {latestQuote.currency}</p>
              {latestQuote.status === 'sent' ? (
                <button type="button" className="rental-btn rental-btn--primary" onClick={() => void respondLogisticsQuote(latestQuote.id, 'accept').then(() => getCustomsRequest(id).then(setRequest))}>
                  {t('quotes.accept')}
                </button>
              ) : null}
            </section>
          ) : null}

          <LogisticsConversationPanel context={{ customsRequestId: id, logisticsOrderId: request.logisticsOrderId ?? undefined }} />
        </div>
      ) : null}
    </PortalShell>
  );
}
