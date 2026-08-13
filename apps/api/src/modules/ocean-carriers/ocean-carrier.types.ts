import type {
  OceanCarrierCode,
  OceanCarrierConnectionStatus,
  OceanCarrierIntegrationMode,
  OceanTrackingSearchType,
} from '@transit-logistic/shared';

/** DCSA-inspired normalized location */
export type DcsaLocation = {
  unlocode?: string;
  name?: string;
  country?: string;
  terminal?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

/** DCSA-inspired transport event */
export type DcsaTransportEvent = {
  eventType: string;
  eventDateTime: string;
  location?: DcsaLocation;
  vesselName?: string;
  voyage?: string;
  description?: string;
  source: OceanCarrierIntegrationMode;
};

/** DCSA-inspired equipment reference */
export type DcsaEquipment = {
  containerNumber: string;
  isoCode?: string;
  sizeType?: string;
  sealNumber?: string;
};

/** Normalized ocean tracking result */
export type NormalizedOceanTracking = {
  searchType: OceanTrackingSearchType;
  searchValue: string;
  carrierCode?: OceanCarrierCode;
  carrierName?: string;
  source: OceanCarrierIntegrationMode;
  dataQuality: 'live' | 'manual' | 'external';
  containerNumber?: string;
  blNumber?: string;
  bookingNumber?: string;
  shipmentReference?: string;
  vesselName?: string;
  voyage?: string;
  pol?: DcsaLocation;
  pod?: DcsaLocation;
  transshipmentPorts?: DcsaLocation[];
  etd?: string;
  eta?: string;
  actualArrival?: string;
  actualDeparture?: string;
  currentStatus?: string;
  lastUpdate?: string;
  nextMilestone?: string;
  equipment?: DcsaEquipment[];
  events: DcsaTransportEvent[];
  externalTrackingUrl?: string;
  carrierMetadata?: Record<string, unknown>;
};

/** Normalized sailing schedule row */
export type NormalizedSailingSchedule = {
  carrierCode: OceanCarrierCode;
  carrierName: string;
  vesselName: string;
  voyage: string;
  pol: DcsaLocation;
  pod: DcsaLocation;
  etd: string;
  eta: string;
  transitDays?: number;
  isDirect: boolean;
  transshipmentPorts?: DcsaLocation[];
  source: OceanCarrierIntegrationMode;
  reliabilityScore?: number;
};

export type CarrierDirectoryEntry = {
  carrierCode: OceanCarrierCode;
  displayName: string;
  scac?: string | null;
  supportsTracking: boolean;
  supportsSchedules: boolean;
  supportsBooking: boolean;
  integrationStatus: OceanCarrierConnectionStatus;
  integrationMode: OceanCarrierIntegrationMode;
};

export type AdminCarrierConnection = {
  id: string;
  carrierCode: OceanCarrierCode;
  displayName: string;
  scac?: string | null;
  integrationMode: OceanCarrierIntegrationMode;
  status: OceanCarrierConnectionStatus;
  enabled: boolean;
  supportsTracking: boolean;
  supportsSchedules: boolean;
  supportsBooking: boolean;
  credentialConfigured: boolean;
  lastSyncAt?: string | null;
  lastError?: string | null;
};

export type TrackOceanInput = {
  searchType: OceanTrackingSearchType;
  searchValue: string;
  carrierCode?: OceanCarrierCode;
};

export type ScheduleSearchInput = {
  originUnlocode: string;
  destinationUnlocode: string;
  departureDate?: string;
  containerType?: string;
  directOnly?: boolean;
  carrierCode?: OceanCarrierCode;
};

export type TestConnectionResult = {
  success: boolean;
  status: OceanCarrierConnectionStatus;
  message: string;
  testedAt: string;
};
