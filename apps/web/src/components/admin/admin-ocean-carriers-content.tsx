'use client';

import { OceanCarrierIntegrationMode } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/admin/admin-shell';
import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { IntegrationStatusBadge } from '@/components/ui/premium';
import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import {
  listAdminOceanCarriers,
  testAdminOceanCarrier,
  updateAdminOceanCarrier,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { AdminCarrierConnection } from '@/types/ocean';

export function AdminOceanCarriersContent() {
  const t = useTranslations('adminOceanCarriers');
  const tPortal = useTranslations('portal');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [carriers, setCarriers] = useState<AdminCarrierConnection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  async function reload() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listAdminOceanCarriers();
      setCarriers(data);
    } catch (loadError) {
      setError(
        isApiClientError(loadError)
          ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
          : tPortal('errors.generic'),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isReady) return;
    void reload();
  }, [isReady]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <AdminShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <FormError message={error} />
      {message ? <p className="form-success">{message}</p> : null}

      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : (
        <div className="carrier-grid">
          {carriers.map((carrier) => (
            <article key={carrier.id} className="carrier-card">
              <div className="carrier-card__header">
                <h2 className="carrier-card__title">{carrier.displayName}</h2>
                <IntegrationStatusBadge
                  status={carrier.status}
                  label={t(`status.${carrier.status}`)}
                />
              </div>
              <div className="carrier-card__meta">
                <div>{t('scac')}: {carrier.scac ?? '—'}</div>
                <div>{t('mode')}: {t(`modeLabel.${carrier.integrationMode}`)}</div>
                <div>
                  {t('credentials')}:{' '}
                  {carrier.credentialConfigured ? t('configured') : t('notConfigured')}
                </div>
                <div>
                  {t('lastSync')}:{' '}
                  {carrier.lastSyncAt ? new Date(carrier.lastSyncAt).toLocaleString(locale) : '—'}
                </div>
                {carrier.lastError ? <div>{t('lastError')}: {carrier.lastError}</div> : null}
              </div>
              <div className="dashboard-hero__actions" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="portal-button portal-button--ghost"
                  disabled={busyCode === carrier.carrierCode}
                  onClick={() => {
                    setBusyCode(carrier.carrierCode);
                    void updateAdminOceanCarrier(carrier.carrierCode, {
                      enabled: !carrier.enabled,
                    })
                      .then(() => reload())
                      .finally(() => setBusyCode(null));
                  }}
                >
                  {carrier.enabled ? t('disable') : t('enable')}
                </button>
                <button
                  type="button"
                  className="portal-button portal-button--primary"
                  disabled={busyCode === carrier.carrierCode}
                  onClick={() => {
                    setBusyCode(carrier.carrierCode);
                    void testAdminOceanCarrier(carrier.carrierCode)
                      .then((result) => {
                        setMessage(result.message);
                        return reload();
                      })
                      .finally(() => setBusyCode(null));
                  }}
                >
                  {t('testConnection')}
                </button>
                <button
                  type="button"
                  className="portal-button portal-button--ghost"
                  disabled={busyCode === carrier.carrierCode}
                  onClick={() => {
                    setBusyCode(carrier.carrierCode);
                    void updateAdminOceanCarrier(carrier.carrierCode, {
                      integrationMode: OceanCarrierIntegrationMode.MANUAL_OPS,
                    })
                      .then(() => reload())
                      .finally(() => setBusyCode(null));
                  }}
                >
                  {t('setManual')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
