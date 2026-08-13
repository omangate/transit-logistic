'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import { ShipmentControlTower } from '@/components/logistics/shipment-control-tower';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { useRequireCustomerAuth } from '@/hooks/use-require-customer-auth';
import { getLogisticsOrder, getLogisticsOrderTimeline } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { LogisticsOrder, StatusHistoryEntry } from '@/types/logistics';

export function LogisticsOrderDetailContent({ id }: { id: string }) {
  const t = useTranslations('logistics');
  const tTower = useTranslations('controlTower');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireCustomerAuth();
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
    <PortalShell user={user} title={tTower('title')} subtitle={order?.referenceNumber}>
      {error ? <FormError message={error} /> : null}
      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : order ? (
        <ShipmentControlTower order={order} timeline={timeline} isAdmin={isAdmin} onReload={reload} />
      ) : null}
    </PortalShell>
  );
}
