'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { PortalShell } from '../portal/portal-shell';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link } from '@/i18n/navigation';
import { verifyShipmentPayment } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';

type PaymentResultContentProps = {
  shipmentId: string;
  variant: 'success' | 'cancel';
};

export function PaymentResultContent({ shipmentId, variant }: PaymentResultContentProps) {
  const t = useTranslations('payment');
  const tPortal = useTranslations('portal');
  const locale = useLocale();
  const { user, isReady } = useRequireAuth();
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(variant === 'success');
  const [verifySucceeded, setVerifySucceeded] = useState(variant !== 'success');

  useEffect(() => {
    if (!isReady || !user || variant !== 'success') {
      return;
    }

    let cancelled = false;

    async function verify() {
      setIsVerifying(true);
      setError(null);
      setVerifySucceeded(false);

      try {
        await verifyShipmentPayment(shipmentId);
        if (!cancelled) {
          setVerifySucceeded(true);
        }
      } catch (verifyError) {
        if (!cancelled) {
          setVerifySucceeded(false);
          setError(
            isApiClientError(verifyError)
              ? getLocalizedApiMessage(verifyError, locale as 'en' | 'ar')
              : t('errors.verifyFailed'),
          );
        }
      } finally {
        if (!cancelled) {
          setIsVerifying(false);
        }
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [isReady, user, shipmentId, variant, locale, t]);

  if (!isReady || !user) {
    return <LoadingState message={tPortal('loading')} />;
  }

  const isSuccess = variant === 'success';

  return (
    <PortalShell
      user={user}
      title={isSuccess ? t('success.title') : t('cancel.title')}
      subtitle={isSuccess ? t('success.subtitle') : t('cancel.subtitle')}
    >
      <section className={`panel payment-result${isSuccess ? ' payment-result--success' : ' payment-result--cancel'}`}>
        {isVerifying ? (
          <p className="muted-text">{t('success.verifying')}</p>
        ) : verifySucceeded ? (
          <p>{isSuccess ? t('success.message') : t('cancel.message')}</p>
        ) : isSuccess ? null : (
          <p>{t('cancel.message')}</p>
        )}

        <FormError message={error} />

        <div className="payment-result__actions">
          <Link href={`/shipments/${shipmentId}`} className="portal-button portal-button--primary">
            {t('viewShipment')}
          </Link>
          <Link href="/shipments" className="portal-button portal-button--ghost">
            {t('backToList')}
          </Link>
        </div>
      </section>
    </PortalShell>
  );
}
