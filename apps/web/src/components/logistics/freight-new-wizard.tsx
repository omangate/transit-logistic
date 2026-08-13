'use client';

import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { FormError } from '@/components/form-error';
import { PortAutocomplete } from '@/components/geography/port-autocomplete';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { useRequireCustomerAuth } from '@/hooks/use-require-customer-auth';
import { useRouter } from '@/i18n/navigation';
import { createFreightRequest, searchOceanSchedules, submitFreightShipment } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { NormalizedSailingSchedule } from '@/types/ocean';
import type { PortSearchResult } from '@/types/port';

const STEPS = ['route', 'cargo', 'equipment', 'sailing', 'documents', 'review'] as const;
const SEA_SERVICES = ['fcl', 'lcl', 'roro', 'breakbulk', 'project_cargo', 'reefer'] as const;

export function FreightNewWizard() {
  const t = useTranslations('quoteWizard');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireCustomerAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const logisticsOrderId = searchParams.get('orderId') ?? undefined;
  const [step, setStep] = useState<(typeof STEPS)[number]>('route');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [schedules, setSchedules] = useState<NormalizedSailingSchedule[]>([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [form, setForm] = useState({
    transportMode: 'sea',
    serviceType: 'fcl',
    routeType: 'port_to_port',
    origin: '',
    destination: '',
    originUnlocode: '',
    destinationUnlocode: '',
    cargoDescription: '',
    commodity: '',
    weightKg: '',
    volumeCbm: '',
    containerType: '40HC',
    containerQuantity: '1',
    preferredDepartureDate: '',
    preferredCarrier: '',
    specialInstructions: '',
    documentNotes: '',
    customsClearanceRequired: true,
    pickupRequired: false,
    deliveryRequired: false,
    insuranceRequired: false,
  });

  const stepIndex = STEPS.indexOf(step);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  const loadSchedules = async () => {
    if (!form.originUnlocode || !form.destinationUnlocode) {
      setSchedules([]);
      setSchedulesLoaded(true);
      return;
    }
    try {
      const rows = await searchOceanSchedules({
        originUnlocode: form.originUnlocode,
        destinationUnlocode: form.destinationUnlocode,
        departureDate: form.preferredDepartureDate || undefined,
        containerType: form.containerType,
      });
      setSchedules(rows);
    } catch {
      setSchedules([]);
    } finally {
      setSchedulesLoaded(true);
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await createFreightRequest({
        transportMode: form.transportMode,
        serviceType: form.serviceType,
        routeType: form.routeType,
        origin: form.origin,
        destination: form.destination,
        logisticsOrderId,
        cargoDescription: form.cargoDescription,
        commodity: form.commodity,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        volumeCbm: form.volumeCbm ? Number(form.volumeCbm) : undefined,
        containerType: form.containerType,
        containerQuantity: form.containerQuantity ? Number(form.containerQuantity) : undefined,
        preferredDepartureDate: form.preferredDepartureDate || undefined,
        specialInstructions: [form.specialInstructions, form.documentNotes, form.preferredCarrier ? `Preferred carrier/sailing: ${form.preferredCarrier}` : ''].filter(Boolean).join('\n'),
        customsClearanceRequired: form.customsClearanceRequired,
        pickupRequired: form.pickupRequired,
        deliveryRequired: form.deliveryRequired,
        insuranceRequired: form.insuranceRequired,
      });
      await submitFreightShipment(created.id);
      router.push(logisticsOrderId ? `/logistics/orders/${logisticsOrderId}` : `/freight/shipments/${created.id}`);
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <div className="logistics-wizard">
        <div className="logistics-wizard__progress">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= stepIndex ? 'logistics-wizard__step--active' : ''}>
              {t(`steps.${s}`)}
            </span>
          ))}
        </div>
        {error ? <FormError message={error} /> : null}

        {step === 'route' ? (
          <div className="logistics-wizard__section">
            <PortAutocomplete
              label={t('fields.origin')}
              value={form.origin}
              unlocode={form.originUnlocode}
              onChange={(display, port: PortSearchResult | null) =>
                setForm((f) => ({ ...f, origin: display, originUnlocode: port?.unlocode ?? '' }))
              }
              required
            />
            <PortAutocomplete
              label={t('fields.destination')}
              value={form.destination}
              unlocode={form.destinationUnlocode}
              onChange={(display, port: PortSearchResult | null) =>
                setForm((f) => ({ ...f, destination: display, destinationUnlocode: port?.unlocode ?? '' }))
              }
              required
            />
            <label>{t('fields.departureDate')}<input type="date" value={form.preferredDepartureDate} onChange={(e) => setForm((f) => ({ ...f, preferredDepartureDate: e.target.value }))} /></label>
          </div>
        ) : null}

        {step === 'cargo' ? (
          <div className="logistics-wizard__section">
            <label>{t('fields.cargo')}<textarea required value={form.cargoDescription} onChange={(e) => setForm((f) => ({ ...f, cargoDescription: e.target.value }))} /></label>
            <label>{t('fields.commodity')}<input value={form.commodity} onChange={(e) => setForm((f) => ({ ...f, commodity: e.target.value }))} /></label>
            <label>{t('fields.weight')}<input type="number" value={form.weightKg} onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))} /></label>
            <label>{t('fields.cbm')}<input type="number" value={form.volumeCbm} onChange={(e) => setForm((f) => ({ ...f, volumeCbm: e.target.value }))} /></label>
          </div>
        ) : null}

        {step === 'equipment' ? (
          <div className="logistics-wizard__section">
            <label>{t('fields.serviceType')}
              <select value={form.serviceType} onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}>
                {SEA_SERVICES.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            </label>
            <label>{t('fields.containerType')}
              <select value={form.containerType} onChange={(e) => setForm((f) => ({ ...f, containerType: e.target.value }))}>
                <option value="20GP">20GP</option>
                <option value="40GP">40GP</option>
                <option value="40HC">40HC</option>
              </select>
            </label>
            <label>{t('fields.containerQty')}<input type="number" min={1} value={form.containerQuantity} onChange={(e) => setForm((f) => ({ ...f, containerQuantity: e.target.value }))} /></label>
          </div>
        ) : null}

        {step === 'sailing' ? (
          <div className="logistics-wizard__section">
            <p className="muted-text">{t('sailingHint')}</p>
            <button type="button" className="portal-button portal-button--ghost" onClick={() => void loadSchedules()}>{t('loadSchedules')}</button>
            <label>{t('fields.preferredCarrier')}<input value={form.preferredCarrier} onChange={(e) => setForm((f) => ({ ...f, preferredCarrier: e.target.value }))} placeholder={t('preferredCarrierPlaceholder')} /></label>
            {schedulesLoaded && schedules.length === 0 ? <p className="muted-text">{t('noSchedules')}</p> : null}
            {schedules.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('comparison.carrier')}</th>
                      <th>{t('comparison.vessel')}</th>
                      <th>{t('comparison.etd')}</th>
                      <th>{t('comparison.eta')}</th>
                      <th>{t('comparison.transit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((row, index) => (
                      <tr key={`${row.voyage}-${index}`}>
                        <td>{row.carrierName}</td>
                        <td>{row.vesselName} / {row.voyage}</td>
                        <td>{row.etd}</td>
                        <td>{row.eta}</td>
                        <td>{row.transitDays ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 'documents' ? (
          <div className="logistics-wizard__section">
            <label><input type="checkbox" checked={form.customsClearanceRequired} onChange={(e) => setForm((f) => ({ ...f, customsClearanceRequired: e.target.checked }))} /> {t('fields.customsRequired')}</label>
            <label><input type="checkbox" checked={form.insuranceRequired} onChange={(e) => setForm((f) => ({ ...f, insuranceRequired: e.target.checked }))} /> {t('fields.insuranceRequired')}</label>
            <label>{t('fields.documentNotes')}<textarea value={form.documentNotes} onChange={(e) => setForm((f) => ({ ...f, documentNotes: e.target.value }))} /></label>
            <label>{t('fields.specialInstructions')}<textarea value={form.specialInstructions} onChange={(e) => setForm((f) => ({ ...f, specialInstructions: e.target.value }))} /></label>
          </div>
        ) : null}

        {step === 'review' ? (
          <div className="logistics-wizard__review">
            <p><strong>{form.origin}</strong> → <strong>{form.destination}</strong></p>
            <p>{form.containerType} × {form.containerQuantity} · {form.serviceType.toUpperCase()}</p>
            <p className="muted-text">{t('reviewQuoteNote')}</p>
          </div>
        ) : null}

        <div className="logistics-wizard__nav">
          {stepIndex > 0 ? (
            <button type="button" className="portal-button portal-button--ghost" onClick={() => setStep(STEPS[stepIndex - 1]!)}>{t('back')}</button>
          ) : null}
          {step !== 'review' ? (
            <button
              type="button"
              className="portal-button portal-button--primary"
              onClick={() => {
                if (step === 'sailing' && !schedulesLoaded) void loadSchedules();
                setStep(STEPS[stepIndex + 1]!);
              }}
            >
              {t('next')}
            </button>
          ) : (
            <button type="button" className="portal-button portal-button--primary" disabled={saving} onClick={() => void publish()}>{t('submit')}</button>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
