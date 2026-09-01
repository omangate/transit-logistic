'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AdminShell } from '@/components/admin/admin-shell';
import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { Link } from '@/i18n/navigation';
import {
  approveCargoLineHs,
  buildCustomsDeclarationDraft,
  confirmDeclarationField,
  downloadPreparationSheetPdf,
  getCustomsBayanView,
  getCustomsDeclarationDraft,
  markCustomsBayanReady,
  recordBayanSubmission,
  saveConsignee,
  searchSavedConsignees,
  updateCustomsDeclarationDraft,
  uploadCustomsDocumentsAndExtract,
  type BayanViewResponse,
  type DeclarationDraftResponse,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';

const DOCUMENT_CATEGORIES = [
  'commercial_invoice',
  'packing_list',
  'bill_of_lading',
  'air_waybill',
  'certificate_of_origin',
  'delivery_order',
  'customs_declaration',
  'import_permit',
  'export_permit',
  'insurance',
  'noc',
  'vehicle_document',
  'other',
] as const;

const OMAN_CUSTOMS_PORTS = [
  { value: 'Sohar', labelEn: 'Sohar Port', labelAr: 'ميناء صحار' },
  { value: 'Salalah', labelEn: 'Salalah Port', labelAr: 'ميناء صلالة' },
  { value: 'Muscat', labelEn: 'Port of Muscat', labelAr: 'ميناء مسقط' },
  { value: 'Khasab', labelEn: 'Khasab Port', labelAr: 'ميناء خصب' },
  { value: 'Duqm', labelEn: 'Duqm Port', labelAr: 'ميناء الدقم' },
  { value: 'Mina Al Fahal', labelEn: 'Mina Al Fahal', labelAr: 'ميناء الفحل' },
];

type Step = 'upload' | 'review' | 'hs' | 'bayan';

function copyText(value: string) {
  void navigator.clipboard.writeText(value);
}

function reviewBadge(status: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    CONFIRMED_FROM_DOCUMENT: t('customsPrep.review.confirmed'),
    NEEDS_REVIEW: t('customsPrep.review.needsReview'),
    MISSING: t('customsPrep.review.missing'),
    MANUALLY_OVERRIDDEN: t('customsPrep.review.manual'),
  };
  return map[status] ?? status;
}

