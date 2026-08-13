'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { IntegrationStatusBadge } from '@/components/ui/premium';
import { useRequireCustomerAuth } from '@/hooks/use-require-customer-auth';
import { Link } from '@/i18n/navigation';
import { listLogisticsOrders, listMissingDocuments } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { DocumentChecklistItem, LogisticsOrder } from '@/types/logistics';

type DocumentRow = {
  id: string;
  reference: string;
  category: string;
  status: string;
  orderId: string;
  source: 'uploaded' | 'checklist';
};

const CATEGORIES = [
  'bill_of_lading',
  'commercial_invoice',
  'packing_list',
  'certificate_of_origin',
  'customs_declaration',
  'delivery_order',
  'arrival_notice',
  'insurance',
  'vehicle_documents',
  'other',
] as const;

export function DocumentCenterContent() {
  const t = useTranslations('documentCenter');
  const tLogistics = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireCustomerAuth();
  const [orders, setOrders] = useState<LogisticsOrder[]>([]);
  const [checklist, setChecklist] = useState<DocumentChecklistItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;
    void listLogisticsOrders()
      .then(async (orderList) => {
        setOrders(orderList);
        const missing = await Promise.all(
          orderList.flatMap((order) =>
            (order.customsRequests ?? []).map((c) =>
              listMissingDocuments({ customsRequestId: c.id }).catch(() => []),
            ),
          ),
        );
        setChecklist(missing.flat());
      })
      .catch((err) => setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('error')))
      .finally(() => setIsLoading(false));
  }, [isReady, user, locale, t]);

  const rows = useMemo(() => {
    const result: DocumentRow[] = [];
    for (const order of orders) {
      for (const doc of order.documents ?? []) {
        result.push({
          id: doc.id,
          reference: order.referenceNumber,
          category: doc.category,
          status: doc.status,
          orderId: order.id,
          source: 'uploaded',
        });
      }
    }
    for (const item of checklist) {
      result.push({
        id: item.id,
        reference: '—',
        category: item.documentCategory,
        status: item.status,
        orderId: '',
        source: 'checklist',
      });
    }
    return result;
  }, [orders, checklist]);

  const columns: DataTableColumn<DocumentRow>[] = [
    { id: 'reference', header: t('table.reference'), accessor: (r) => r.reference, render: (r) => r.orderId ? <Link href={`/logistics/orders/${r.orderId}`} className="portal-link">{r.reference}</Link> : r.reference },
    { id: 'category', header: t('table.category'), accessor: (r) => tLogistics(`documents.categories.${r.category}` as never) },
    { id: 'status', header: t('table.status'), accessor: (r) => r.status, render: (r) => <IntegrationStatusBadge status={r.status} label={tLogistics(`documents.status.${r.status}` as never)} /> },
    { id: 'source', header: t('table.source'), accessor: (r) => r.source },
  ];

  if (!isReady || !user) return <LoadingState message={t('loading')} />;

  return (
    <PortalShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <FormError message={error} />
      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : (
        <>
          <section className="panel">
            <h2 className="panel__title">{t('categoriesTitle')}</h2>
            <div className="dashboard-hero__actions">
              {CATEGORIES.map((cat) => (
                <span key={cat} className="portal-button portal-button--ghost">{tLogistics(`documents.categories.${cat}` as never)}</span>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2 className="panel__title">{t('allDocuments')}</h2>
            <DataTable rows={rows} columns={columns} searchPlaceholder={t('search')} emptyMessage={t('empty')} exportFileName="documents.csv" mobileCardTitle={(r) => tLogistics(`documents.categories.${r.category}` as never)} mobileCardSubtitle={(r) => r.reference} />
          </section>
        </>
      )}
    </PortalShell>
  );
}
