'use client';

import { useTranslations } from 'next-intl';

import type { ContainerRecord, LogisticsCharge, VehicleShipmentRecord } from '@/types/logistics';

export function LogisticsContainersPanel({ items }: { items: ContainerRecord[] }) {
  const t = useTranslations('logistics');

  if (!items.length) return null;

  return (
    <section className="logistics-panel">
      <h2>{t('containers.title')}</h2>
      <div className="logistics-table">
        {items.map((item) => (
          <div key={item.id} className="logistics-table__row logistics-table__row--admin">
            <strong>{item.containerNumber}</strong>
            <span>{item.currentLocation ?? '—'}</span>
            <span className="logistics-badge">{item.currentStatus.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LogisticsVehiclesPanel({ items }: { items: VehicleShipmentRecord[] }) {
  const t = useTranslations('logistics');

  if (!items.length) return null;

  return (
    <section className="logistics-panel">
      <h2>{t('vehicles.title')}</h2>
      <div className="logistics-table">
        {items.map((item) => (
          <div key={item.id} className="logistics-table__row logistics-table__row--admin">
            <strong>{item.vin ?? item.chassisNumber ?? '—'}</strong>
            <span>{[item.make, item.model, item.year].filter(Boolean).join(' ')}</span>
            <span className="logistics-badge">{item.customsStatus?.replace(/_/g, ' ') ?? '—'}</span>
          </div>
        ))}
      </div>
      <p className="logistics-chat__hint">{t('vehicles.importHint')}</p>
    </section>
  );
}

export function LogisticsChargesPanel({ items }: { items: LogisticsCharge[] }) {
  const t = useTranslations('logistics');

  function exportCsv() {
    const header = 'category,description,amount,currency,paymentStatus\n';
    const rows = items.map((c) => `${c.category},${c.description},${c.amount},${c.currency},${c.paymentStatus}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logistics-charges.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!items.length) return null;

  return (
    <section className="logistics-panel">
      <header className="logistics-page__header">
        <h2>{t('charges.title')}</h2>
        <button type="button" className="rental-btn rental-btn--ghost" onClick={exportCsv}>{t('charges.exportCsv')}</button>
      </header>
      <div className="logistics-table">
        {items.map((item) => (
          <div key={item.id} className="logistics-table__row logistics-table__row--admin">
            <strong>{item.category.replace(/_/g, ' ')}</strong>
            <span>{item.description}</span>
            <span>{item.amount} {item.currency}</span>
            <span className="logistics-badge">{item.paymentStatus.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
