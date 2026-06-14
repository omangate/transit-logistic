'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { AdminShell } from './admin-shell';

import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { listPaymentHistory } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatAmount, formatDate } from '@/lib/shipment-utils';
import type { PaymentIntent } from '@/types/payment';

export function AdminPaymentsContent() {
  const t = useTranslations('admin.payments');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [payments, setPayments] = useState<PaymentIntent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listPaymentHistory();
        if (!cancelled) setPayments(data.data);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            isApiClientError(loadError)
              ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
              : t('errors.generic'),
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [isReady, user, locale, t]);

  if (!isReady || !user) return <LoadingState message={t('loading')} />;

  return (
    <AdminShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <FormError message={error} />
      {isLoading ? (
        <p className="muted-text">{t('loading')}</p>
      ) : payments.length === 0 ? (
        <p className="muted-text">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('reference')}</th>
                <th>{t('amount')}</th>
                <th>{t('provider')}</th>
                <th>{t('status')}</th>
                <th>{t('date')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.referenceNumber}</td>
                  <td>{formatAmount(payment.amount, payment.currency)}</td>
                  <td>{payment.provider}</td>
                  <td>{t(`statuses.${payment.status}`)}</td>
                  <td>{formatDate(payment.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
