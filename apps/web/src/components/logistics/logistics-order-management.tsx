'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import {
  archiveLogisticsContainer,
  commitVehicleImport,
  createLogisticsCharge,
  createLogisticsContainer,
  createLogisticsVehicle,
  deleteLogisticsVehicle,
  downloadLogisticsCostStatementPdf,
  downloadLogisticsInvoicePdf,
  downloadLogisticsSummaryPdf,
  getLogisticsChargeTotals,
  listLogisticsCharges,
  listLogisticsContainers,
  listLogisticsVehicles,
  openLogisticsPdfBlob,
  previewVehicleImport,
  updateLogisticsCharge,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { ChargeTotals, ContainerRecord, LogisticsCharge, VehicleImportPreviewRow, VehicleShipmentRecord } from '@/types/logistics';

const CHARGE_CATEGORIES = [
  'freight', 'customs_clearance', 'customs_duty', 'port_charges', 'terminal_handling',
  'storage', 'demurrage', 'detention', 'transportation', 'inspection', 'documentation', 'insurance', 'other',
] as const;

type Props = {
  orderId: string;
  isAdmin?: boolean;
  initialContainers?: ContainerRecord[];
  initialVehicles?: VehicleShipmentRecord[];
  initialCharges?: LogisticsCharge[];
};

