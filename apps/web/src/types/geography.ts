import type { GeoRegionType } from '@transit-logistic/shared';

export type Country = {
  code: string;
  nameEn: string;
  nameAr: string;
  defaultCurrency: string;
  isActive: boolean;
};

export type GeoRegion = {
  id: string;
  countryCode: string;
  type: GeoRegionType;
  code: string;
  nameEn: string;
  nameAr: string;
  parentId: string | null;
  latitude: string | null;
  longitude: string | null;
  children?: GeoRegion[];
};

export type GovernorateWithWilayats = GeoRegion & {
  children: GeoRegion[];
};
