'use client';

import {
  OceanCarrierIntegrationMode,
} from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { EmptyPanel, IntegrationStatusBadge } from '@/components/ui/premium';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { Link } from '@/i18n/navigation';
import { listOceanCarriers } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import {
  carrierMatchesSearch,
  getCarrierMonogram,
  resolveCarrierIntegrationBadge,
} from '@/lib/carrier-utils';
import { formatDate } from '@/lib/shipment-utils';
import type { CarrierDirectoryEntry } from '@/types/ocean';

type CarrierFilter =
  | 'all'
  | 'live_api'
  | 'external_tracking'
  | 'manual_ops'
  | 'tracking'
  | 'schedules'
  | 'booking';

function CarrierDirectorySkeleton() {
  return (
    <div className="carrier-directory__grid" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="carrier-directory-card carrier-directory-card--skeleton">
          <div className="carrier-directory-card__skeleton-logo" />
          <div className="carrier-directory-card__skeleton-line carrier-directory-card__skeleton-line--title" />
          <div className="carrier-directory-card__skeleton-line" />
          <div className="carrier-directory-card__skeleton-line carrier-directory-card__skeleton-line--short" />
        </div>
      ))}
    </div>
  );
}

type CarrierCapabilityProps = {
  available: boolean;
  availableLabel: string;
  unavailableLabel: string;
};

function CarrierCapability({ available, availableLabel, unavailableLabel }: CarrierCapabilityProps) {
  return (
    <li
      className={`carrier-directory-card__capability${available ? ' carrier-directory-card__capability--yes' : ' carrier-directory-card__capability--no'}`}
    >
      <span className="carrier-directory-card__capability-icon" aria-hidden="true">
        {available ? '✓' : '—'}
      </span>
      <span>{available ? availableLabel : unavailableLabel}</span>
    </li>
  );
}

type CarrierCardProps = {
  carrier: CarrierDirectoryEntry;
  onOpenDetails: (carrier: CarrierDirectoryEntry) => void;
};

function CarrierCard({ carrier, onOpenDetails }: CarrierCardProps) {
  const t = useTranslations('oceanCarriers');
  const monogram = getCarrierMonogram(carrier.carrierCode);
  const badge = resolveCarrierIntegrationBadge(carrier.integrationMode, carrier.integrationStatus);
  const isLiveApi = badge === 'live_api';
  const isExternalTracking = badge === 'external_tracking';
  const showInternalTrack = carrier.supportsTracking && (isLiveApi || carrier.integrationMode === OceanCarrierIntegrationMode.MANUAL_OPS);
  const showExternalTrack = carrier.supportsTracking && isExternalTracking && carrier.externalTrackingPortalUrl;

  return (
    <article className="carrier-directory-card">
      <button
        type="button"
        className="carrier-directory-card__body"
        onClick={() => onOpenDetails(carrier)}
      >
        <div className="carrier-directory-card__header">
          <div
            className="carrier-directory-card__logo"
            style={{ backgroundColor: `${monogram.accent}18`, color: monogram.accent }}
            aria-hidden="true"
          >
            {monogram.initials}
          </div>
          <div className="carrier-directory-card__identity">
            <h2 className="carrier-directory-card__title">{carrier.displayName}</h2>
            <p className="carrier-directory-card__scac">
              {t('scac')}: {carrier.scac ?? '—'}
            </p>
          </div>
          <IntegrationStatusBadge status={badge} label={t(`badges.${badge}`)} />
        </div>

        <ul className="carrier-directory-card__capabilities">
          <CarrierCapability
            available={carrier.supportsTracking}
            availableLabel={t('capabilities.trackingAvailable')}
            unavailableLabel={t('capabilities.trackingUnavailable')}
          />
          <CarrierCapability
            available={carrier.supportsSchedules}
            availableLabel={t('capabilities.schedulesAvailable')}
            unavailableLabel={t('capabilities.schedulesUnavailable')}
          />
          <CarrierCapability
            available={carrier.supportsBooking}
            availableLabel={t('capabilities.bookingAvailable')}
            unavailableLabel={t('capabilities.bookingUnavailable')}
          />
        </ul>

        <p className="carrier-directory-card__mode">
          {t('connectionMethod')}: {t(`badges.${badge}`)}
        </p>
      </button>

      <div className="carrier-directory-card__actions">
        {showInternalTrack ? (
          <Link href="/track" className="portal-button portal-button--secondary portal-button--sm">
            {t('actions.trackShipment')}
          </Link>
        ) : null}
        {showExternalTrack ? (
          <a
            href={carrier.externalTrackingPortalUrl ?? '#'}
            className="portal-button portal-button--secondary portal-button--sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('actions.trackViaCarrier')}
            <span className="carrier-directory-card__external-icon" aria-hidden="true">
              ↗
            </span>
          </a>
        ) : null}
        {carrier.supportsSchedules && isLiveApi ? (
          <Link href="/ocean/schedules" className="portal-button portal-button--secondary portal-button--sm">
            {t('actions.viewSchedules')}
          </Link>
        ) : null}
        {carrier.supportsBooking && isLiveApi ? (
          <Link href="/freight/request" className="portal-button portal-button--secondary portal-button--sm">
            {t('actions.requestQuote')}
          </Link>
        ) : null}
        {carrier.carrierWebsiteUrl ? (
          <a
            href={carrier.carrierWebsiteUrl}
            className="portal-button portal-button--ghost portal-button--sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('actions.openWebsite')}
            <span className="carrier-directory-card__external-icon" aria-hidden="true">
              ↗
            </span>
          </a>
        ) : null}
        <button
          type="button"
          className="portal-button portal-button--ghost portal-button--sm"
          onClick={() => onOpenDetails(carrier)}
        >
          {t('actions.details')}
        </button>
      </div>
    </article>
  );
}

