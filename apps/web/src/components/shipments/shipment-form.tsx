'use client';

import { UserRole } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';
import { PortalShell } from '../portal/portal-shell';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link, useRouter } from '@/i18n/navigation';
import { createShipment } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { CreateShipmentRequest, CreateShipmentStopInput } from '@/types/shipment';

const DEFAULT_PICKUP = {
  address: 'King Fahd Road, Al Olaya',
  city: 'Riyadh',
  latitude: 24.7136,
  longitude: 46.6753,
};

const DEFAULT_DELIVERY = {
  address: 'Al Madinah Road, Al Hamra',
  city: 'Jeddah',
  latitude: 21.5433,
  longitude: 39.1728,
};

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

export function ShipmentForm() {
  const t = useTranslations('shipments');
  const tPortal = useTranslations('portal');
  const locale = useLocale();
  const router = useRouter();
  const { user, isReady } = useRequireAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isReady || !user) {
    return <LoadingState message={tPortal('loading')} />;
  }

  if (user.role !== UserRole.CUSTOMER) {
    return (
      <PortalShell user={user} title={t('createTitle')} subtitle={t('createSubtitle')}>
        <div className="empty-state">
          <p>{t('customerOnly')}</p>
          <Link href="/shipments" className="portal-button portal-button--primary">
            {t('backToList')}
          </Link>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell user={user} title={t('createTitle')} subtitle={t('createSubtitle')}>
      <FormError message={error} />

      <form
        className="shipment-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setIsSubmitting(true);

          const formData = new FormData(event.currentTarget);
          const cargoDescription = String(formData.get('cargoDescription') ?? '').trim();
          const weightRaw = String(formData.get('weightKg') ?? '').trim();
          const packageRaw = String(formData.get('packageCount') ?? '').trim();
          const lengthRaw = String(formData.get('lengthCm') ?? '').trim();
          const widthRaw = String(formData.get('widthCm') ?? '').trim();
          const heightRaw = String(formData.get('heightCm') ?? '').trim();
          const scheduledAt = String(formData.get('scheduledAt') ?? '').trim();
          const cargoType = String(formData.get('cargoType') ?? 'dry');
          const shippingMethod = String(formData.get('shippingMethod') ?? 'standard');
          const isCrossBorder = formData.get('isCrossBorder') === 'on';

          const pickup: CreateShipmentStopInput = {
            address: String(formData.get('pickupAddress') ?? '').trim(),
            city: String(formData.get('pickupCity') ?? '').trim(),
            latitude: Number(formData.get('pickupLatitude')),
            longitude: Number(formData.get('pickupLongitude')),
            stopType: 'pickup',
          };

          const delivery: CreateShipmentStopInput = {
            address: String(formData.get('deliveryAddress') ?? '').trim(),
            city: String(formData.get('deliveryCity') ?? '').trim(),
            latitude: Number(formData.get('deliveryLatitude')),
            longitude: Number(formData.get('deliveryLongitude')),
            stopType: 'delivery',
          };

          if (
            !pickup.address ||
            !pickup.city ||
            !delivery.address ||
            !delivery.city ||
            Number.isNaN(pickup.latitude) ||
            Number.isNaN(pickup.longitude) ||
            Number.isNaN(delivery.latitude) ||
            Number.isNaN(delivery.longitude)
          ) {
            setError(t('errors.requiredStops'));
            setIsSubmitting(false);
            return;
          }

          try {
            const shipment = await createShipment({
              cargoType: cargoType as CreateShipmentRequest['cargoType'],
              cargoDescription: cargoDescription || undefined,
              weightKg: weightRaw ? Number(weightRaw) : undefined,
              packageCount: packageRaw ? Number(packageRaw) : undefined,
              lengthCm: lengthRaw ? Number(lengthRaw) : undefined,
              widthCm: widthRaw ? Number(widthRaw) : undefined,
              heightCm: heightRaw ? Number(heightRaw) : undefined,
              shippingMethod: shippingMethod as CreateShipmentRequest['shippingMethod'],
              isCrossBorder,
              scheduledAt: scheduledAt || undefined,
              stops: [pickup, delivery],
            });

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
              <select name="cargoType" defaultValue="dry" style={inputStyle}>
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
                style={inputStyle}
                placeholder={t('placeholders.cargoDescription')}
              />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.packageCount')}</span>
              <input name="packageCount" type="number" min="1" step="1" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.weightKg')}</span>
              <input name="weightKg" type="number" min="0" step="0.01" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.lengthCm')}</span>
              <input name="lengthCm" type="number" min="0" step="0.01" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.widthCm')}</span>
              <input name="widthCm" type="number" min="0" step="0.01" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.heightCm')}</span>
              <input name="heightCm" type="number" min="0" step="0.01" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.shippingMethod')}</span>
              <select name="shippingMethod" defaultValue="standard" style={inputStyle}>
                <option value="standard">{t('shippingMethod.standard')}</option>
                <option value="express">{t('shippingMethod.express')}</option>
                <option value="cross_border">{t('shippingMethod.cross_border')}</option>
              </select>
            </label>
            <label style={{ ...fieldStyle, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <input name="isCrossBorder" type="checkbox" />
              <span>{t('fields.isCrossBorder')}</span>
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.scheduledAt')}</span>
              <input name="scheduledAt" type="datetime-local" style={inputStyle} />
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
                defaultValue={DEFAULT_PICKUP.address}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.city')}</span>
              <input
                name="pickupCity"
                type="text"
                required
                defaultValue={DEFAULT_PICKUP.city}
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
                defaultValue={DEFAULT_PICKUP.latitude}
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
                defaultValue={DEFAULT_PICKUP.longitude}
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
                defaultValue={DEFAULT_DELIVERY.address}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>{t('fields.city')}</span>
              <input
                name="deliveryCity"
                type="text"
                required
                defaultValue={DEFAULT_DELIVERY.city}
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
                defaultValue={DEFAULT_DELIVERY.latitude}
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
                defaultValue={DEFAULT_DELIVERY.longitude}
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        <div className="form-actions">
          <Link href="/shipments" className="portal-button portal-button--ghost">
            {t('cancel')}
          </Link>
          <button type="submit" className="portal-button portal-button--primary" disabled={isSubmitting}>
            {isSubmitting ? t('submitting') : t('submit')}
          </button>
        </div>
      </form>
    </PortalShell>
  );
}
