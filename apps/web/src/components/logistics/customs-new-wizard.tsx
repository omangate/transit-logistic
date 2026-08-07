'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link, useRouter } from '@/i18n/navigation';
import {
  createCustomsRequest,
  submitCustomsRequest,
  updateCustomsRequest,
  uploadLogisticsDocument,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';

const TRANSACTION_TYPES = [
  'import',
  'export',
  'transit',
  're_export',
  'temporary_import',
  'temporary_export',
  'free_zone',
] as const;

const STEPS = ['type', 'shipment', 'cargo', 'documents', 'review'] as const;

export function CustomsNewWizard() {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireAuth();
  const router = useRouter();
  const [step, setStep] = useState<(typeof STEPS)[number]>('type');
  const [requestId, setRequestId] = useState<string>();
  const [transactionType, setTransactionType] = useState<string>('import');
  const [form, setForm] = useState<Record<string, string>>({});
  const [cargoLines, setCargoLines] = useState([{ description: '', hsCode: '', grossWeightKg: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const ensureRequest = async () => {
    if (requestId) return requestId;
    const created = await createCustomsRequest({ transactionType });
    setRequestId(created.id);
    return created.id;
  };

  const next = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = await ensureRequest();
      if (step === 'shipment' || step === 'cargo') {
        await updateCustomsRequest(id, {
          ...form,
          eta: form.eta || undefined,
          etd: form.etd || undefined,
          cargoLines: cargoLines.filter((l) => l.description).map((l) => ({
            description: l.description,
            hsCode: l.hsCode || undefined,
            grossWeightKg: l.grossWeightKg ? Number(l.grossWeightKg) : undefined,
          })),
        });
      }
      const nextStep = STEPS[stepIndex + 1];
      if (nextStep) setStep(nextStep);
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!requestId) return;
    setSaving(true);
    try {
      await submitCustomsRequest(requestId);
      router.push(`/customs/requests/${requestId}`);
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <PortalShell user={user} title={t('customs.newRequest')} subtitle={t('customs.title')}>
    <div className="logistics-wizard">
      <div className="logistics-wizard__progress">
        {STEPS.map((s, i) => (
          <span key={s} className={i <= stepIndex ? 'logistics-wizard__step--active' : ''}>
            {t(`customs.steps.${s}` as never)}
          </span>
        ))}
      </div>

      {error ? <FormError message={error} /> : null}

      {step === 'type' ? (
        <div className="logistics-wizard__grid">
          {TRANSACTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`logistics-type-card${transactionType === type ? ' logistics-type-card--active' : ''}`}
              onClick={() => setTransactionType(type)}
            >
              {t(`customs.transactionTypes.${type}` as never)}
            </button>
          ))}
        </div>
      ) : null}

      {step === 'shipment' ? (
        <div className="logistics-wizard__section">
          <label>{t('customs.fields.shipmentReference')}<input value={form.shipmentReference ?? ''} onChange={(e) => setForm((f) => ({ ...f, shipmentReference: e.target.value }))} /></label>
          <label>{t('customs.fields.blNumber')}<input value={form.billOfLadingNumber ?? ''} onChange={(e) => setForm((f) => ({ ...f, billOfLadingNumber: e.target.value }))} /></label>
          <label>{t('customs.fields.shippingLine')}<input value={form.shippingLine ?? ''} onChange={(e) => setForm((f) => ({ ...f, shippingLine: e.target.value }))} /></label>
          <label>{t('customs.fields.portOfLoading')}<input value={form.portOfLoading ?? ''} onChange={(e) => setForm((f) => ({ ...f, portOfLoading: e.target.value }))} /></label>
          <label>{t('customs.fields.portOfDischarge')}<input value={form.portOfDischarge ?? ''} onChange={(e) => setForm((f) => ({ ...f, portOfDischarge: e.target.value }))} /></label>
          <label>{t('customs.fields.finalDestination')}<input value={form.finalDestination ?? ''} onChange={(e) => setForm((f) => ({ ...f, finalDestination: e.target.value }))} /></label>
        </div>
      ) : null}

      {step === 'cargo' ? (
        <div className="logistics-wizard__section">
          {cargoLines.map((line, index) => (
            <div key={index} className="logistics-cargo-line">
              <label>{t('customs.fields.cargoDescription')}<input value={line.description} onChange={(e) => setCargoLines((lines) => lines.map((l, i) => (i === index ? { ...l, description: e.target.value } : l)))} /></label>
              <label>{t('customs.fields.hsCode')}<input value={line.hsCode} onChange={(e) => setCargoLines((lines) => lines.map((l, i) => (i === index ? { ...l, hsCode: e.target.value } : l)))} /></label>
              <label>{t('customs.fields.grossWeight')}<input type="number" value={line.grossWeightKg} onChange={(e) => setCargoLines((lines) => lines.map((l, i) => (i === index ? { ...l, grossWeightKg: e.target.value } : l)))} /></label>
            </div>
          ))}
          <button type="button" className="rental-btn rental-btn--ghost" onClick={() => setCargoLines((l) => [...l, { description: '', hsCode: '', grossWeightKg: '' }])}>
            {t('customs.addCargoLine')}
          </button>
        </div>
      ) : null}

      {step === 'documents' && requestId ? (
        <div className="logistics-wizard__section">
          <p>{t('customs.documentsHint')}</p>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void uploadLogisticsDocument(file, { category: 'commercial_invoice', customsRequestId: requestId });
            }}
          />
        </div>
      ) : null}

      {step === 'review' ? (
        <div className="logistics-wizard__review">
          <p>{t('customs.reviewHint')}</p>
          <Link href={requestId ? `/customs/requests/${requestId}` : '#'}>{t('customs.viewDraft')}</Link>
        </div>
      ) : null}

      <div className="logistics-wizard__nav">
        {stepIndex > 0 ? (
          <button type="button" className="rental-btn rental-btn--ghost" onClick={() => setStep(STEPS[stepIndex - 1]!)}>
            {t('wizard.back')}
          </button>
        ) : null}
        {step !== 'review' ? (
          <button type="button" className="rental-btn rental-btn--primary" disabled={saving} onClick={() => void next()}>
            {t('wizard.next')}
          </button>
        ) : (
          <button type="button" className="rental-btn rental-btn--primary" disabled={saving} onClick={() => void publish()}>
            {t('customs.submit')}
          </button>
        )}
      </div>
    </div>
    </PortalShell>
  );
}
