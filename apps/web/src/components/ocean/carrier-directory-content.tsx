'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { IntegrationStatusBadge } from '@/components/ui/premium';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { listOceanCarriers } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { CarrierDirectoryEntry } from '@/types/ocean';

export function CarrierDirectoryContent() {
  const t = useTranslations('oceanCarriers');
  const tPortal = useTranslations('portal');
  const locale = useLocale();
  const { user, isReady } = useRequireAuth();
  const [carriers, setCarriers] = useState<CarrierDirectoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    void listOceanCarriers()
      .then((data) => {
        if (!cancelled) setCarriers(data);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            isApiClientError(loadError)
              ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
              : tPortal('errors.generic'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isReady, tPortal]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <PortalShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <FormError message={error} />
      {isLoading ? (
        <p className="muted-text">{t('loading')}</p>
      ) : (
        <div className="carrier-grid">
          {carriers.map((carrier) => (
            <article key={carrier.carrierCode} className="carrier-card">
              <div className="carrier-card__header">
                <h2 className="carrier-card__title">{carrier.displayName}</h2>
                <IntegrationStatusBadge
                  status={carrier.integrationStatus}
                  label={t(`status.${carrier.integrationStatus}`)}
                />
              </div>
              <div className="carrier-card__meta">
                <div>{t('scac')}: {carrier.scac ?? '—'}</div>
                <div>{t('tracking')}: {carrier.supportsTracking ? t('yes') : t('no')}</div>
                <div>{t('schedules')}: {carrier.supportsSchedules ? t('yes') : t('no')}</div>
                <div>{t('booking')}: {carrier.supportsBooking ? t('yes') : t('no')}</div>
                <div>{t('mode')}: {carrier.integrationMode === 'live_api' && carrier.integrationStatus === 'connected' ? t('modeLabel.live_api') : t(`modeLabel.${carrier.integrationMode}`)}</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