type CarrierDetailDrawerProps = {
  carrier: CarrierDirectoryEntry | null;
  onClose: () => void;
};

function CarrierDetailDrawer({ carrier, onClose }: CarrierDetailDrawerProps) {
  const t = useTranslations('oceanCarriers');
  const locale = useLocale();

  if (!carrier) {
    return null;
  }

  const badge = resolveCarrierIntegrationBadge(carrier.integrationMode, carrier.integrationStatus);
  const isLiveApi = badge === 'live_api';
  const isExternalTracking = badge === 'external_tracking';
  const monogram = getCarrierMonogram(carrier.carrierCode);

  return (
    <div className="carrier-drawer" role="presentation" onClick={onClose}>
      <aside
        className="carrier-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="carrier-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="carrier-drawer__header">
          <div className="carrier-drawer__title-row">
            <div
              className="carrier-directory-card__logo carrier-directory-card__logo--lg"
              style={{ backgroundColor: `${monogram.accent}18`, color: monogram.accent }}
              aria-hidden="true"
            >
              {monogram.initials}
            </div>
            <div>
              <h2 id="carrier-drawer-title" className="carrier-drawer__title">
                {carrier.displayName}
              </h2>
              <p className="carrier-drawer__subtitle">
                {t('scac')}: {carrier.scac ?? '—'}
              </p>
            </div>
          </div>
          <button type="button" className="carrier-drawer__close" onClick={onClose} aria-label={t('drawer.close')}>
            ×
          </button>
        </header>

        <div className="carrier-drawer__content">
          <IntegrationStatusBadge status={badge} label={t(`badges.${badge}`)} />

          <dl className="carrier-drawer__details">
            <div>
              <dt>{t('drawer.services')}</dt>
              <dd>
                <ul className="carrier-directory-card__capabilities">
                  <CarrierCapability
                    available={carrier.supportsTracking}
                    availableLabel={t('capabilities.trackingAvailable')}
                    unavailableLabel={t('capabilities.trackingUnavailable')}
                  />
                  <CarrierCapability
                    available={carrier.supportsSchedules}
                    availableLabel={t('capabilities.schedulesAvailable')}
                    unavailableLabel={t('capabilities.schedulesUnavailable')}
                  />
                  <CarrierCapability
                    available={carrier.supportsBooking}
                    availableLabel={t('capabilities.bookingAvailable')}
                    unavailableLabel={t('capabilities.bookingUnavailable')}
                  />
                </ul>
              </dd>
            </div>
            <div>
              <dt>{t('drawer.trackingMethod')}</dt>
              <dd>{t(`badges.${badge}`)}</dd>
            </div>
            <div>
              <dt>{t('drawer.schedules')}</dt>
              <dd>
                {carrier.supportsSchedules && isLiveApi
                  ? t('capabilities.schedulesAvailable')
                  : t('capabilities.schedulesUnavailable')}
              </dd>
            </div>
            <div>
              <dt>{t('drawer.booking')}</dt>
              <dd>
                {carrier.supportsBooking && isLiveApi
                  ? t('capabilities.bookingAvailable')
                  : t('capabilities.bookingUnavailable')}
              </dd>
            </div>
            {isLiveApi && carrier.lastSyncAt ? (
              <div>
                <dt>{t('drawer.lastSync')}</dt>
                <dd>{formatDate(carrier.lastSyncAt, locale)}</dd>
              </div>
            ) : null}
          </dl>

          <div className="carrier-drawer__actions">
            {carrier.supportsTracking && (isLiveApi || carrier.integrationMode === OceanCarrierIntegrationMode.MANUAL_OPS) ? (
              <Link href="/track" className="portal-button portal-button--primary">
                {t('actions.trackShipment')}
              </Link>
            ) : null}
            {carrier.supportsTracking && isExternalTracking && carrier.externalTrackingPortalUrl ? (
              <a
                href={carrier.externalTrackingPortalUrl}
                className="portal-button portal-button--primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('actions.trackViaCarrier')}
                <span className="carrier-directory-card__external-icon" aria-hidden="true">
                  ↗
                </span>
              </a>
            ) : null}
            {carrier.carrierWebsiteUrl ? (
              <a
                href={carrier.carrierWebsiteUrl}
                className="portal-button portal-button--secondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('actions.openWebsite')}
              </a>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function CarrierDirectoryContent() {
  const t = useTranslations('oceanCarriers');
  const locale = useLocale();
  const { user, isReady } = useRequireAuth();
  const [carriers, setCarriers] = useState<CarrierDirectoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CarrierFilter>('all');
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierDirectoryEntry | null>(null);

  const loadCarriers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listOceanCarriers();
      setCarriers(data);
    } catch (loadError) {
      setCarriers([]);
      setError(
        isApiClientError(loadError)
          ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
          : t('errors.loadFailed'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [locale, t]);

  useEffect(() => {
    if (!isReady) return;
    void loadCarriers();
  }, [isReady, loadCarriers]);

  const filteredCarriers = useMemo(() => {
    return carriers.filter((carrier) => {
      if (!carrierMatchesSearch(carrier, searchQuery)) {
        return false;
      }

      const badge = resolveCarrierIntegrationBadge(
        carrier.integrationMode,
        carrier.integrationStatus,
      );

      switch (activeFilter) {
        case 'live_api':
          return badge === 'live_api';
        case 'external_tracking':
          return badge === 'external_tracking';
        case 'manual_ops':
          return badge === 'manual_ops';
        case 'tracking':
          return carrier.supportsTracking;
        case 'schedules':
          return carrier.supportsSchedules;
        case 'booking':
          return carrier.supportsBooking;
        default:
          return true;
      }
    });
  }, [activeFilter, carriers, searchQuery]);

  const filterOptions: { id: CarrierFilter; label: string }[] = [
    { id: 'all', label: t('filters.all') },
    { id: 'live_api', label: t('filters.liveApi') },
    { id: 'external_tracking', label: t('filters.externalTracking') },
    { id: 'manual_ops', label: t('filters.manual') },
    { id: 'tracking', label: t('filters.trackingAvailable') },
    { id: 'schedules', label: t('filters.schedulesAvailable') },
    { id: 'booking', label: t('filters.bookingAvailable') },
  ];

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <PortalShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <section className="carrier-directory">
        <div className="carrier-directory__toolbar">
          <label className="carrier-directory__search">
            <span className="visually-hidden">{t('searchPlaceholder')}</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="carrier-directory__search-input"
            />
          </label>
          <p className="carrier-directory__count">
            {t('resultCount', { shown: filteredCarriers.length, total: carriers.length })}
          </p>
        </div>

        <div className="carrier-directory__filters" role="toolbar" aria-label={t('filters.label')}>
          {filterOptions.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`carrier-directory__filter${activeFilter === filter.id ? ' carrier-directory__filter--active' : ''}`}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="carrier-directory__error" role="alert">
            <p>{error}</p>
            <button type="button" className="portal-button portal-button--secondary" onClick={() => void loadCarriers()}>
              {t('errors.retry')}
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <CarrierDirectorySkeleton />
        ) : filteredCarriers.length === 0 ? (
          <EmptyPanel
            title={carriers.length === 0 ? t('empty.title') : t('empty.noResults')}
            description={carriers.length === 0 ? t('empty.description') : t('empty.noResultsHint')}
            action={
              carriers.length === 0 ? (
                <button type="button" className="portal-button portal-button--secondary" onClick={() => void loadCarriers()}>
                  {t('errors.retry')}
                </button>
              ) : (
                <button
                  type="button"
                  className="portal-button portal-button--secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilter('all');
                  }}
                >
                  {t('empty.clearFilters')}
                </button>
              )
            }
          />
        ) : (
          <div className="carrier-directory__grid">
            {filteredCarriers.map((carrier) => (
              <CarrierCard
                key={carrier.carrierCode}
                carrier={carrier}
                onOpenDetails={setSelectedCarrier}
              />
            ))}
          </div>
        )}
      </section>

      <CarrierDetailDrawer carrier={selectedCarrier} onClose={() => setSelectedCarrier(null)} />
    </PortalShell>
  );
}
