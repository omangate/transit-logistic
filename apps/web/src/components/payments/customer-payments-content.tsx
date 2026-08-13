'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { useRequireCustomerAuth } from '@/hooks/use-require-customer-auth';
import { Link } from '@/i18n/navigation';
import { listPaymentHistory } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatDate } from '@/lib/shipment-utils';
import type { PaymentIntent } from '@/types/payment';

const PAYMENT_STATUS_CLASS: Record<PaymentIntent['status'], string> = {
  requires_payment_method: 'status-badge--pending',
  requires_confirmation: 'status-badge--pending',
  processing: 'status-badge--transit',
  succeeded: 'status-badge--completed',
  failed: 'status-badge--cancelled',
  cancelled: 'status-badge--cancelled',
  refunded: 'status-badge--draft',
};

function PaymentStatusBadge({ status }: { status: PaymentIntent['status'] }) {
  return <span className={`status-badge ${PAYMENT_STATUS_CLASS[status]}`}>{status.replace(/_/g, ' ')}</span>;
}

export function CustomerPaymentsContent() {
  const t = useTranslations('paymentsPage');
  const tPortal = useTranslations('portal');
  const locale = useLocale();
  const { user, isReady } = useRequireCustomerAuth();
  const [payments, setPayments] = useState<PaymentIntent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;
    void listPaymentHistory(1, 50)
      .then((res) => setPayments(res.data))
      .catch((err) => setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale as 'en' | 'ar') : tPortal('errors.generic')))
      .finally(() => setIsLoading(false));
  }, [isReady, user, locale, tPortal]);

  const columns: DataTableColumn<PaymentIntent>[] = [
    { id: 'reference', header: t('table.reference'), accessor: (p) => p.referenceNumber },
    { id: 'amount', header: t('table.amount'), accessor: (p) => `${p.amount} ${p.currency}` },
    { id: 'status', header: t('table.status'), accessor: (p) => p.status, render: (p) => <PaymentStatusBadge status={p.status} /> },
    { id: 'created', header: t('table.date'), accessor: (p) => formatDate(p.createdAt, locale) },
    { id: 'shipment', header: t('table.shipment'), accessor: (p) => p.shipmentId, render: (p) => <Link href={`/shipments/${p.shipmentId}`} className="portal-link">{t('viewShipment')}</Link> },
  ];

  if (!isReady || !user) return <LoadingState message={t('loading')} />;

  return (
    <PortalShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <FormError message={error} />
      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : (
        <section className="panel">
          <DataTable rows={payments} columns={columns} searchPlaceholder={t('search')} emptyMessage={t('empty')} exportFileName="payments.csv" mobileCardTitle={(p) => p.referenceNumber} mobileCardSubtitle={(p) => `${p.amount} ${p.currency}`} />
        </section>
      )}
    </PortalShell>
  );
}
