'use client';

import { ShipmentStatus, UserRole } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { PortalShell } from '../portal/portal-shell';
import { StatusBadge } from '../portal/status-badge';

import { ShipmentDocumentsPanel } from './shipment-documents-panel';
import { ShipmentLiveMap } from './shipment-live-map';
import { ShipmentPaymentPanel } from './shipment-payment-panel';
import { ShipmentRatingPanel } from './shipment-rating-panel';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link } from '@/i18n/navigation';
import {
  cancelShipment,
  completeShipment,
  downloadShipmentContractPdf,
  downloadShipmentInvoicePdf,
  getShipment,
  getShipmentPaymentQuote,
  getShipmentTimeline,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import {
  formatAmount,
  formatDate,
  formatRoute,
  getDeliveryStop,
  getPickupStop,
  isOneOfShipmentStatuses,
} from '@/lib/shipment-utils';
import type { PaymentQuote } from '@/types/payment';
import type { Shipment, ShipmentTimeline } from '@/types/shipment';

const CANCELLABLE_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.DRAFT,
  ShipmentStatus.PENDING_ASSIGNMENT,
  ShipmentStatus.ASSIGNED,
];

type ShipmentDetailsContentProps = {
  shipmentId: string;
};

export function ShipmentDetailsContent({ shipmentId }: ShipmentDetailsContentProps) {
  const t = useTranslations('shipments');
  const tPortal = useTranslations('portal');
  const locale = useLocale();
  const { user, isReady } = useRequireAuth();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [timeline, setTimeline] = useState<ShipmentTimeline | null>(null);
  const [paymentQuote, setPaymentQuote] = useState<PaymentQuote | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);

  const loadShipment = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [shipmentData, timelineData] = await Promise.all([
        getShipment(shipmentId),
        getShipmentTimeline(shipmentId),
      ]);
      setShipment(shipmentData);
      setTimeline(timelineData);

      if (
        shipmentData.status === ShipmentStatus.DRAFT &&
        user?.role === UserRole.CUSTOMER
      ) {
        const quote = await getShipmentPaymentQuote(shipmentId);
        setPaymentQuote(quote);
      } else {
        setPaymentQuote(null);
      }
    } catch (loadError) {
      setError(
        isApiClientError(loadError)
          ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
          : tPortal('errors.generic'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [shipmentId, locale, tPortal, user?.role]);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    void loadShipment();
  }, [isReady, user, loadShipment]);

  async function runCancel() {
    if (!shipment) {
      return;
    }

    setIsActionPending(true);
    setError(null);

    try {
      const updated = await cancelShipment(shipment.id);
      setShipment(updated);
      setShowPaymentForm(false);
      setPaymentQuote(null);
      const timelineData = await getShipmentTimeline(shipment.id);
      setTimeline(timelineData);
    } catch (actionError) {
      setError(
        isApiClientError(actionError)
          ? getLocalizedApiMessage(actionError, locale as 'en' | 'ar')
          : tPortal('errors.generic'),
      );
    } finally {
      setIsActionPending(false);
    }
  }

  async function runComplete() {
    if (!shipment) {
      return;
    }

    setIsActionPending(true);
    setError(null);

    try {
      const updated = await completeShipment(shipment.id);
      setShipment(updated);
      const timelineData = await getShipmentTimeline(shipment.id);
      setTimeline(timelineData);
    } catch (actionError) {
      setError(
        isApiClientError(actionError)
          ? getLocalizedApiMessage(actionError, locale as 'en' | 'ar')
          : tPortal('errors.generic'),
      );
    } finally {
      setIsActionPending(false);
    }
  }

  if (!isReady || !user) {
    return <LoadingState message={tPortal('loading')} />;
  }

  if (isLoading) {
    return (
      <PortalShell user={user} title={t('detailsTitle')} subtitle={t('detailsLoading')}>
        <p className="muted-text">{tPortal('loading')}</p>
      </PortalShell>
    );
  }

  if (!shipment) {
    return (
      <PortalShell user={user} title={t('detailsTitle')} subtitle={t('notFound')}>
        <FormError message={error} />
        <Link href="/shipments" className="portal-button portal-button--primary">
          {t('backToList')}
        </Link>
      </PortalShell>
    );
  }

  const pickup = getPickupStop(shipment);
  const delivery = getDeliveryStop(shipment);
  const canPay =
    user.role === UserRole.CUSTOMER &&
    shipment.status === ShipmentStatus.DRAFT &&
    paymentQuote !== null;
  const canEdit =
    user.role === UserRole.CUSTOMER && shipment.status === ShipmentStatus.DRAFT;
  const canCancel = isOneOfShipmentStatuses(shipment.status, CANCELLABLE_STATUSES);
  const canComplete =
    user.role === UserRole.CUSTOMER && shipment.status === ShipmentStatus.DELIVERED;
  const canRate =
    user.role === UserRole.CUSTOMER &&
    (shipment.status === ShipmentStatus.DELIVERED ||
      shipment.status === ShipmentStatus.COMPLETED);
  const showDocuments =
    shipment.isCrossBorder ||
    !isOneOfShipmentStatuses(shipment.status, [
      ShipmentStatus.DRAFT,
      ShipmentStatus.CANCELLED,
    ]);
  const showLiveMap = !isOneOfShipmentStatuses(shipment.status, [
    ShipmentStatus.DRAFT,
    ShipmentStatus.PENDING_ASSIGNMENT,
    ShipmentStatus.CANCELLED,
    ShipmentStatus.COMPLETED,
  ]);
  const pricingBase = shipment.pricing?.baseAmount ?? paymentQuote?.baseAmount ?? null;
  const pricingFee = shipment.pricing?.platformFee ?? paymentQuote?.platformFee ?? null;
  const pricingTotal =
    shipment.pricing?.totalAmount ?? paymentQuote?.amount ?? null;
  const pricingCurrency = shipment.pricing?.currency ?? paymentQuote?.currency ?? 'SAR';

  return (
    <PortalShell
      user={user}
      title={shipment.referenceNumber}
      subtitle={formatRoute(shipment)}
      action={
        <Link href="/shipments" className="portal-button portal-button--ghost">
          {t('backToList')}
        </Link>
      }
    >
      <FormError message={error} />

      <div className="details-header">
        <StatusBadge status={shipment.status} label={t(`status.${shipment.status}`)} />
        <div className="details-actions">
          {canEdit ? (
            <Link
              href={`/shipments/${shipment.id}/edit`}
              className="portal-button portal-button--ghost"
            >
              {t('actions.edit')}
            </Link>
          ) : null}
          {canPay && !showPaymentForm ? (
            <button
              type="button"
              className="portal-button portal-button--primary"
              disabled={isActionPending}
              onClick={() => setShowPaymentForm(true)}
            >
              {t('payment.payAndConfirmButton')}
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              className="portal-button portal-button--danger"
              disabled={isActionPending}
              onClick={() => void runCancel()}
            >
              {isActionPending ? t('actions.working') : t('actions.cancel')}
            </button>
          ) : null}
          {canComplete ? (
            <button
              type="button"
              className="portal-button portal-button--primary"
              disabled={isActionPending}
              onClick={() => void runComplete()}
            >
              {isActionPending ? t('actions.working') : t('actions.complete')}
            </button>
          ) : null}
          {shipment.status !== ShipmentStatus.DRAFT ? (
            <>
              <button
                type="button"
                className="portal-button portal-button--ghost"
                onClick={() => {
                  void downloadShipmentContractPdf(shipment.id)
                    .then((blob) => {
                      const url = URL.createObjectURL(blob);
                      const anchor = document.createElement('a');
                      anchor.href = url;
                      anchor.download = `contract-${shipment.referenceNumber}.pdf`;
                      anchor.click();
                      URL.revokeObjectURL(url);
                    })
                    .catch(() => setError(t('commerce.notAvailable')));
                }}
              >
                {t('commerce.downloadContract')}
              </button>
              <button
                type="button"
                className="portal-button portal-button--ghost"
                onClick={() => {
                  void downloadShipmentInvoicePdf(shipment.id)
                    .then((blob) => {
                      const url = URL.createObjectURL(blob);
                      const anchor = document.createElement('a');
                      anchor.href = url;
                      anchor.download = `invoice-${shipment.referenceNumber}.pdf`;
                      anchor.click();
                      URL.revokeObjectURL(url);
                    })
                    .catch(() => setError(t('commerce.notAvailable')));
                }}
              >
                {t('commerce.downloadInvoice')}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {canPay && showPaymentForm && paymentQuote ? (
        <ShipmentPaymentPanel
          shipment={shipment}
          quote={paymentQuote}
          locale={locale}
          onSuccess={async (updatedShipment) => {
            setShipment(updatedShipment);
            setShowPaymentForm(false);
            setPaymentQuote(null);
            const timelineData = await getShipmentTimeline(shipment.id);
            setTimeline(timelineData);
          }}
          onCancel={() => setShowPaymentForm(false)}
        />
      ) : null}

      <div className="details-grid">
        <section className="panel">
          <h2 className="panel__title">{t('sections.overview')}</h2>
          <dl className="details-list">
            <div>
              <dt>{t('fields.cargoType')}</dt>
              <dd>{t(`cargoType.${shipment.cargoType}`)}</dd>
            </div>
            <div>
              <dt>{t('fields.cargoDescription')}</dt>
              <dd>{shipment.cargoDescription ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('fields.packageCount')}</dt>
              <dd>{shipment.packageCount ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('fields.weightKg')}</dt>
              <dd>{shipment.weightKg ? `${shipment.weightKg} kg` : '—'}</dd>
            </div>
            <div>
              <dt>{t('fields.shippingMethod')}</dt>
              <dd>{t(`shippingMethod.${shipment.shippingMethod}`)}</dd>
            </div>
            <div>
              <dt>{t('fields.isCrossBorder')}</dt>
              <dd>{shipment.isCrossBorder ? t('yes') : t('no')}</dd>
            </div>
            <div>
              <dt>{t('fields.scheduledAt')}</dt>
              <dd>{formatDate(shipment.scheduledAt, locale)}</dd>
            </div>
            <div>
              <dt>{t('table.created')}</dt>
              <dd>{formatDate(shipment.createdAt, locale)}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2 className="panel__title">{t('sections.pricing')}</h2>
          {pricingTotal ? (
            <dl className="details-list">
              <div>
                <dt>{t('pricing.base')}</dt>
                <dd>{formatAmount(pricingBase, pricingCurrency)}</dd>
              </div>
              <div>
                <dt>{t('pricing.fee')}</dt>
                <dd>{formatAmount(pricingFee, pricingCurrency)}</dd>
              </div>
              <div>
                <dt>{t('pricing.total')}</dt>
                <dd>{formatAmount(pricingTotal, pricingCurrency)}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted-text">{t('pricing.pending')}</p>
          )}
        </section>

        <section className="panel">
          <h2 className="panel__title">{t('sections.pickup')}</h2>
          {pickup ? (
            <dl className="details-list">
              <div>
                <dt>{t('fields.address')}</dt>
                <dd>{pickup.address}</dd>
              </div>
              <div>
                <dt>{t('fields.city')}</dt>
                <dd>{pickup.city}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        <section className="panel">
          <h2 className="panel__title">{t('sections.delivery')}</h2>
          {delivery ? (
            <dl className="details-list">
              <div>
                <dt>{t('fields.address')}</dt>
                <dd>{delivery.address}</dd>
              </div>
              <div>
                <dt>{t('fields.city')}</dt>
                <dd>{delivery.city}</dd>
              </div>
            </dl>
          ) : null}
        </section>
      </div>

      {showLiveMap ? (
        <ShipmentLiveMap
          shipmentId={shipment.id}
          pickup={
            pickup
              ? { latitude: Number(pickup.latitude), longitude: Number(pickup.longitude) }
              : undefined
          }
          delivery={
            delivery
              ? { latitude: Number(delivery.latitude), longitude: Number(delivery.longitude) }
              : undefined
          }
        />
      ) : null}

      {showDocuments ? (
        <ShipmentDocumentsPanel
          shipmentId={shipment.id}
          canUpload={user.role === UserRole.CUSTOMER}
        />
      ) : null}

      <ShipmentRatingPanel shipmentId={shipment.id} canRate={canRate} />

      {timeline ? (
        <section className="panel">
          <h2 className="panel__title">{t('sections.timeline')}</h2>
          {timeline.history.length === 0 && timeline.events.length === 0 ? (
            <p className="muted-text">{t('timeline.empty')}</p>
          ) : (
            <ul className="timeline-list">
              {timeline.history.map((entry) => (
                <li key={entry.id}>
                  <span className="timeline-list__status">
                    {entry.fromStatus
                      ? `${t(`status.${entry.fromStatus}`)} → ${t(`status.${entry.toStatus}`)}`
                      : t(`status.${entry.toStatus}`)}
                  </span>
                  <span className="timeline-list__date">{formatDate(entry.createdAt, locale)}</span>
                </li>
              ))}
              {timeline.events.map((entry) => (
                <li key={entry.id}>
                  <span className="timeline-list__status">{entry.eventType}</span>
                  <span className="timeline-list__note">{entry.note ?? ''}</span>
                  <span className="timeline-list__date">{formatDate(entry.createdAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </PortalShell>
  );
}
