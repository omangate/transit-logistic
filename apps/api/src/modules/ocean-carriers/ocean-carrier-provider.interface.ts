import type { OceanCarrierCode } from '@transit-logistic/shared';

import type {
  NormalizedOceanTracking,
  NormalizedSailingSchedule,
  ScheduleSearchInput,
  TestConnectionResult,
  TrackOceanInput,
} from './ocean-carrier.types';

export interface OceanCarrierProvider {
  readonly carrierCode: OceanCarrierCode;
  readonly displayName: string;

  trackContainer(containerNumber: string): Promise<NormalizedOceanTracking | null>;
  trackBillOfLading(blNumber: string): Promise<NormalizedOceanTracking | null>;
  trackBooking(bookingNumber: string): Promise<NormalizedOceanTracking | null>;
  getSchedules(input: ScheduleSearchInput): Promise<NormalizedSailingSchedule[]>;
  getVesselVoyage(vesselName: string, voyage?: string): Promise<Record<string, unknown> | null>;
  getEstimatedArrival(reference: TrackOceanInput): Promise<{ eta?: string; source: string } | null>;
  getMilestones(reference: TrackOceanInput): Promise<NormalizedOceanTracking['events']>;
  getCarrierMetadata(): Promise<Record<string, unknown>>;
  testConnection(): Promise<TestConnectionResult>;
}

export const OCEAN_CARRIER_PROVIDERS = Symbol('OCEAN_CARRIER_PROVIDERS');
