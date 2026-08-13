import {
  buildAirExternalTrackingUrl,
  resolveAirCredentialConfigured,
  type AirCarrierSeed,
} from '../air-carriers.constants';
import type {
  AirCarrierProvider,
  AirIntegrationMode,
  NormalizedAirTracking,
  TestAirConnectionResult,
} from '../air-carrier-provider.interface';
import { resolveAirIntegrationMode } from '../air-carrier-provider.interface';

export abstract class BaseAirCarrierAdapter implements AirCarrierProvider {
  constructor(protected readonly seed: AirCarrierSeed) {}

  get carrierCode(): string {
    return this.seed.carrierCode;
  }

  get displayName(): string {
    return this.seed.displayName;
  }

  protected get integrationMode(): AirIntegrationMode {
    return resolveAirIntegrationMode(this.seed);
  }

  async trackAWB(awb: string): Promise<NormalizedAirTracking | null> {
    if (this.integrationMode !== 'live_api') {
      return null;
    }
    return this.trackAWBLive(awb);
  }

  protected abstract trackAWBLive(awb: string): Promise<NormalizedAirTracking | null>;

  async getFlightStatus(_flightNumber: string): Promise<Record<string, unknown> | null> {
    return null;
  }

  async getEstimatedArrival(awb: string): Promise<{ eta?: string; source: string } | null> {
    const tracking = await this.trackAWB(awb);
    if (!tracking?.eta) return null;
    return { eta: tracking.eta, source: this.carrierCode };
  }

  async getMilestones(awb: string): Promise<NormalizedAirTracking['events']> {
    const tracking = await this.trackAWB(awb);
    return tracking?.events ?? [];
  }

  async getCarrierMetadata(): Promise<Record<string, unknown>> {
    return {
      carrierCode: this.carrierCode,
      displayName: this.displayName,
      iataPrefix: this.seed.iataPrefix,
      integrationMode: this.integrationMode,
      externalTrackingUrlTemplate: this.seed.externalTrackingUrlTemplate,
      credentialConfigured: resolveAirCredentialConfigured(this.seed.credentialEnvKey),
    };
  }

  async testConnection(): Promise<TestAirConnectionResult> {
    const mode = this.integrationMode;
    if (mode === 'live_api') {
      return { ok: true, mode, message: 'API credentials configured (live connection not verified in this build).' };
    }
    if (mode === 'external_tracking') {
      return {
        ok: true,
        mode,
        message: `External tracking portal: ${buildAirExternalTrackingUrl(this.seed.externalTrackingUrlTemplate, '000-00000000')}`,
      };
    }
    return { ok: false, mode: 'not_configured', message: 'No credentials or external tracking URL configured.' };
  }
}
