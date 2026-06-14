'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { AdminShell } from './admin-shell';

import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { listAdminCustomers } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatDate } from '@/lib/shipment-utils';
import type { AdminCustomer } from '@/types/admin';

export function AdminCustomersContent() {
  const t = useTranslations('admin.customers');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listAdminCustomers();
        if (!cancelled) setCustomers(data);
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
      ) : customers.length === 0 ? (
        <p className="muted-text">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('email')}</th>
                <th>{t('phone')}</th>
                <th>{t('shipments')}</th>
                <th>{t('status')}</th>
                <th>{t('joined')}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.fullName ?? '—'}</td>
                  <td>{customer.email}</td>
                  <td>{customer.phone ?? '—'}</td>
                  <td>{customer.shipmentCount}</td>
                  <td>{customer.isActive ? t('active') : t('inactive')}</td>
                  <td>{formatDate(customer.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
