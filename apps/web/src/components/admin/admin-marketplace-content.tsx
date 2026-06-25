'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/admin/admin-shell';
import { LoadingState } from '@/components/portal/loading-state';
import { StatCard } from '@/components/portal/stat-card';
import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import {
  approveAdminMarketplaceTruck,
  featureAdminMarketplaceTruck,
  getAdminMarketplaceMetrics,
  listAdminMarketplaceTrucks,
  rejectAdminMarketplaceTruck,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { FleetTruckListing, MarketplaceAdminMetrics } from '@/types/marketplace';

function regionLabel(
  region: { nameEn: string; nameAr: string } | null | undefined,
  locale: string,
): string {
  if (!region) return '—';
  return locale === 'ar' ? region.nameAr : region.nameEn;
}

function SimpleBarChart({
  title,
  items,
  valueKey,
  labelKey,
}: {
  title: string;
  items: Array<Record<string, unknown>>;
  valueKey: string;
  labelKey: string;
}) {
  const max = Math.max(...items.map((item) => Number(item[valueKey]) || 0), 1);

  return (
    <div className="admin-chart">
      <h3>{title}</h3>
      <ul className="admin-chart__bars">
        {items.map((item, idx) => {
          const value = Number(item[valueKey]) || 0;
          const label = String(item[labelKey] ?? '');
          return (
            <li key={idx}>
              <span className="admin-chart__label">{label}</span>
              <div className="admin-chart__track">
                <div
                  className="admin-chart__fill"
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </div>
              <span className="admin-chart__value">{value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AdminMarketplaceContent() {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [metrics, setMetrics] = useState<MarketplaceAdminMetrics | null>(null);
  const [listings, setListings] = useState<FleetTruckListing[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [m, l] = await Promise.all([
        getAdminMarketplaceMetrics(),
        listAdminMarketplaceTrucks('pending_approval'),
      ]);
      setMetrics(m);
      setListings(l);
    } catch (err) {
      setError(
        isApiClientError(err) ? getLocalizedApiMessage(err, locale as 'en' | 'ar') : t('errors.generic'),
      );
    }
  };

  useEffect(() => {
    if (isReady) void load();
  }, [isReady]);

  if (!isReady || !user) return <LoadingState message={t('loading')} />;

  return (
    <AdminShell user={user} title={t('admin.title')} subtitle={t('admin.subtitle')}>
      {error ? <p className="form-error">{error}</p> : null}
      {metrics ? (
        <>
          <div className="portal-stats portal-stats--wide">
            <StatCard label={t('admin.totalTrucks')} value={String(metrics.totalTrucks)} />
            <StatCard label={t('admin.activeTrucks')} value={String(metrics.activeTrucks)} />
            <StatCard label={t('admin.featuredTrucks')} value={String(metrics.featuredTrucks)} />
            <StatCard label={t('admin.pendingApprovals')} value={String(metrics.pendingApprovals)} />
            <StatCard label={t('admin.views')} value={String(metrics.marketplaceViews)} />
            <StatCard label={t('admin.quotes')} value={String(metrics.quoteRequests)} />
            <StatCard label={t('admin.shipmentRequests')} value={String(metrics.shipmentRequests)} />
            <StatCard label={t('admin.fleetCompanies')} value={String(metrics.fleetCompanies)} />
            <StatCard label={t('admin.customers')} value={String(metrics.customers)} />
            <StatCard
              label={t('admin.completedDeliveries')}
              value={String(metrics.completedDeliveries)}
            />
          </div>

          <div className="admin-analytics-grid">
            <SimpleBarChart
              title={t('admin.mostViewed')}
              items={metrics.mostViewedTrucks.map((truck) => ({
                label: truck.name,
                value: truck.viewCount,
              }))}
              labelKey="label"
              valueKey="value"
            />
            <SimpleBarChart
              title={t('admin.mostActiveFleets')}
              items={metrics.mostActiveFleetOwners.map((fleet) => ({
                label: fleet.companyName,
                value: fleet._count.truckListings,
              }))}
              labelKey="label"
              valueKey="value"
            />
          </div>

          <div className="admin-routes">
            <h3>{t('admin.popularRoutes')}</h3>
            {metrics.popularRoutes.length === 0 ? (
              <p>{t('admin.noRoutes')}</p>
            ) : (
              <ul>
                {metrics.popularRoutes.map((route, idx) => (
                  <li key={idx}>
                    {regionLabel(route.pickupRegion, locale) || route.pickupAddress} →{' '}
                    {regionLabel(route.deliveryRegion, locale) || route.deliveryAddress}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}

      <h2>{t('admin.pendingList')}</h2>
      {listings.length === 0 ? <p>{t('admin.noPending')}</p> : null}
      {listings.map((listing) => (
        <article key={listing.id} className="marketplace-admin-item">
          <div>
            <strong>{listing.name}</strong>
            <p>{listing.fleetOwner?.companyName}</p>
          </div>
          <div className="marketplace-admin-actions">
            <button
              type="button"
              className="portal-button portal-button--primary"
              onClick={async () => {
                await approveAdminMarketplaceTruck(listing.id);
                await load();
              }}
            >
              {t('admin.approve')}
            </button>
            <button
              type="button"
              className="portal-button"
              onClick={async () => {
                await rejectAdminMarketplaceTruck(listing.id, 'Does not meet requirements');
                await load();
              }}
            >
              {t('admin.reject')}
            </button>
            <button
              type="button"
              className="portal-button"
              onClick={async () => {
                await featureAdminMarketplaceTruck(listing.id, true);
                await load();
              }}
            >
              {t('admin.feature')}
            </button>
          </div>
        </article>
      ))}
    </AdminShell>
  );
}
