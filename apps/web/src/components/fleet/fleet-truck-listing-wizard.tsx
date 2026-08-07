'use client';

import { VehicleCategory, VehicleType, TruckAvailabilityStatus } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { TruckMediaUploader } from '@/components/fleet/truck-media-uploader';
import { FormError } from '@/components/form-error';
import { GeoRegionPicker } from '@/components/geography/geo-region-picker';
import { LoadingState } from '@/components/portal/loading-state';
import { useRouter } from '@/i18n/navigation';
import {
  createFleetTruckListing,
  getFleetTruckListing,
  saveFleetTruckListingDraft,
  submitFleetTruckListing,
  updateFleetTruckListing,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { CreateTruckListingInput, FleetTruckListing } from '@/types/marketplace';

const STEPS = [
  'media',
  'basic',
  'specs',
  'pricing',
  'capabilities',
  'areas',
  'documents',
  'description',
  'preview',
] as const;

type Step = (typeof STEPS)[number];

type Props = {
  listingId?: string;
};

export function FleetTruckListingWizard({ listingId: initialListingId }: Props) {
  const t = useTranslations('marketplace');
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();

  const [listingId, setListingId] = useState(initialListingId);
  const [step, setStep] = useState<Step>('media');
  const [loading, setLoading] = useState(Boolean(initialListingId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<FleetTruckListing | null>(null);
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

  const stepIndex = STEPS.indexOf(step);
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const reloadListing = useCallback(async () => {
    if (!listingId) return;
    const data = await getFleetTruckListing(listingId);
    setListing(data);
    setServiceAreaIds(data.serviceAreas?.map((sa) => sa.geoRegion.id) ?? []);
  }, [listingId]);

  useEffect(() => {
    if (!listingId) return;
    setLoading(true);
    void reloadListing()
      .catch((err) => {
        setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
      })
      .finally(() => setLoading(false));
  }, [listingId, locale, reloadListing, t]);

  const update = <K extends keyof CreateTruckListingInput>(key: K, value: CreateTruckListingInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const ensureListing = async () => {
    if (listingId) return listingId;
    const created = await createFleetTruckListing({ ...form, name: form.name || t('form.draftName') });
    setListingId(created.id);
    setListing(created);
    return created.id;
  };

  const autosave = async () => {
    if (!listingId) return;
    await saveFleetTruckListingDraft(listingId, { ...form, serviceAreaIds });
  };

  useEffect(() => {
    if (!listingId) return;
    const timer = setTimeout(() => void autosave().catch(() => undefined), 1500);
    return () => clearTimeout(timer);
  });

  const goNext = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = await ensureListing();
      if (step !== 'media' && step !== 'preview') {
        await updateFleetTruckListing(id, { ...form, serviceAreaIds });
      }
      const next = STEPS[stepIndex + 1];
      if (next) setStep(next);
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const publish = async () => {
    if (!listingId) return;
    setSaving(true);
    try {
      await updateFleetTruckListing(listingId, { ...form, serviceAreaIds });
      await submitFleetTruckListing(listingId);
      router.push('/fleet/marketplace');
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const stepTitle = useMemo(() => t(`wizard.steps.${step}` as never), [step, t]);

  if (loading) return <LoadingState message={t('loading')} />;

  return (
    <div className="listing-wizard">
      <div className="listing-wizard__progress">
        <div className="listing-wizard__bar" style={{ width: `${progress}%` }} />
        <span>{stepTitle}</span>
      </div>

      {error ? <FormError message={error} /> : null}

      {step === 'media' && listingId ? (
        <TruckMediaUploader
          listingId={listingId}
          images={listing?.images ?? []}
          coverUrl={listing?.coverImageUrl}
          videoUrl={listing?.videoUrl}
          onChange={() => void reloadListing()}
          locale={locale}
        />
      ) : null}

      {step === 'media' && !listingId ? (
        <div className="listing-wizard__intro">
          <p>{t('wizard.mediaIntro')}</p>
          <button type="button" className="rental-btn rental-btn--primary" disabled={saving} onClick={() => void goNext()}>
            {t('wizard.startDraft')}
          </button>
        </div>
      ) : null}

      {step === 'basic' ? (
        <div className="listing-wizard__section">
          <label>{t('fleet.fields.name')}<input value={form.name} onChange={(e) => update('name', e.target.value)} required /></label>
          <label>{t('fleet.fields.brand')}<input value={form.brand ?? ''} onChange={(e) => update('brand', e.target.value)} /></label>
          <label>{t('fleet.fields.model')}<input value={form.model ?? ''} onChange={(e) => update('model', e.target.value)} /></label>
          <label>{t('fleet.fields.year')}<input type="number" value={form.year ?? ''} onChange={(e) => update('year', Number(e.target.value))} /></label>
        </div>
      ) : null}

      {step === 'specs' ? (
        <div className="listing-wizard__section">
          <label>{t('fleet.fields.capacityKg')}<input type="number" value={form.capacityKg ?? ''} onChange={(e) => update('capacityKg', Number(e.target.value))} /></label>
          <label>{t('form.capacityCbm')}<input type="number" value={form.capacityCbm ?? ''} onChange={(e) => update('capacityCbm', Number(e.target.value))} /></label>
          <label>{t('form.plateNumber')}<input value={form.plateNumber ?? ''} onChange={(e) => update('plateNumber', e.target.value)} /></label>
        </div>
      ) : null}

      {step === 'pricing' ? (
        <div className="listing-wizard__section">
          <label>{t('rental.dailyPrice')}<input type="number" step="0.001" value={form.dailyRentalPrice ?? ''} onChange={(e) => update('dailyRentalPrice', Number(e.target.value))} /></label>
          <label>{t('rental.weeklyPrice')}<input type="number" step="0.001" value={form.weeklyRentalPrice ?? ''} onChange={(e) => update('weeklyRentalPrice', Number(e.target.value))} /></label>
          <label>{t('rental.monthlyPrice')}<input type="number" step="0.001" value={form.monthlyRentalPrice ?? ''} onChange={(e) => update('monthlyRentalPrice', Number(e.target.value))} /></label>
        </div>
      ) : null}

      {step === 'capabilities' ? (
        <div className="listing-wizard__section listing-wizard__checks">
          {(['crossBorderSupport', 'refrigeratedSupport', 'containerTransportSupport', 'insuranceCoverage'] as const).map((key) => (
            <label key={key}>
              <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => update(key, e.target.checked)} />
              {t(`form.${key}`)}
            </label>
          ))}
        </div>
      ) : null}

      {step === 'areas' ? (
        <GeoRegionPicker countryCode="OM" selectedIds={serviceAreaIds} onChange={setServiceAreaIds} />
      ) : null}

      {step === 'documents' ? (
        <p>{t('wizard.documentsHint')}</p>
      ) : null}

      {step === 'description' ? (
        <textarea rows={6} value={form.description ?? ''} onChange={(e) => update('description', e.target.value)} />
      ) : null}

      {step === 'preview' ? (
        <div className="listing-wizard__preview">
          <h3>{form.name}</h3>
          <p>{form.description}</p>
          <button type="button" className="rental-btn rental-btn--primary" disabled={saving} onClick={() => void publish()}>
            {t('wizard.publish')}
          </button>
        </div>
      ) : null}

      <div className="listing-wizard__nav">
        {stepIndex > 0 ? (
          <button type="button" className="rental-btn rental-btn--ghost" onClick={goBack}>
            {t('wizard.back')}
          </button>
        ) : null}
        {step !== 'preview' && step !== 'media' ? (
          <button type="button" className="rental-btn rental-btn--primary" disabled={saving} onClick={() => void goNext()}>
            {t('wizard.next')}
          </button>
        ) : null}
        {step === 'media' && listingId ? (
          <button type="button" className="rental-btn rental-btn--primary" disabled={saving} onClick={() => void goNext()}>
            {t('wizard.next')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
