'use client';

import { DEFAULT_COUNTRY_CODE } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { listGovernorates } from '@/lib/api';
import type { GovernorateWithWilayats } from '@/types/geography';

type GeoRegionPickerProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  countryCode?: string;
};

function regionLabel(
  region: { nameEn: string; nameAr: string },
  locale: string,
): string {
  return locale === 'ar' ? region.nameAr : region.nameEn;
}

export function GeoRegionPicker({
  selectedIds,
  onChange,
  countryCode = DEFAULT_COUNTRY_CODE,
}: GeoRegionPickerProps) {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const [governorates, setGovernorates] = useState<GovernorateWithWilayats[]>([]);
  const [expandedGov, setExpandedGov] = useState<string | null>(null);

  useEffect(() => {
    void listGovernorates(countryCode).then(setGovernorates).catch(() => setGovernorates([]));
  }, [countryCode]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleRegion = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const toggleGovernorate = (gov: GovernorateWithWilayats) => {
    const ids = [gov.id, ...gov.children.map((c) => c.id)];
    const allSelected = ids.every((id) => selectedSet.has(id));
    const next = new Set(selectedIds);
    ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
    onChange([...next]);
  };

  return (
    <div className="geo-region-picker">
      <p className="geo-region-picker__hint">{t('form.serviceAreasHint')}</p>
      <div className="geo-region-picker__list">
        {governorates.map((gov) => {
          const wilayatIds = gov.children.map((c) => c.id);
          const govSelected =
            selectedSet.has(gov.id) || wilayatIds.some((id) => selectedSet.has(id));

          return (
            <div key={gov.id} className="geo-region-picker__gov">
              <div className="geo-region-picker__gov-header">
                <label>
                  <input
                    type="checkbox"
                    checked={govSelected}
                    onChange={() => toggleGovernorate(gov)}
                  />
                  {regionLabel(gov, locale)}
                </label>
                <button
                  type="button"
                  className="geo-region-picker__toggle"
                  onClick={() => setExpandedGov((v) => (v === gov.id ? null : gov.id))}
                >
                  {expandedGov === gov.id ? '−' : '+'}
                </button>
              </div>
              {expandedGov === gov.id ? (
                <div className="geo-region-picker__wilayats">
                  {gov.children.map((wilayat) => (
                    <label key={wilayat.id}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(wilayat.id)}
                        onChange={() => toggleRegion(wilayat.id)}
                      />
                      {regionLabel(wilayat, locale)}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {selectedIds.length > 0 ? (
        <p className="geo-region-picker__count">
          {t('form.serviceAreasSelected', { count: selectedIds.length })}
        </p>
      ) : null}
    </div>
  );
}
