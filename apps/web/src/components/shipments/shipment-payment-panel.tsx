'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { FormError } from '../form-error';

import { createShipmentPaymentIntent } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { formatAmount } from '@/lib/shipment-utils';
import type { PaymentQuote } from '@/types/payment';
import type { Shipment } from '@/types/shipment';

type ShipmentPaymentPanelProps = {
  shipment: Shipment;
  quote: PaymentQuote;
  locale: string;
  onSuccess: (shipment: Shipment) => void;
  onCancel: () => void;
};

export function ShipmentPaymentPanel({
  shipment,
  quote,
  locale,
  onCancel,
}: ShipmentPaymentPanelProps) {
  const t = useTranslations('shipments.payment');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <section className="panel payment-panel">
      <h2 className="panel__title">{t('title')}</h2>

      <dl className="payment-summary">
        <div>
          <dt>{t('reference')}</dt>
          <dd>{quote.referenceNumber}</dd>
        </div>
        <div>
          <dt>{t('amount')}</dt>
          <dd>{formatAmount(quote.amount, quote.currency)}</dd>
        </div>
        <div>
          <dt>{t('currency')}</dt>
          <dd>{quote.currency}</dd>
        </div>
      </dl>

      <FormError message={error} />

      <p className="muted-text">{t('checkoutHint')}</p>

      <div className="form-actions">
        <button
          type="button"
          className="portal-button portal-button--ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="portal-button portal-button--primary"
          disabled={isSubmitting}
          onClick={async () => {
            setError(null);
            setIsSubmitting(true);

            try {
              const intent = await createShipmentPaymentIntent(shipment.id, locale);

              if (!intent.checkoutUrl) {
                setError(t('errors.checkoutUnavailable'));
                return;
              }

              window.location.href = intent.checkoutUrl;
            } catch (submitError) {
              setError(
                isApiClientError(submitError)
                  ? getLocalizedApiMessage(submitError, locale as 'en' | 'ar')
                  : t('errors.generic'),
              );
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          {isSubmitting ? t('processing') : t('payAndConfirm')}
        </button>
      </div>
    </section>
  );
}
