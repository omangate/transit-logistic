'use client';

import { VehicleCategory, VehicleType, TruckAvailabilityStatus } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import { GeoRegionPicker } from '@/components/geography/geo-region-picker';
import { LoadingState } from '@/components/portal/loading-state';
import { useRouter } from '@/i18n/navigation';
import {
  createFleetTruckListing,
  getFleetTruckListing,
  updateFleetTruckListing,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { CreateTruckListingInput, FleetTruckListing } from '@/types/marketplace';

type FleetTruckListingFormProps = {
  listingId?: string;
  onSaved?: (listing: FleetTruckListing) => void;
};

function parseGalleryUrls(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function FleetTruckListingForm({ listingId, onSaved }: FleetTruckListingFormProps) {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const router = useRouter();
  const isEdit = Boolean(listingId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceAreaIds, setServiceAreaIds] = useState<string[]>([]);

  const [form, setForm] = useState<CreateTruckListingInput>({
    name: '',
    brand: '',
    model: '',
    vehicleCategory: VehicleCategory.HEAVY_TRUCK,
    vehicleType: VehicleType.FLATBED,
    availabilityStatus: TruckAvailabilityStatus.AVAILABLE,
    operatingCountries: ['OM'],
    crossBorderSupport: false,
    refrigeratedSupport: false,
    withDriverAvailable: true,
    withoutDriverAvailable: true,
    hazardousMaterialsSupport: false,
    containerTransportSupport: false,
    insuranceCoverage: false,
  });
  const [galleryRaw, setGalleryRaw] = useState('');

  useEffect(() => {
    if (!listingId) return;
    setLoading(true);
    void getFleetTruckListing(listingId)
      .then((listing) => {
        setForm({
          name: listing.name,
          brand: listing.brand ?? '',
          model: listing.model ?? '',
          year: listing.year ?? undefined,
          vehicleCategory: listing.vehicleCategory,
          vehicleType: listing.vehicleType,
          capacityKg: listing.capacityKg ? Number(listing.capacityKg) : undefined,
          capacityCbm: listing.capacityCbm ? Number(listing.capacityCbm) : undefined,
          lengthM: listing.lengthM ? Number(listing.lengthM) : undefined,
          widthM: listing.widthM ? Number(listing.widthM) : undefined,
          heightM: listing.heightM ? Number(listing.heightM) : undefined,
          crossBorderSupport: listing.crossBorderSupport,
          refrigeratedSupport: listing.refrigeratedSupport,
          hazardousMaterialsSupport: listing.hazardousMaterialsSupport ?? false,
          containerTransportSupport: listing.containerTransportSupport ?? false,
          dailyRentalPrice: listing.dailyRentalPrice ? Number(listing.dailyRentalPrice) : undefined,
          weeklyRentalPrice: listing.weeklyRentalPrice ? Number(listing.weeklyRentalPrice) : undefined,
          monthlyRentalPrice: listing.monthlyRentalPrice ? Number(listing.monthlyRentalPrice) : undefined,
          withDriverAvailable: listing.withDriverAvailable ?? true,
          withoutDriverAvailable: listing.withoutDriverAvailable ?? true,
          minRentalDays: listing.minRentalDays ?? undefined,
          availabilityStatus: listing.availabilityStatus,
          insuranceCoverage: listing.insuranceCoverage ?? false,
          operatingCountries: listing.operatingCountries,
          description: listing.description ?? '',
          coverImageUrl: listing.coverImageUrl ?? '',
          videoUrl: listing.videoUrl ?? '',
          plateNumber: listing.plateNumber ?? '',
        });
        setGalleryRaw(
          listing.images?.filter((img) => !img.isCover).map((img) => img.url).join('\n') ?? '',
        );
        setServiceAreaIds(listing.serviceAreas?.map((sa) => sa.geoRegion.id) ?? []);
      })
      .catch((err) => {
        setError(
          isApiClientError(err) ? getLocalizedApiMessage(err, locale as 'en' | 'ar') : t('errors.generic'),
        );
      })
      .finally(() => setLoading(false));
  }, [listingId, locale, t]);

  const update = <K extends keyof CreateTruckListingInput>(
    key: K,
    value: CreateTruckListingInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: CreateTruckListingInput = {
      ...form,
      galleryImages: parseGalleryUrls(galleryRaw),
      serviceAreaIds,
      operatingCountries: form.operatingCountries?.length
        ? form.operatingCountries
        : ['OM'],
    };

    try {
      const saved = isEdit && listingId
        ? await updateFleetTruckListing(listingId, payload)
        : await createFleetTruckListing(payload);
      onSaved?.(saved);
      router.push('/fleet/marketplace');
    } catch (err) {
      setError(
        isApiClientError(err) ? getLocalizedApiMessage(err, locale as 'en' | 'ar') : t('errors.generic'),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message={t('loading')} />;

  return (
    <form className="truck-listing-form" onSubmit={handleSubmit}>
      <FormError message={error} />

      <section className="truck-listing-form__section">
        <h2>{t('form.media')}</h2>
        <label>
          {t('form.coverImage')}
          <input
            type="url"
            value={form.coverImageUrl ?? ''}
            onChange={(e) => update('coverImageUrl', e.target.value)}
            placeholder="https://"
          />
        </label>
        <label>
          {t('form.galleryImages')}
          <textarea
            rows={3}
            value={galleryRaw}
            onChange={(e) => setGalleryRaw(e.target.value)}
            placeholder={t('form.galleryPlaceholder')}
          />
        </label>
        <label>
          {t('form.videoUrl')}
          <input
            type="url"
            value={form.videoUrl ?? ''}
            onChange={(e) => update('videoUrl', e.target.value)}
            placeholder="https://"
          />
        </label>
      </section>

      <section className="truck-listing-form__section">
        <h2>{t('form.basicInfo')}</h2>
        <div className="truck-listing-form__grid">
          <label>
            {t('fleet.fields.name')}
            <input
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          <label>
            {t('fleet.fields.brand')}
            <input value={form.brand ?? ''} onChange={(e) => update('brand', e.target.value)} />
          </label>
          <label>
            {t('fleet.fields.model')}
            <input value={form.model ?? ''} onChange={(e) => update('model', e.target.value)} />
          </label>
          <label>
            {t('fleet.fields.year')}
            <input
              type="number"
              min={1980}
              max={2100}
              value={form.year ?? ''}
              onChange={(e) => update('year', e.target.value ? Number(e.target.value) : undefined)}
            />
          </label>
        </div>
      </section>

      <section className="truck-listing-form__section">
        <h2>{t('form.specs')}</h2>
        <div className="truck-listing-form__grid">
          <label>
            {t('filters.category')}
            <select
              value={form.vehicleCategory}
              onChange={(e) => update('vehicleCategory', e.target.value as VehicleCategory)}
            >
              {Object.values(VehicleCategory).map((v) => (
                <option key={v} value={v}>{t(`categories.${v}`)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('filters.vehicleType')}
            <select
              value={form.vehicleType}
              onChange={(e) => update('vehicleType', e.target.value as VehicleType)}
            >
              {Object.values(VehicleType).map((v) => (
                <option key={v} value={v}>{t(`vehicleTypes.${v}`)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('fleet.fields.capacityKg')}
            <input
              type="number"
              min={0}
              value={form.capacityKg ?? ''}
              onChange={(e) =>
                update('capacityKg', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </label>
          <label>
            {t('form.capacityCbm')}
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.capacityCbm ?? ''}
              onChange={(e) =>
                update('capacityCbm', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </label>
          <label>
            {t('form.length')}
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.lengthM ?? ''}
              onChange={(e) =>
                update('lengthM', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </label>
          <label>
            {t('form.width')}
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.widthM ?? ''}
              onChange={(e) =>
                update('widthM', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </label>
          <label>
            {t('form.height')}
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.heightM ?? ''}
              onChange={(e) =>
                update('heightM', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </label>
        </div>
      </section>

      <section className="truck-listing-form__section">
        <h2>{t('rental.pricingSection')}</h2>
        <div className="truck-listing-form__grid">
          <label>
            {t('rental.dailyPrice')}
            <input
              type="number"
              min={0}
              step="0.001"
              value={form.dailyRentalPrice ?? ''}
              onChange={(e) =>
                update('dailyRentalPrice', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </label>
          <label>
            {t('rental.weeklyPrice')}
            <input
              type="number"
              min={0}
              step="0.001"
              value={form.weeklyRentalPrice ?? ''}
              onChange={(e) =>
                update('weeklyRentalPrice', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </label>
          <label>
            {t('rental.monthlyPrice')}
            <input
              type="number"
              min={0}
              step="0.001"
              value={form.monthlyRentalPrice ?? ''}
              onChange={(e) =>
                update('monthlyRentalPrice', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </label>
          <label>
            {t('rental.minDuration')}
            <input
              type="number"
              min={1}
              value={form.minRentalDays ?? ''}
              onChange={(e) =>
                update('minRentalDays', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </label>
        </div>
        <label>
          {t('form.availability')}
          <select
            value={form.availabilityStatus ?? TruckAvailabilityStatus.AVAILABLE}
            onChange={(e) =>
              update('availabilityStatus', e.target.value as TruckAvailabilityStatus)
            }
          >
            {Object.values(TruckAvailabilityStatus).map((v) => (
              <option key={v} value={v}>{t(`availability.${v}`)}</option>
            ))}
          </select>
        </label>
        <div className="truck-listing-form__checks">
          <label>
            <input
              type="checkbox"
              checked={form.withDriverAvailable ?? true}
              onChange={(e) => update('withDriverAvailable', e.target.checked)}
            />
            {t('rental.withDriver')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.withoutDriverAvailable ?? true}
              onChange={(e) => update('withoutDriverAvailable', e.target.checked)}
            />
            {t('rental.withoutDriver')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.insuranceCoverage ?? false}
              onChange={(e) => update('insuranceCoverage', e.target.checked)}
            />
            {t('rental.insurance')}
          </label>
        </div>
      </section>

      <section className="truck-listing-form__section">
        <h2>{t('form.capabilities')}</h2>
        <div className="truck-listing-form__checks">
          <label>
            <input
              type="checkbox"
              checked={form.refrigeratedSupport ?? false}
              onChange={(e) => update('refrigeratedSupport', e.target.checked)}
            />
            {t('filters.refrigerated')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.containerTransportSupport ?? false}
              onChange={(e) => update('containerTransportSupport', e.target.checked)}
            />
            {t('filters.containerTransport')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.hazardousMaterialsSupport ?? false}
              onChange={(e) => update('hazardousMaterialsSupport', e.target.checked)}
            />
            {t('form.hazardous')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.crossBorderSupport ?? false}
              onChange={(e) => update('crossBorderSupport', e.target.checked)}
            />
            {t('filters.crossBorder')}
          </label>
        </div>
      </section>

      <section className="truck-listing-form__section">
        <h2>{t('form.serviceAreas')}</h2>
        <GeoRegionPicker selectedIds={serviceAreaIds} onChange={setServiceAreaIds} />
        <label>
          {t('form.operatingCountries')}
          <input
            value={(form.operatingCountries ?? []).join(', ')}
            onChange={(e) =>
              update(
                'operatingCountries',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder="OM, AE, SA"
          />
        </label>
      </section>

      <section className="truck-listing-form__section">
        <h2>{t('form.descriptionSection')}</h2>
        <label>
          {t('fleet.fields.description')}
          <textarea
            rows={5}
            value={form.description ?? ''}
            onChange={(e) => update('description', e.target.value)}
          />
        </label>
      </section>

      <section className="truck-listing-form__section truck-listing-form__section--private">
        <h2>{t('form.privateInfo')}</h2>
        <p className="truck-listing-form__private-note">{t('form.platePrivateNote')}</p>
        <label>
          {t('form.plateNumber')}
          <input
            value={form.plateNumber ?? ''}
            onChange={(e) => update('plateNumber', e.target.value)}
            autoComplete="off"
          />
        </label>
      </section>

      <div className="truck-listing-form__actions">
        <button
          type="button"
          className="portal-button"
          onClick={() => router.push('/fleet/marketplace')}
        >
          {t('fleet.cancel')}
        </button>
        <button
          type="submit"
          className="portal-button portal-button--primary"
          disabled={saving}
        >
          {saving ? t('loading') : isEdit ? t('form.updateListing') : t('fleet.save')}
        </button>
      </div>
    </form>
  );
}
