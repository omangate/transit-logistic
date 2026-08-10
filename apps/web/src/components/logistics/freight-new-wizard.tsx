'use client';

import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { useRequireCustomerAuth } from '@/hooks/use-require-customer-auth';
import { useRouter } from '@/i18n/navigation';
import { createFreightRequest, submitFreightShipment } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';

const STEPS = ['mode', 'route', 'cargo', 'services', 'review'] as const;

const SEA_SERVICES = ['fcl', 'lcl', 'roro', 'breakbulk', 'project_cargo', 'reefer'] as const;
const ROUTE_TYPES = ['door_to_door', 'door_to_port', 'port_to_door', 'port_to_port'] as const;

export function FreightNewWizard() {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireCustomerAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const logisticsOrderId = searchParams.get('orderId') ?? undefined;
  const [step, setStep] = useState<(typeof STEPS)[number]>('mode');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    transportMode: 'sea',
    serviceType: 'fcl',
    routeType: 'door_to_door',
    origin: '',
    destination: '',
    cargoDescription: '',
    commodity: '',
    weightKg: '',
    volumeCbm: '',
    containerType: '40ft',
    containerQuantity: '1',
    preferredDepartureDate: '',
    specialInstructions: '',
    customsClearanceRequired: true,
    pickupRequired: true,
    deliveryRequired: true,
    insuranceRequired: false,
  });

  const stepIndex = STEPS.indexOf(step);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await createFreightRequest({
        ...form,
        logisticsOrderId,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        volumeCbm: form.volumeCbm ? Number(form.volumeCbm) : undefined,
        containerQuantity: form.containerQuantity ? Number(form.containerQuantity) : undefined,
      });
      await submitFreightShipment(created.id);
      router.push(logisticsOrderId ? `/logistics/orders/${logisticsOrderId}` : `/freight/shipments/${created.id}`);
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalShell user={user} title={t('freight.newRequest')} subtitle={t('freight.subtitle')}>
      <div className="logistics-wizard">
        <div className="logistics-wizard__progress">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= stepIndex ? 'logistics-wizard__step--active' : ''}>
              {t(`freight.steps.${s}` as never)}
            </span>
          ))}
        </div>
        {error ? <FormError message={error} /> : null}

        {step === 'mode' ? (
          <div className="logistics-wizard__grid">
            {(['sea', 'air', 'road', 'multimodal'] as const).map((mode) => (
              <button key={mode} type="button" className={`logistics-type-card${form.transportMode === mode ? ' logistics-type-card--active' : ''}`} onClick={() => setForm((f) => ({ ...f, transportMode: mode }))}>
                {t(`freight.modes.${mode}` as never)}
              </button>
            ))}
            {form.transportMode === 'sea' ? (
              <label>{t('freight.fields.serviceType')}
                <select value={form.serviceType} onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}>
                  {SEA_SERVICES.map((s) => <option key={s} value={s}>{t(`freight.seaServices.${s}` as never)}</option>)}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        {step === 'route' ? (
          <div className="logistics-wizard__section">
            <label>{t('freight.fields.routeType')}
              <select value={form.routeType} onChange={(e) => setForm((f) => ({ ...f, routeType: e.target.value }))}>
                {ROUTE_TYPES.map((r) => <option key={r} value={r}>{t(`freight.routeTypes.${r}` as never)}</option>)}
              </select>
            </label>
            <label>{t('freight.fields.origin')}<input required value={form.origin} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} /></label>
            <label>{t('freight.fields.destination')}<input required value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} /></label>
            <label>{t('freight.fields.departureDate')}<input type="date" value={form.preferredDepartureDate} onChange={(e) => setForm((f) => ({ ...f, preferredDepartureDate: e.target.value }))} /></label>
          </div>
        ) : null}

        {step === 'cargo' ? (
          <div className="logistics-wizard__section">
            <label>{t('freight.fields.cargo')}<textarea value={form.cargoDescription} onChange={(e) => setForm((f) => ({ ...f, cargoDescription: e.target.value }))} /></label>
            <label>{t('freight.fields.commodity')}<input value={form.commodity} onChange={(e) => setForm((f) => ({ ...f, commodity: e.target.value }))} /></label>
            <label>{t('freight.fields.weight')}<input type="number" value={form.weightKg} onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))} /></label>
            <label>{t('freight.fields.cbm')}<input type="number" value={form.volumeCbm} onChange={(e) => setForm((f) => ({ ...f, volumeCbm: e.target.value }))} /></label>
            <label>{t('freight.fields.containerType')}<input value={form.containerType} onChange={(e) => setForm((f) => ({ ...f, containerType: e.target.value }))} /></label>
            <label>{t('freight.fields.containerQty')}<input type="number" value={form.containerQuantity} onChange={(e) => setForm((f) => ({ ...f, containerQuantity: e.target.value }))} /></label>
          </div>
        ) : null}

        {step === 'services' ? (
          <div className="logistics-wizard__section">
            <label><input type="checkbox" checked={form.pickupRequired} onChange={(e) => setForm((f) => ({ ...f, pickupRequired: e.target.checked }))} /> {t('freight.fields.pickupRequired')}</label>
            <label><input type="checkbox" checked={form.deliveryRequired} onChange={(e) => setForm((f) => ({ ...f, deliveryRequired: e.target.checked }))} /> {t('freight.fields.deliveryRequired')}</label>
            <label><input type="checkbox" checked={form.customsClearanceRequired} onChange={(e) => setForm((f) => ({ ...f, customsClearanceRequired: e.target.checked }))} /> {t('freight.fields.customsRequired')}</label>
            <label><input type="checkbox" checked={form.insuranceRequired} onChange={(e) => setForm((f) => ({ ...f, insuranceRequired: e.target.checked }))} /> {t('freight.fields.insuranceRequired')}</label>
            <label>{t('freight.fields.specialInstructions')}<textarea value={form.specialInstructions} onChange={(e) => setForm((f) => ({ ...f, specialInstructions: e.target.value }))} /></label>
          </div>
        ) : null}

        {step === 'review' ? (
          <div className="logistics-wizard__review">
            <p>{form.origin} → {form.destination}</p>
            <p>{t(`freight.modes.${form.transportMode}` as never)} · {t(`freight.routeTypes.${form.routeType}` as never)}</p>
          </div>
        ) : null}

        <div className="logistics-wizard__nav">
          {stepIndex > 0 ? (
            <button type="button" className="rental-btn rental-btn--ghost" onClick={() => setStep(STEPS[stepIndex - 1]!)}>{t('wizard.back')}</button>
          ) : null}
          {step !== 'review' ? (
            <button type="button" className="rental-btn rental-btn--primary" onClick={() => setStep(STEPS[stepIndex + 1]!)}>{t('wizard.next')}</button>
          ) : (
            <button type="button" className="rental-btn rental-btn--primary" disabled={saving} onClick={() => void publish()}>{t('freight.submit')}</button>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
