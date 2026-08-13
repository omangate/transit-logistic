import type { AirCarrierSeed } from './air-carriers.constants';

export type AirIntegrationMode = 'live_api' | 'manual_ops' | 'external_tracking' | 'not_configured';

export interface NormalizedAirTracking {
  awb: string;
  airline?: string;
  flightNumber?: string;
  origin?: { code?: string; name?: string; country?: string };
  destination?: { code?: string; name?: string; country?: string };
  currentStatus: string;
  lastUpdate?: string;
  eta?: string;
  etd?: string;
  nextMilestone?: string;
  events: Array<{
    eventType: string;
    eventDateTime?: string;
    location?: string;
    description?: string;
    source?: string;
  }>;
}

export interface TestAirConnectionResult {
  ok: boolean;
  mode: AirIntegrationMode;
  message: string;
}

export interface AirCarrierProvider {
  readonly carrierCode: string;
  readonly displayName: string;

  trackAWB(awb: string): Promise<NormalizedAirTracking | null>;
  getFlightStatus(flightNumber: string): Promise<Record<string, unknown> | null>;
  getEstimatedArrival(awb: string): Promise<{ eta?: string; source: string } | null>;
  getMilestones(awb: string): Promise<NormalizedAirTracking['events']>;
  getCarrierMetadata(): Promise<Record<string, unknown>>;
  testConnection(): Promise<TestAirConnectionResult>;
}

export function resolveAirIntegrationMode(seed: AirCarrierSeed): AirIntegrationMode {
  if (process.env[seed.credentialEnvKey]?.trim()) {
    return 'live_api';
  }
  if (seed.externalTrackingUrlTemplate) {
    return 'external_tracking';
  }
  return 'not_configured';
}