export function CustomsDeclarationPrepContent({ requestId }: { requestId: string }) {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireAdminAuth();
  const [step, setStep] = useState<Step>('upload');
  const [draft, setDraft] = useState<DeclarationDraftResponse | null>(null);
  const [bayanView, setBayanView] = useState<BayanViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<Array<{ file: File; category: string }>>([]);
  const [entryPort, setEntryPort] = useState('');
  const [consignee, setConsignee] = useState('');
  const [consigneeSuggestions, setConsigneeSuggestions] = useState<Array<{ id: string; companyName: string; crNumber?: string | null }>>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [bayanNumber, setBayanNumber] = useState('');
  const [bayanDate, setBayanDate] = useState('');
  const [dutyAmount, setDutyAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [releaseStatus, setReleaseStatus] = useState('');
  const [bayanNotes, setBayanNotes] = useState('');
  const [bayanRecorded, setBayanRecorded] = useState(false);

  const reload = useCallback(async () => {
    const data = await getCustomsDeclarationDraft(requestId);
    setDraft(data);
    setEntryPort(data.request.customsEntryExitPort ?? '');
    setConsignee(data.request.consigneeName ?? data.merged['parties.consignee'] ?? '');
    setBayanNumber(data.request.bayanDeclarationNumber ?? '');
    setBayanDate(data.request.bayanDeclarationDate?.slice(0, 10) ?? '');
    setDutyAmount(data.request.customsDutyAmount?.toString() ?? '');
    setPaymentStatus(data.request.customsPaymentStatus ?? '');
    setReleaseStatus(data.request.customsReleaseStatus ?? '');
    setBayanNotes(data.request.bayanNotes ?? '');
    setBayanRecorded(Boolean(data.request.bayanDeclarationNumber));
    if (data.request.declarationPrepStatus === 'bayan_ready') {
      setBayanView(await getCustomsBayanView(requestId));
      setStep('bayan');
    } else if (data.request.declarationPrepStatus === 'hs_review' || data.request.declarationPrepStatus === 'validated') {
      setStep('hs');
    } else if (data.documents.length > 0) {
      setStep('review');
    }
  }, [requestId]);

  useEffect(() => {
    if (!isReady || !user) return;
    reload().catch((err) => setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic')));
  }, [isReady, locale, reload, t, user]);

  const missingCount = draft?.missingFields.filter((f) => f.required).length ?? 0;

  const groupedFields = useMemo(() => {
    if (!draft) return {};
    return draft.fields.reduce<Record<string, typeof draft.fields>>((acc, field) => {
      const group = acc[field.fieldGroup] ?? [];
      group.push(field);
      acc[field.fieldGroup] = group;
      return acc;
    }, {});
  }, [draft]);

  const onUpload = async () => {
    if (uploadQueue.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await uploadCustomsDocumentsAndExtract(requestId, uploadQueue);
      setDraft(result);
      setUploadQueue([]);
      await buildCustomsDeclarationDraft(requestId).then(setDraft);
      setStep('review');
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const saveManualFields = async () => {
    setBusy(true);
    try {
      const updated = await updateCustomsDeclarationDraft(requestId, {
        customsEntryExitPort: entryPort,
        consigneeName: consignee,
        consigneeConfirmed: true,
      });
      setDraft(updated);
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const onConsigneeInput = async (value: string) => {
    setConsignee(value);
    if (value.length < 2) {
      setConsigneeSuggestions([]);
      return;
    }
    const results = await searchSavedConsignees(value);
    setConsigneeSuggestions(results);
  };

  const onMarkBayanReady = async () => {
    setBusy(true);
    try {
      await saveManualFields();
      const result = await markCustomsBayanReady(requestId);
      if (result.valid && result.bayanView) {
        setBayanView(result.bayanView);
        setStep('bayan');
      } else {
        setError(t('customsPrep.validationBlocked'));
      }
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = (key: string, value: string) => {
    copyText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleCopyAll = () => {
    if (!bayanView?.summaryText) return;
    handleCopy('summary', bayanView.summaryText);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setBusy(true);
    try {
      const blob = await downloadPreparationSheetPdf(requestId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customs-prep-${requestId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const onRecordBayan = async () => {
    if (!bayanNumber.trim()) return;
    setBusy(true);
    try {
      await recordBayanSubmission(requestId, {
        bayanDeclarationNumber: bayanNumber.trim(),
        bayanDeclarationDate: bayanDate || undefined,
        customsDutyAmount: dutyAmount ? Number(dutyAmount) : undefined,
        customsPaymentStatus: paymentStatus || undefined,
        customsReleaseStatus: releaseStatus || undefined,
        bayanNotes: bayanNotes || undefined,
      });
      setBayanRecorded(true);
      await reload();
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const formatDiscrepancy = (d: { fieldKey: string; values: unknown }) => {
    const values = d.values as Record<string, { value?: string; source?: string }> | Array<{ value?: string; source?: string }>;
    const rows = Array.isArray(values) ? values : Object.values(values);
    return rows.map((v) => `${v.source ?? 'document'}: ${v.value ?? '—'}`).join(' · ');
  };

  if (!isReady || !user) return <LoadingState message={t('loading')} />;

  return (
    <AdminShell
      user={user}
      title={t('customsPrep.title')}
      subtitle={draft?.request.referenceNumber ?? requestId}
      action={
        <Link href="/admin/logistics" className="rental-btn rental-btn--ghost">
          {t('customsPrep.backToLogistics')}
        </Link>
      }
    >
      {error ? <FormError message={error} /> : null}

      <div className="customs-prep__steps">
        {(['upload', 'review', 'hs', 'bayan'] as Step[]).map((s) => (
          <span key={s} className={step === s ? 'customs-prep__step--active' : ''}>
            {t(`customsPrep.steps.${s}` as never)}
          </span>
        ))}
      </div>

      {step === 'upload' ? (
        <section className="customs-prep__panel">
          <h2>{t('customsPrep.uploadTitle')}</h2>
          <p>{t('customsPrep.uploadHint')}</p>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setUploadQueue(files.map((file) => ({ file, category: 'commercial_invoice' })));
            }}
          />
          {uploadQueue.length > 0 ? (
            <div className="customs-prep__upload-list">
              {uploadQueue.map((item, index) => (
                <div key={`${item.file.name}-${index}`} className="customs-prep__upload-row">
                  <span>{item.file.name}</span>
                  <select
                    value={item.category}
                    onChange={(e) =>
                      setUploadQueue((rows) =>
                        rows.map((row, i) => (i === index ? { ...row, category: e.target.value } : row)),
                      )
                    }
                  >
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {t(`documents.categories.${cat}` as never)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ) : null}
          <button type="button" className="rental-btn" disabled={busy || uploadQueue.length === 0} onClick={() => void onUpload()}>
            {busy ? t('loading') : t('customsPrep.uploadAndExtract')}
          </button>
        </section>
      ) : null}

      {(step === 'review' || step === 'hs') && draft ? (
        <>
          <section className="customs-prep__missing-panel">
            <h2>{t('customsPrep.missingTitle', { count: missingCount })}</h2>
            {missingCount === 0 ? (
              <p>{t('customsPrep.noMissingFields')}</p>
            ) : (
              <div className="customs-prep__missing-fields">
                {draft.missingFields
                  .filter((f) => f.required)
                  .map((field) => (
                    <div key={field.key}>
                      {field.key === 'customs.entryExitPort' ? (
                        <label>
                          {locale === 'ar' ? field.labelAr : field.label}
                          <select value={entryPort} onChange={(e) => setEntryPort(e.target.value)}>
                            <option value="">{t('customsPrep.selectPort')}</option>
                            {OMAN_CUSTOMS_PORTS.map((port) => (
                              <option key={port.value} value={port.value}>
                                {locale === 'ar' ? port.labelAr : port.labelEn}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {field.key === 'parties.consignee' ? (
                        <label>
                          {locale === 'ar' ? field.labelAr : field.label}
                          <input
                            value={consignee}
                            onChange={(e) => void onConsigneeInput(e.target.value)}
                            list="consignee-suggestions"
                          />
                          <datalist id="consignee-suggestions">
                            {consigneeSuggestions.map((c) => (
                              <option key={c.id} value={c.companyName}>
                                {c.crNumber ? `CR: ${c.crNumber}` : c.companyName}
                              </option>
                            ))}
                          </datalist>
                          <button
                            type="button"
                            className="rental-btn rental-btn--ghost"
                            onClick={() =>
                              void saveConsignee({ companyName: consignee }).then(() =>
                                setError(null),
                              )
                            }
                          >
                            {t('customsPrep.saveConsignee')}
                          </button>
                        </label>
                      ) : null}
                    </div>
                  ))}
              </div>
            )}
            <button type="button" className="rental-btn rental-btn--ghost" disabled={busy} onClick={() => void saveManualFields()}>
              {t('customsPrep.saveManualFields')}
            </button>
          </section>

          {draft.discrepancies.length > 0 ? (
            <section className="customs-prep__discrepancies">
              <h3>{t('customsPrep.discrepanciesTitle')}</h3>
              {draft.discrepancies.map((d) => (
                <div key={d.id} className="customs-prep__discrepancy">
                  <strong>{d.fieldKey}</strong>
                  <p>{formatDiscrepancy(d)}</p>
                </div>
              ))}
            </section>
          ) : null}

          <section className="customs-prep__extracted">
            <h2>{t('customsPrep.extractedTitle')}</h2>
            {Object.entries(groupedFields).map(([group, fields]) => (
              <div key={group} className="customs-prep__group">
                <h3>{t(`customsPrep.groups.${group}` as never)}</h3>
                <div className="customs-prep__field-grid">
                  {fields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      className={`customs-prep__field customs-prep__field--${field.reviewStatus.toLowerCase()}`}
                      onClick={() =>
                        void confirmDeclarationField(field.id, { reviewStatus: 'CONFIRMED_FROM_DOCUMENT' }).then(reload)
                      }
                      title={t('customsPrep.clickToConfirm')}
                    >
                      <span className="customs-prep__field-key">{field.fieldKey}</span>
                      <strong>{field.displayValue ?? '—'}</strong>
                      <small>
                        {reviewBadge(field.reviewStatus, t)}
                        {field.sourceDocument
                          ? ` · ${field.sourceDocument.category}${field.sourcePage ? ` p.${field.sourcePage}` : ''}`
                          : ''}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="customs-prep__hs">
            <h2>{t('customsPrep.hsTitle')}</h2>
            <p>{t('customsPrep.hsHint')}</p>
            {draft.hsSuggestions.map((line) => (
              <div key={line.cargoLineId} className="customs-prep__hs-line">
                <h4>{line.description}</h4>
                {line.suggestions.map((s) => (
                  <div key={s.id} className="customs-prep__hs-suggestion">
                    <div>
                      <strong>{s.hsCode}</strong> — {locale === 'ar' ? s.descriptionAr : s.descriptionEn}
                      {s.dutyRate ? ` · ${s.dutyRate}` : ''}
                      {s.permitRequired ? ` · ${t('customsPrep.permitRequired')}` : ''}
                    </div>
                    <button
                      type="button"
                      className="rental-btn rental-btn--ghost"
                      onClick={() =>
                        void approveCargoLineHs(line.cargoLineId, s.hsCode).then(reload)
                      }
                    >
                      {t('customsPrep.approveHs')}
                    </button>
                  </div>
                ))}
                {line.approvedHsCode ? (
                  <p className="customs-prep__approved-hs">
                    {t('customsPrep.approvedHs')}: {line.approvedHsCode}
                  </p>
                ) : null}
              </div>
            ))}
          </section>

          <div className="customs-prep__actions">
            <button type="button" className="rental-btn" disabled={busy} onClick={() => setStep('hs')}>
              {t('customsPrep.continueHsReview')}
            </button>
            <button type="button" className="rental-btn rental-btn--primary" disabled={busy} onClick={() => void onMarkBayanReady()}>
              {t('customsPrep.markBayanReady')}
            </button>
          </div>
        </>
      ) : null}

      {step === 'bayan' && bayanView ? (
        <section className="customs-prep__bayan customs-prep__bayan--printable">
          <div className="customs-prep__bayan-toolbar">
            <h2>{t('customsPrep.bayanTitle')}</h2>
            <div className="customs-prep__actions">
              {bayanView.summaryText ? (
                <button type="button" className="rental-btn rental-btn--ghost" onClick={handleCopyAll}>
                  {copiedKey === 'summary' ? t('customsPrep.copied') : t('customsPrep.copyAll')}
                </button>
              ) : null}
              <button type="button" className="rental-btn rental-btn--ghost" onClick={handlePrint}>
                {t('customsPrep.printSheet')}
              </button>
              <button type="button" className="rental-btn rental-btn--ghost" disabled={busy} onClick={() => void handleDownloadPdf()}>
                {t('customsPrep.downloadPdf')}
              </button>
            </div>
          </div>
          <p>{t('customsPrep.bayanHint')}</p>
          {bayanView.sections.map((section) => (
            <div key={section.id} className="customs-prep__bayan-section">
              <h3>{section.title}</h3>
              {section.fields?.map((field) => (
                <div key={field.copyKey} className="customs-prep__bayan-field">
                  <label>{field.label}</label>
                  <div className="customs-prep__bayan-value">{field.value || '—'}</div>
                  {field.reviewStatus ? (
                    <small className="customs-prep__bayan-status">{reviewBadge(field.reviewStatus, t)}</small>
                  ) : null}
                  {field.value ? (
                    <button type="button" className="rental-btn rental-btn--ghost" onClick={() => handleCopy(field.copyKey, field.value)}>
                      {copiedKey === field.copyKey ? t('customsPrep.copied') : t('customsPrep.copy')}
                    </button>
                  ) : null}
                </div>
              ))}
              {section.containers?.map((field) => (
                <div key={field.copyKey} className="customs-prep__bayan-field">
                  <label>{field.label}</label>
                  <div className="customs-prep__bayan-value">{field.value || '—'}</div>
                  {field.value ? (
                    <button type="button" className="rental-btn rental-btn--ghost" onClick={() => handleCopy(field.copyKey, field.value)}>
                      {copiedKey === field.copyKey ? t('customsPrep.copied') : t('customsPrep.copy')}
                    </button>
                  ) : null}
                </div>
              ))}
              {section.seals?.map((field) => (
                <div key={field.copyKey} className="customs-prep__bayan-field">
                  <label>{field.label}</label>
                  <div className="customs-prep__bayan-value">{field.value || '—'}</div>
                  {field.value ? (
                    <button type="button" className="rental-btn rental-btn--ghost" onClick={() => handleCopy(field.copyKey, field.value)}>
                      {copiedKey === field.copyKey ? t('customsPrep.copied') : t('customsPrep.copy')}
                    </button>
                  ) : null}
                </div>
              ))}
              {section.lines?.map((line) => (
                <div key={line.lineNumber} className="customs-prep__bayan-line">
                  <h4>{t('customsPrep.copyLine', { n: line.lineNumber })}</h4>
                  {line.fields.map((field) => (
                    <div key={field.copyKey} className="customs-prep__bayan-field">
                      <label>{field.label}</label>
                      <div className="customs-prep__bayan-value">{field.value || '—'}</div>
                      {field.value ? (
                        <button type="button" className="rental-btn rental-btn--ghost" onClick={() => handleCopy(field.copyKey, field.value)}>
                          {copiedKey === field.copyKey ? t('customsPrep.copied') : t('customsPrep.copy')}
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="rental-btn rental-btn--ghost"
                    onClick={() =>
                      handleCopy(
                        `line${line.lineNumber}`,
                        line.fields.map((f) => `${f.label}: ${f.value}`).join('\n'),
                      )
                    }
                  >
                    {t('customsPrep.copyLine', { n: line.lineNumber })}
                  </button>
                </div>
              ))}
            </div>
          ))}

          <section className="customs-prep__bayan-record">
            <h3>{t('customsPrep.recordBayan')}</h3>
            {bayanRecorded ? <p>{t('customsPrep.bayanRecorded', { number: bayanNumber })}</p> : null}
            <div className="customs-prep__missing-fields">
              <label>
                {t('customsPrep.bayanNumber')}
                <input value={bayanNumber} onChange={(e) => setBayanNumber(e.target.value)} />
              </label>
              <label>
                {t('customsPrep.bayanDate')}
                <input type="date" value={bayanDate} onChange={(e) => setBayanDate(e.target.value)} />
              </label>
              <label>
                {t('customsPrep.dutyAmount')}
                <input type="number" step="0.001" value={dutyAmount} onChange={(e) => setDutyAmount(e.target.value)} />
              </label>
              <label>
                {t('customsPrep.paymentStatus')}
                <input value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} />
              </label>
              <label>
                {t('customsPrep.releaseStatus')}
                <input value={releaseStatus} onChange={(e) => setReleaseStatus(e.target.value)} />
              </label>
              <label>
                {t('customsPrep.bayanNotes')}
                <textarea value={bayanNotes} onChange={(e) => setBayanNotes(e.target.value)} rows={3} />
              </label>
            </div>
            <button type="button" className="rental-btn" disabled={busy || !bayanNumber.trim()} onClick={() => void onRecordBayan()}>
              {t('customsPrep.saveBayanRecord')}
            </button>
          </section>
        </section>
      ) : null}
    </AdminShell>
  );
}
