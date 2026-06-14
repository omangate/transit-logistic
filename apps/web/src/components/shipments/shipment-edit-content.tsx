'use client';

import { ShipmentStatus, UserRole } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { PortalShell } from '../portal/portal-shell';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link, useRouter } from '@/i18n/navigation';
import { getShipment, updateShipment } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { getDeliveryStop, getPickupStop } from '@/lib/shipment-utils';
import type { CreateShipmentStopInput, Shipment, UpdateShipmentRequest } from '@/types/shipment';

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '0.375rem',
};

const inputStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  padding: '0.625rem 0.75rem',
  font: 'inherit',
};

type ShipmentEditContentProps = {
  shipmentId: string;
};

export function ShipmentEditContent({ shipmentId }: ShipmentEditContentProps) {
  const t = useTranslations('shipments');
  const tPortal = useTranslations('portal');
  const locale = useLocale();
  const router = useRouter();
  const { user, isReady } = useRequireAuth();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadShipment = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getShipment(shipmentId);
      setShipment(data);
    } catch (loadError) {
      setError(
        isApiClientError(loadError)
          ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
          : tPortal('errors.generic'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [shipmentId, locale, tPortal]);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }
    void loadShipment();
  }, [isReady, user, loadShipment]);

  if (!isReady || !user) {
    return <LoadingState message={tPortal('loading')} />;
  }

  if (isLoading) {
    return (
      <PortalShell user={user} title={t('editTitle')} subtitle={t('editLoading')}>
        <p className="muted-text">{tPortal('loading')}</p>
      </PortalShell>
    );
  }

  if (!shipment) {
    return (
      <PortalShell user={user} title={t('editTitle')} subtitle={t('notFound')}>
        <FormError message={error} />
        <Link href="/shipments" className="portal-button portal-button--primary">
          {t('backToList')}
        </Link>
      </PortalShell>
    );
  }

  if (user.role !== UserRole.CUSTOMER || shipment.status !== ShipmentStatus.DRAFT) {
    return (
      <PortalShell user={user} title={t('editTitle')} subtitle={t('editNotAllowed')}>
        <Link href={`/shipments/${shipment.id}`} className="portal-button portal-button--primary">
          {t('backToDetails')}
        </Link>
      </PortalShell>
    );
  }

  const pickup = getPickupStop(shipment);
  const delivery = getDeliveryStop(shipment);
  const scheduledLocal = shipment.scheduledAt
    ? new Date(shipment.scheduledAt).toISOString().slice(0, 16)
    : '';

  return (
    <PortalShell user={user} title={t('editTitle')} subtitle={shipment.referenceNumber}>
      <FormError message={error} />

      <form
        className="shipment-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setIsSubmitting(true);

          const formData = new FormData(event.currentTarget);
          const pickupStop: CreateShipmentStopInput = {
            address: String(formData.get('pickupAddress') ?? '').trim(),
            city: String(formData.get('pickupCity') ?? '').trim(),
            latitude: Number(formData.get('pickupLatitude')),
            longitude: Number(formData.get('pickupLongitude')),
            stopType: 'pickup',
          };
          const deliveryStop: CreateShipmentStopInput = {
            address: String(formData.get('deliveryAddress') ?? '').trim(),
            city: String(formData.get('deliveryCity') ?? '').trim(),
            latitude: Number(formData.get('deliveryLatitude')),
            longitude: Number(formData.get('deliveryLongitude')),
            stopType: 'delivery',
          };

          const payload: UpdateShipmentRequest = {
            cargoType: String(formData.get('cargoType') ?? 'dry') as UpdateShipmentRequest['cargoType'],
            cargoDescription: String(formData.get('cargoDescription') ?? '').trim() || undefined,
            packageCount: formData.get('packageCount')
              ? Number(formData.get('packageCount'))
              : undefined,
            weightKg: formData.get('weightKg') ? Number(formData.get('weightKg')) : undefined,
            lengthCm: formData.get('lengthCm') ? Number(formData.get('lengthCm')) : undefined,
            widthCm: formData.get('widthCm') ? Number(formData.get('widthCm')) : undefined,
            heightCm: formData.get('heightCm') ? Number(formData.get('heightCm')) : undefined,
            shippingMethod: String(
              formData.get('shippingMethod') ?? 'standard',
            ) as UpdateShipmentRequest['shippingMethod'],
            isCrossBorder: formData.get('isCrossBorder') === 'on',
            scheduledAt: String(formData.get('scheduledAt') ?? '').trim() || undefined,
            stops: [pickupStop, deliveryStop],
          };

          try {
            await updateShipment(shipment.id, payload);
            router.push(`/shipments/${shipment.id}`);
          } catch (submitError) {
            setError(
              isApiClientError(submitError)
                ? getLocalizedApiMessage(submitError, locale as 'en' | 'ar')
                : tPortal('errors.generic'),
            );
          } finally {
            setIsSubmitting(false);
          }
        }}
      >
        <section className="form-section">
          <h2 className="form-section__title">{t('sections.cargo')}</h2>
          <div className="form-grid">
            <label style={fieldStyle}>
              <span>{t('fields.cargoType')}</span>
              <select
                name="cargoType"
                defaultValue={shipment.cargoType}
                style={inputStyle}
              >
                <option value="dry">{t('cargoType.dry')}</option>
                <option value="refrigerated">{t('cargoType.refrigerated')}</option>
                <option value="special">{t('cargoType.special')}</option>
              </select>
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.cargoDescription')}</span>
              <input
                name="cargoDescription"
                type="text"
                defaultValue={shipment.cargoDescription ?? ''}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.packageCount')}</span>
              <input
                name="packageCount"
                type="number"
                min="1"
                defaultValue={shipment.packageCount ?? ''}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.weightKg')}</span>
              <input
                name="weightKg"
                type="number"
                min="0"
                step="0.01"
                defaultValue={shipment.weightKg ?? ''}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.shippingMethod')}</span>
              <select
                name="shippingMethod"
                defaultValue={shipment.shippingMethod}
                style={inputStyle}
              >
                <option value="standard">{t('shippingMethod.standard')}</option>
                <option value="express">{t('shippingMethod.express')}</option>
                <option value="cross_border">{t('shippingMethod.cross_border')}</option>
              </select>
            </label>
            <label style={{ ...fieldStyle, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <input
                name="isCrossBorder"
                type="checkbox"
                defaultChecked={shipment.isCrossBorder}
              />
              <span>{t('fields.isCrossBorder')}</span>
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.scheduledAt')}</span>
              <input
                name="scheduledAt"
                type="datetime-local"
                defaultValue={scheduledLocal}
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2 className="form-section__title">{t('sections.pickup')}</h2>
          <div className="form-grid">
            <label style={fieldStyle}>
              <span>{t('fields.address')}</span>
              <input
                name="pickupAddress"
                type="text"
                required
                defaultValue={pickup?.address ?? ''}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.city')}</span>
              <input
                name="pickupCity"
                type="text"
                required
                defaultValue={pickup?.city ?? ''}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.latitude')}</span>
              <input
                name="pickupLatitude"
                type="number"
                step="any"
                required
                defaultValue={pickup ? Number(pickup.latitude) : ''}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.longitude')}</span>
              <input
                name="pickupLongitude"
                type="number"
                step="any"
                required
                defaultValue={pickup ? Number(pickup.longitude) : ''}
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2 className="form-section__title">{t('sections.delivery')}</h2>
          <div className="form-grid">
            <label style={fieldStyle}>
              <span>{t('fields.address')}</span>
              <input
                name="deliveryAddress"
                type="text"
                required
                defaultValue={delivery?.address ?? ''}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.city')}</span>
              <input
                name="deliveryCity"
                type="text"
                required
                defaultValue={delivery?.city ?? ''}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.latitude')}</span>
              <input
                name="deliveryLatitude"
                type="number"
                step="any"
                required
                defaultValue={delivery ? Number(delivery.latitude) : ''}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.longitude')}</span>
              <input
                name="deliveryLongitude"
                type="number"
                step="any"
                required
                defaultValue={delivery ? Number(delivery.longitude) : ''}
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        <div className="form-actions">
          <Link href={`/shipments/${shipment.id}`} className="portal-button portal-button--ghost">
            {t('cancel')}
          </Link>
          <button type="submit" className="portal-button portal-button--primary" disabled={isSubmitting}>
            {isSubmitting ? t('submitting') : t('saveChanges')}
          </button>
        </div>
      </form>
    </PortalShell>
  );
}
