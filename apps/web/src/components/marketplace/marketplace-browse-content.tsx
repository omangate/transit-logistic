'use client';

import {
  TruckAvailabilityStatus,
  VehicleCategory,
  VehicleType,
} from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { GeoLocationSearch } from '@/components/geography/geo-location-search';
import { OmanMap } from '@/components/map/oman-map';
import { TruckCard } from '@/components/marketplace/truck-card';
import { Link } from '@/i18n/navigation';
import { browseMarketplaceTrucks, listFavoriteTruckIds, listGovernorates } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { getStoredUser } from '@/lib/auth-storage';
import type { GeoRegion, GovernorateWithWilayats } from '@/types/geography';
import type { MarketplaceBrowseQuery, TruckListingSummary } from '@/types/marketplace';

function regionLabel(region: { nameEn: string; nameAr: string }, locale: string): string {
  return locale === 'ar' ? region.nameAr : region.nameEn;
}

export function MarketplaceBrowseContent() {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const [items, setItems] = useState<TruckListingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [governorates, setGovernorates] = useState<GovernorateWithWilayats[]>([]);
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [pickupRegion, setPickupRegion] = useState<GeoRegion | null>(null);
  const [deliveryRegion, setDeliveryRegion] = useState<GeoRegion | null>(null);
  const [filters, setFilters] = useState<MarketplaceBrowseQuery>({
    page: 1,
    limit: 12,
    sort: 'newest',
  });
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void listGovernorates('OM').then(setGovernorates).catch(() => setGovernorates([]));
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) return;
    void listFavoriteTruckIds()
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch(() => setFavoriteIds(new Set()));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await browseMarketplaceTrucks({
        ...filters,
        pickupGeoRegionId: pickupRegion?.id,
        deliveryGeoRegionId: deliveryRegion?.id,
      });
      setItems(result.items);
    } catch (err) {
      setError(
        isApiClientError(err) ? getLocalizedApiMessage(err, locale as 'en' | 'ar') : t('errors.generic'),
      );
    } finally {
      setLoading(false);
    }
  }, [filters, pickupRegion, deliveryRegion, locale, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const wilayats = useMemo(() => {
    if (!filters.governorateId) return [];
    return governorates.find((g) => g.id === filters.governorateId)?.children ?? [];
  }, [filters.governorateId, governorates]);

  const mapMarkers = useMemo(() => {
    const markers: Array<{ id: string; latitude: number; longitude: number; label?: string }> = [];
    if (pickupRegion?.latitude && pickupRegion?.longitude) {
      markers.push({
        id: `pickup-${pickupRegion.id}`,
        latitude: Number(pickupRegion.latitude),
        longitude: Number(pickupRegion.longitude),
        label: `${t('form.pickup')}: ${regionLabel(pickupRegion, locale)}`,
      });
    }
    if (deliveryRegion?.latitude && deliveryRegion?.longitude) {
      markers.push({
        id: `delivery-${deliveryRegion.id}`,
        latitude: Number(deliveryRegion.latitude),
        longitude: Number(deliveryRegion.longitude),
        label: `${t('form.delivery')}: ${regionLabel(deliveryRegion, locale)}`,
      });
    }
    return markers;
  }, [pickupRegion, deliveryRegion, locale, t]);

  return (
    <main>
      <header className="marketplace-hero">
        <div className="container marketplace-hero__inner">
          <div>
            <h1>{t('browse.title')}</h1>
            <p>{t('browse.subtitle')}</p>
          </div>
          <Link href="/marketplace/request" className="portal-button portal-button--primary">
            {t('request.cta')}
          </Link>
          <Link href="/marketplace/favorites" className="portal-button">
            {t('favorites.title')}
          </Link>
          <Link href="/marketplace/quotes" className="portal-button">
            {t('quotes.myQuotes')}
          </Link>
        </div>
      </header>

      <section className="container marketplace-map-section">
        <OmanMap markers={mapMarkers} height={280} />
      </section>

      <section className="container marketplace-layout">
        <aside className="marketplace-filters">
          <h2>{t('filters.title')}</h2>

          <GeoLocationSearch
            label={t('form.pickup')}
            value={pickupAddress}
            regionId={pickupRegion?.id}
            onAddressChange={setPickupAddress}
            onRegionSelect={(region) => {
              setPickupRegion(region);
              setFilters((f) => ({ ...f, page: 1 }));
            }}
          />
          <GeoLocationSearch
            label={t('form.delivery')}
            value={deliveryAddress}
            regionId={deliveryRegion?.id}
            onAddressChange={setDeliveryAddress}
            onRegionSelect={(region) => {
              setDeliveryRegion(region);
              setFilters((f) => ({ ...f, page: 1 }));
            }}
          />

          <label>
            {t('filters.governorate')}
            <select
              value={filters.governorateId ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  governorateId: e.target.value || undefined,
                  wilayatId: undefined,
                  page: 1,
                }))
              }
            >
              <option value="">{t('filters.all')}</option>
              {governorates.map((g) => (
                <option key={g.id} value={g.id}>
                  {regionLabel(g, locale)}
                </option>
              ))}
            </select>
          </label>

          {wilayats.length > 0 ? (
            <label>
              {t('filters.wilayat')}
              <select
                value={filters.wilayatId ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    wilayatId: e.target.value || undefined,
                    page: 1,
                  }))
                }
              >
                <option value="">{t('filters.all')}</option>
                {wilayats.map((w) => (
                  <option key={w.id} value={w.id}>
                    {regionLabel(w, locale)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            {t('filters.search')}
            <input
              type="search"
              value={filters.search ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            />
          </label>
          <label>
            {t('filters.category')}
            <select
              value={filters.category ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  category: (e.target.value || undefined) as MarketplaceBrowseQuery['category'],
                  page: 1,
                }))
              }
            >
              <option value="">{t('filters.all')}</option>
              {Object.values(VehicleCategory).map((v) => (
                <option key={v} value={v}>
                  {t(`categories.${v}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('filters.vehicleType')}
            <select
              value={filters.vehicleType ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  vehicleType: (e.target.value || undefined) as MarketplaceBrowseQuery['vehicleType'],
                  page: 1,
                }))
              }
            >
              <option value="">{t('filters.all')}</option>
              {Object.values(VehicleType).map((v) => (
                <option key={v} value={v}>
                  {t(`vehicleTypes.${v}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('filters.minCapacity')}
            <input
              type="number"
              min={0}
              value={filters.minCapacityKg ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  minCapacityKg: e.target.value ? Number(e.target.value) : undefined,
                  page: 1,
                }))
              }
            />
          </label>
          <label>
            {t('filters.minRating')}
            <input
              type="number"
              min={0}
              max={5}
              step="0.5"
              value={filters.minRating ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  minRating: e.target.value ? Number(e.target.value) : undefined,
                  page: 1,
                }))
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.crossBorder ?? false}
              onChange={(e) =>
                setFilters((f) => ({ ...f, crossBorder: e.target.checked || undefined, page: 1 }))
              }
            />
            {t('filters.crossBorder')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.refrigerated ?? false}
              onChange={(e) =>
                setFilters((f) => ({ ...f, refrigerated: e.target.checked || undefined, page: 1 }))
              }
            />
            {t('filters.refrigerated')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.containerTransport ?? false}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  containerTransport: e.target.checked || undefined,
                  page: 1,
                }))
              }
            />
            {t('filters.containerTransport')}
          </label>
          <label>
            {t('filters.availability')}
            <select
              value={filters.availability ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  availability: (e.target.value || undefined) as TruckAvailabilityStatus | undefined,
                  page: 1,
                }))
              }
            >
              <option value="">{t('filters.all')}</option>
              {Object.values(TruckAvailabilityStatus).map((v) => (
                <option key={v} value={v}>
                  {t(`availability.${v}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('filters.sort')}
            <select
              value={filters.sort ?? 'newest'}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  sort: e.target.value as MarketplaceBrowseQuery['sort'],
                  page: 1,
                }))
              }
            >
              <option value="newest">{t('filters.sortNewest')}</option>
              <option value="rating">{t('filters.sortRating')}</option>
              <option value="deliveries">{t('filters.sortDeliveries')}</option>
              <option value="price_asc">{t('filters.sortPriceAsc')}</option>
              <option value="price_desc">{t('filters.sortPriceDesc')}</option>
            </select>
          </label>
        </aside>

        <div className="marketplace-results">
          {error ? <p className="form-error">{error}</p> : null}
          {loading ? <p>{t('loading')}</p> : null}
          {!loading && items.length === 0 ? <p>{t('browse.empty')}</p> : null}
          <div className="rental-grid">
            {items.map((truck) => (
              <TruckCard
                key={truck.id}
                truck={truck}
                locale={locale}
                isFavorited={favoriteIds.has(truck.id)}
              />
            ))}
          </div>
          <p className="marketplace-compare-hint">
            <Link href="/login">{t('browse.loginToQuote')}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