export function LogisticsOrderManagement({ orderId, isAdmin, initialContainers, initialVehicles, initialCharges }: Props) {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const [containers, setContainers] = useState(initialContainers ?? []);
  const [vehicles, setVehicles] = useState(initialVehicles ?? []);
  const [charges, setCharges] = useState(initialCharges ?? []);
  const [totals, setTotals] = useState<ChargeTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<VehicleImportPreviewRow[] | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  const reload = useCallback(async () => {
    try {
      const [c, v, ch, tot] = await Promise.all([
        listLogisticsContainers({ logisticsOrderId: orderId }),
        listLogisticsVehicles({ logisticsOrderId: orderId }),
        listLogisticsCharges(orderId),
        getLogisticsChargeTotals(orderId),
      ]);
      setContainers(c);
      setVehicles(v);
      setCharges(ch);
      setTotals(tot);
      setError(null);
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    }
  }, [locale, orderId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleContainerCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createLogisticsContainer({
      logisticsOrderId: orderId,
      containerNumber: form.get('containerNumber'),
      size: form.get('size') || undefined,
      containerType: form.get('containerType') || undefined,
      sealNumber: form.get('sealNumber') || undefined,
      currentStatus: 'booked',
    });
    e.currentTarget.reset();
    await reload();
  }

  async function handleVehicleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createLogisticsVehicle({
      logisticsOrderId: orderId,
      vin: form.get('vin') || undefined,
      chassisNumber: form.get('chassisNumber') || undefined,
      make: form.get('make') || undefined,
      model: form.get('model') || undefined,
      year: form.get('year') ? Number(form.get('year')) : undefined,
      color: form.get('color') || undefined,
    });
    e.currentTarget.reset();
    await reload();
  }

  async function handleChargeCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) return;
    const form = new FormData(e.currentTarget);
    await createLogisticsCharge({
      logisticsOrderId: orderId,
      category: form.get('category'),
      description: form.get('description'),
      amount: Number(form.get('amount')),
      currency: 'OMR',
      quantity: Number(form.get('quantity') || 1),
      tax: Number(form.get('tax') || 0),
      paymentStatus: form.get('paymentStatus') || 'unpaid',
      isCustomerVisible: form.get('isCustomerVisible') === 'on',
    });
    e.currentTarget.reset();
    await reload();
  }

  async function handleImportPreview(file: File) {
    setImportFile(file);
    const preview = await previewVehicleImport(orderId, file);
    setImportPreview(preview);
  }

  async function handleImportCommit() {
    if (!importFile) return;
    const result = await commitVehicleImport(orderId, importFile);
    setImportPreview(null);
    setImportFile(null);
    if (result.failed.length) {
      setError(t('vehicles.importErrors', { count: result.failed.length }));
    }
    await reload();
  }

  function exportChargesCsv() {
    const header = 'category,description,amount,currency,quantity,tax,paymentStatus\n';
    const rows = charges.map((c) =>
      `${c.category},${c.description},${c.amount},${c.currency},${c.quantity ?? 1},${c.tax ?? 0},${c.paymentStatus}`,
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    openLogisticsPdfBlob(blob, 'charges.csv');
  }

  return (
    <>
      {error ? <FormError message={error} /> : null}

      <section className="logistics-panel">
        <header className="logistics-page__header">
          <h2>{t('reports.title')}</h2>
          <div className="logistics-hero__actions">
            <button type="button" className="rental-btn rental-btn--ghost" onClick={() => void downloadLogisticsSummaryPdf(orderId).then((b) => openLogisticsPdfBlob(b, 'summary.pdf'))}>
              {t('reports.summary')}
            </button>
            <button type="button" className="rental-btn rental-btn--ghost" onClick={() => void downloadLogisticsInvoicePdf(orderId).then((b) => openLogisticsPdfBlob(b, 'invoice.pdf'))}>
              {t('reports.invoice')}
            </button>
            <button type="button" className="rental-btn rental-btn--ghost" onClick={() => void downloadLogisticsCostStatementPdf(orderId).then((b) => openLogisticsPdfBlob(b, 'cost-statement.pdf'))}>
              {t('reports.costStatement')}
            </button>
          </div>
        </header>
      </section>

      <section className="logistics-panel">
        <h2>{t('containers.title')}</h2>
        {isAdmin ? (
          <form className="logistics-form logistics-form--inline" onSubmit={(e) => void handleContainerCreate(e)}>
            <input name="containerNumber" placeholder={t('containers.number')} required />
            <input name="size" placeholder={t('containers.size')} />
            <input name="containerType" placeholder={t('containers.type')} />
            <input name="sealNumber" placeholder={t('containers.seal')} />
            <button type="submit" className="rental-btn rental-btn--primary">{t('containers.add')}</button>
          </form>
        ) : null}
        <div className="logistics-table">
          {containers.length ? containers.map((item) => (
            <div key={item.id} className="logistics-table__row logistics-table__row--admin">
              <strong>{item.containerNumber}</strong>
              <span>{item.currentLocation ?? '—'}</span>
              <span>{item.size ?? '—'}</span>
              <span className="logistics-badge">{item.currentStatus.replace(/_/g, ' ')}</span>
              {isAdmin ? (
                <button type="button" className="rental-btn rental-btn--ghost" onClick={() => void archiveLogisticsContainer(item.id).then(reload)}>
                  {t('containers.archive')}
                </button>
              ) : null}
            </div>
          )) : <p className="logistics-empty">{t('containers.empty')}</p>}
        </div>
      </section>

      <section className="logistics-panel">
        <h2>{t('vehicles.title')}</h2>
        {isAdmin ? (
          <>
            <form className="logistics-form logistics-form--inline" onSubmit={(e) => void handleVehicleCreate(e)}>
              <input name="vin" placeholder={t('vehicles.vin')} />
              <input name="chassisNumber" placeholder={t('vehicles.chassis')} />
              <input name="make" placeholder={t('vehicles.make')} />
              <input name="model" placeholder={t('vehicles.model')} />
              <input name="year" placeholder={t('vehicles.year')} type="number" />
              <button type="submit" className="rental-btn rental-btn--primary">{t('vehicles.add')}</button>
            </form>
            <div className="logistics-form">
              <label className="logistics-form__label">{t('vehicles.importFile')}</label>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportPreview(file).catch((err) => setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic')));
              }} />
              {importPreview ? (
                <>
                  <p>{t('vehicles.importPreview', { valid: importPreview.filter((r) => r.valid).length, total: importPreview.length })}</p>
                  <div className="logistics-table">
                    {importPreview.map((row) => (
                      <div key={row.row} className={`logistics-table__row${row.valid ? '' : ' logistics-table__row--error'}`}>
                        <span>#{row.row}</span>
                        <span>{row.data.vin ?? row.data.VIN ?? row.data.chassisNumber ?? '—'}</span>
                        <span>{row.errors.join(', ') || t('vehicles.valid')}</span>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="rental-btn rental-btn--primary" onClick={() => void handleImportCommit()}>
                    {t('vehicles.importCommit')}
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : null}
        <div className="logistics-table">
          {vehicles.length ? vehicles.map((item) => (
            <div key={item.id} className="logistics-table__row logistics-table__row--admin">
              <strong>{item.vin ?? item.chassisNumber ?? '—'}</strong>
              <span>{[item.make, item.model, item.year].filter(Boolean).join(' ')}</span>
              <span className="logistics-badge">{item.customsStatus?.replace(/_/g, ' ') ?? '—'}</span>
              {isAdmin ? (
                <button type="button" className="rental-btn rental-btn--ghost" onClick={() => void deleteLogisticsVehicle(item.id).then(reload)}>
                  {t('vehicles.remove')}
                </button>
              ) : null}
            </div>
          )) : <p className="logistics-empty">{t('vehicles.empty')}</p>}
        </div>
      </section>

      <section className="logistics-panel">
        <header className="logistics-page__header">
          <h2>{t('charges.title')}</h2>
          <div className="logistics-hero__actions">
            <button type="button" className="rental-btn rental-btn--ghost" onClick={exportChargesCsv}>{t('charges.exportCsv')}</button>
            {totals ? (
              <span className="logistics-badge logistics-badge--lg">
                {t('charges.total')}: {totals.total.toFixed(3)} {totals.currency}
              </span>
            ) : null}
          </div>
        </header>
        {isAdmin ? (
          <form className="logistics-form" onSubmit={(e) => void handleChargeCreate(e)}>
            <select name="category" required defaultValue="freight">
              {CHARGE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{t(`charges.categories.${cat}` as never)}</option>
              ))}
            </select>
            <input name="description" placeholder={t('charges.description')} required />
            <input name="amount" placeholder={t('charges.amount')} type="number" step="0.001" required />
            <input name="quantity" placeholder={t('charges.quantity')} type="number" defaultValue={1} />
            <input name="tax" placeholder={t('charges.tax')} type="number" step="0.001" defaultValue={0} />
            <select name="paymentStatus" defaultValue="unpaid">
              <option value="unpaid">{t('charges.unpaid')}</option>
              <option value="paid">{t('charges.paid')}</option>
            </select>
            <label><input name="isCustomerVisible" type="checkbox" defaultChecked /> {t('charges.customerVisible')}</label>
            <button type="submit" className="rental-btn rental-btn--primary">{t('charges.add')}</button>
          </form>
        ) : null}
        <div className="logistics-table">
          {charges.length ? charges.map((item) => (
            <div key={item.id} className="logistics-table__row logistics-table__row--admin">
              <strong>{item.category.replace(/_/g, ' ')}</strong>
              <span>{item.description}</span>
              <span>{Number(item.amount).toFixed(3)} {item.currency}</span>
              <span className="logistics-badge">{item.paymentStatus.replace(/_/g, ' ')}</span>
              {isAdmin ? (
                <button type="button" className="rental-btn rental-btn--ghost" onClick={() => void updateLogisticsCharge(item.id, { paymentStatus: item.paymentStatus === 'paid' ? 'unpaid' : 'paid' }).then(reload)}>
                  {item.paymentStatus === 'paid' ? t('charges.markUnpaid') : t('charges.markPaid')}
                </button>
              ) : null}
            </div>
          )) : <p className="logistics-empty">{t('charges.empty')}</p>}
        </div>
      </section>
    </>
  );
}
