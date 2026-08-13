export const TrackingMode = {
  OCEAN: 'ocean',
  AIR: 'air',
  ROAD: 'road',
} as const;

export type TrackingMode = (typeof TrackingMode)[keyof typeof TrackingMode];

export const GlobalTrackingSearchType = {
  // Ocean
  CONTAINER: 'container',
  BILL_OF_LADING: 'bill_of_lading',
  BOOKING: 'booking',
  // Air
  AWB: 'awb',
  MAWB: 'mawb',
  HAWB: 'hawb',
  // Shared
  REFERENCE: 'reference',
  SHIPMENT_REFERENCE: 'shipment_reference',
  TRUCK: 'truck',
  ORDER: 'order',
} as const;

export type GlobalTrackingSearchType =
  (typeof GlobalTrackingSearchType)[keyof typeof GlobalTrackingSearchType];

export const TrackingDataQuality = {
  LIVE: 'live',
  MANUAL: 'manual',
  EXTERNAL: 'external',
} as const;

export type TrackingDataQuality =
  (typeof TrackingDataQuality)[keyof typeof TrackingDataQuality];
