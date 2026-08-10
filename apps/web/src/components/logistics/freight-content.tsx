'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import { LogisticsConversationPanel } from '@/components/logistics/logistics-conversation-panel';
import { LogisticsStatusTimeline } from '@/components/logistics/logistics-status-timeline';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { useRequireCustomerAuth } from '@/hooks/use-require-customer-auth';
import { Link, useRouter } from '@/i18n/navigation';
import { createFreightRequest, getFreightShipment, listFreightShipments, submitFreightShipment } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { FreightForwardingRequest } from '@/types/logistics';

export function FreightLandingContent() {
  const t = useTranslations('logistics');

  return (
    <main className="container logistics-page">
      <header className="logistics-hero">
        <h1>{t('freight.title')}</h1>
        <p>{t('freight.subtitle')}</p>
        <div className="logistics-hero__actions">
          <Link href="/freight/request" className="rental-btn rental-btn--primary">{t('freight.requestQuote')}</Link>
          <Link href="/freight/shipments" className="rental-btn rental-btn--ghost">{t('freight.myShipments')}</Link>
        </div>
      </header>
    </main>
  );
}

export function FreightRequestContent() {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireCustomerAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    transportMode: 'sea',
    serviceType: 'fcl',
    routeType: 'door_to_door',
    origin: '',
    destination: '',
    cargoDescription: '',
    weightKg: '',
    customsClearanceRequired: true,
    pickupRequired: true,
    deliveryRequired: true,
  });

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <PortalShell user={user} title={t('freight.newRequest')} subtitle={t('freight.subtitle')}>
      {error ? <FormError message={error} /> : null}
      <form
        className="logistics-form"
        onSubmit={(e) => {
          e.preventDefault();
          void createFreightRequest({
            ...form,
            weightKg: form.weightKg ? Number(form.weightKg) : undefined,
          })
            .then(async (created) => {
              await submitFreightShipment(created.id);
              router.push(`/freight/shipments/${created.id}`);
            })
            .catch((err) => setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic')));
        }}
      >
        <label>{t('freight.fields.mode')}
          <select value={form.transportMode} onChange={(e) => setForm((f) => ({ ...f, transportMode: e.target.value }))}>
            <option value="sea">{t('freight.modes.sea')}</option>
            <option value="air">{t('freight.modes.air')}</option>
            <option value="road">{t('freight.modes.road')}</option>
            <option value="multimodal">{t('freight.modes.multimodal')}</option>
          </select>
        </label>
        <label>{t('freight.fields.origin')}<input required value={form.origin} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} /></label>
        <label>{t('freight.fields.destination')}<input required value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} /></label>
        <label>{t('freight.fields.cargo')}<textarea value={form.cargoDescription} onChange={(e) => setForm((f) => ({ ...f, cargoDescription: e.target.value }))} /></label>
        <label>{t('freight.fields.weight')}<input type="number" value={form.weightKg} onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))} /></label>
        <label><input type="checkbox" checked={form.customsClearanceRequired} onChange={(e) => setForm((f) => ({ ...f, customsClearanceRequired: e.target.checked }))} /> {t('freight.fields.customsRequired')}</label>
        <button type="submit" className="rental-btn rental-btn--primary">{t('freight.submit')}</button>
      </form>
    </PortalShell>
  );
}

export function FreightShipmentsContent() {
  const t = useTranslations('logistics');
  const { user, isReady } = useRequireCustomerAuth();
  const [items, setItems] = useState<FreightForwardingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;

    void listFreightShipments()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setIsLoading(false));
  }, [isReady, user]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <PortalShell user={user} title={t('freight.myShipments')} subtitle={t('freight.subtitle')}>
      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : (
        <div className="logistics-table">
          {items.map((item) => (
            <Link key={item.id} href={`/freight/shipments/${item.id}`} className="logistics-table__row">
              <strong>{item.referenceNumber}</strong>
              <span>{t(`freight.modes.${item.transportMode}` as never)}</span>
              <span className="logistics-badge">{t(`freight.status.${item.status}` as never)}</span>
            </Link>
          ))}
        </div>
      )}
    </PortalShell>
  );
}

export function FreightShipmentDetailContent({ id }: { id: string }) {
  const t = useTranslations('logistics');
  const { user, isReady } = useRequireCustomerAuth();
  const [item, setItem] = useState<FreightForwardingRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) return;

    void getFreightShipment(id)
      .then(setItem)
      .catch(() => setItem(null))
      .finally(() => setIsLoading(false));
  }, [id, isReady, user]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <PortalShell user={user} title={item?.referenceNumber ?? t('freight.title')} subtitle={item ? `${item.origin ?? '—'} → ${item.destination ?? '—'}` : undefined}>
      {isLoading ? (
        <LoadingState message={t('loading')} />
      ) : item ? (
        <div className="logistics-detail-grid">
          {item.logisticsOrder ? (
            <Link href={`/logistics/orders/${item.logisticsOrder.id}`}>{item.logisticsOrder.referenceNumber}</Link>
          ) : null}
          <section className="logistics-panel">
            <LogisticsStatusTimeline entries={item.statusHistory ?? []} />
          </section>
          <LogisticsConversationPanel context={{ freightRequestId: id, logisticsOrderId: item.logisticsOrderId ?? undefined }} />
        </div>
      ) : (
        <p>{t('loading')}</p>
      )}
    </PortalShell>
  );
}
