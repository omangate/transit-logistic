export type PortSearchResult = {
  unlocode: string;
  nameEn: string;
  nameAr: string;
  countryCode: string;
  country?: string;
  source: 'database' | 'reference';
  latitude?: number;
  longitude?: number;
};
