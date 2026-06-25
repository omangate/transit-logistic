'use client';

import { CargoType } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { FormError } from '@/components/form-error';
import { GeoLocationSearch } from '@/components/geography/geo-location-search';
import { OmanMap } from '@/components/map/oman-map';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { createShipmentRequest } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { GeoRegion } from '@/types/geography';

export function ShipmentRequestContent() {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const { user, isReady } = useRequireAuth();

  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [pickupRegion, setPickupRegion] = useState<GeoRegion | null>(null);
  const [deliveryRegion, setDeliveryRegion] = useState<GeoRegion | null>(null);
  const [cargoType, setCargoType] = useState<CargoType>(CargoType.DRY);
  const [weightKg, setWeightKg] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mapMarkers = [];
  if (pickupRegion?.latitude && pickupRegion?.longitude) {
    mapMarkers.push({
      id: 'pickup',
      latitude: Number(pickupRegion.latitude),
      longitude: Number(pickupRegion.longitude),
      label: pickupAddress,
    });
  }
  if (deliveryRegion?.latitude && deliveryRegion?.longitude) {
    mapMarkers.push({
      id: 'delivery',
      latitude: Number(deliveryRegion.latitude),
      longitude: Number(deliveryRegion.longitude),
      label: deliveryAddress,
    });
  }

  if (!isReady) return <p>{t('loading')}</p>;
  if (!user) return <p>{t('request.loginRequired')}</p>;

  return (
    <main>
      <header className="marketplace-hero">
        <div className="container">
          <h1>{t('request.title')}</h1>
          <p>{t('request.subtitle')}</p>
        </div>
      </header>

      <section className="container shipment-request-layout">
        <form
          className="shipment-request-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setSuccess(false);
            setSubmitting(true);
            try {
              await createShipmentRequest({
                pickupAddress,
                pickupGeoRegionId: pickupRegion?.id,
                pickupLatitude: pickupRegion?.latitude ? Number(pickupRegion.latitude) : undefined,
                pickupLongitude: pickupRegion?.longitude ? Number(pickupRegion.longitude) : undefined,
                deliveryAddress,
                deliveryGeoRegionId: deliveryRegion?.id,
                deliveryLatitude: deliveryRegion?.latitude
                  ? Number(deliveryRegion.latitude)
                  : undefined,
                deliveryLongitude: deliveryRegion?.longitude
                  ? Number(deliveryRegion.longitude)
                  : undefined,
                cargoType,
                weightKg: weightKg ? Number(weightKg) : undefined,
                preferredDate: preferredDate || undefined,
                notes: notes || undefined,
              });
              setSuccess(true);
            } catch (err) {
              setError(
                isApiClientError(err)
                  ? getLocalizedApiMessage(err, locale as 'en' | 'ar')
                  : t('errors.generic'),
              );
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <FormError message={error} />
          {success ? <p className="form-success">{t('request.success')}</p> : null}

          <GeoLocationSearch
            label={t('form.pickup')}
            value={pickupAddress}
            regionId={pickupRegion?.id}
            onAddressChange={setPickupAddress}
            onRegionSelect={setPickupRegion}
          />
          <GeoLocationSearch
            label={t('form.delivery')}
            value={deliveryAddress}
            regionId={deliveryRegion?.id}
            onAddressChange={setDeliveryAddress}
            onRegionSelect={setDeliveryRegion}
          />

          <label>
            {t('request.cargoType')}
            <select
              value={cargoType}
              onChange={(e) => setCargoType(e.target.value as CargoType)}
            >
              {Object.values(CargoType).map((v) => (
                <option key={v} value={v}>
                  {t(`cargoTypes.${v}`)}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('request.weight')}
            <input
              type="number"
              min={0}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              required
            />
          </label>

          <label>
            {t('request.preferredDate')}
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
            />
          </label>

          <label>
            {t('request.notes')}
            <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <button
            type="submit"
            className="portal-button portal-button--primary"
            disabled={submitting}
          >
            {submitting ? t('loading') : t('request.submit')}
          </button>
        </form>

        <OmanMap markers={mapMarkers} height={400} />
      </section>
    </main>
  );
}
