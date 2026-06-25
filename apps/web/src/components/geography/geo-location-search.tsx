'use client';

import { DEFAULT_COUNTRY_CODE } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { searchGeoRegions } from '@/lib/api';
import type { GeoRegion } from '@/types/geography';

type GeoLocationSearchProps = {
  label: string;
  value: string;
  regionId?: string;
  onAddressChange: (address: string) => void;
  onRegionSelect: (region: GeoRegion | null) => void;
};

function regionLabel(region: GeoRegion, locale: string): string {
  return locale === 'ar' ? region.nameAr : region.nameEn;
}

export function GeoLocationSearch({
  label,
  value,
  regionId,
  onAddressChange,
  onRegionSelect,
}: GeoLocationSearchProps) {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoRegion[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchGeoRegions(DEFAULT_COUNTRY_CODE, query)
        .then(setResults)
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="geo-location-search">
      <label>
        {label}
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onAddressChange(e.target.value);
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t('form.locationPlaceholder')}
        />
      </label>
      {regionId ? (
        <button
          type="button"
          className="geo-location-search__clear"
          onClick={() => onRegionSelect(null)}
        >
          {t('form.clearLocation')}
        </button>
      ) : null}
      {open && results.length > 0 ? (
        <ul className="geo-location-search__results">
          {results.map((region) => (
            <li key={region.id}>
              <button
                type="button"
                onClick={() => {
                  onAddressChange(regionLabel(region, locale));
                  onRegionSelect(region);
                  setOpen(false);
                  setQuery('');
                }}
              >
                {regionLabel(region, locale)}
                <span>{region.type}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
