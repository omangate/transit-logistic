import {
  OceanCarrierCode,
  OceanCarrierConnectionStatus,
  OceanCarrierIntegrationMode,
  OceanTrackingSearchType,
} from '@transit-logistic/shared';

import type {
  NormalizedOceanTracking,
  NormalizedSailingSchedule,
  ScheduleSearchInput,
  TestConnectionResult,
  TrackOceanInput,
} from '../ocean-carrier.types';
import type { OceanCarrierProvider } from '../ocean-carrier-provider.interface';
import {
  buildExternalTrackingUrl,
  resolveCredentialConfigured,
} from '../ocean-carriers.constants';

type ExternalCarrierConfig = {
  carrierCode: OceanCarrierCode;
  displayName: string;
  scac: string;
  externalTrackingUrlTemplate: string;
  credentialEnvKey: string;
};

export abstract class BaseOceanCarrierAdapter implements OceanCarrierProvider {
  abstract readonly carrierCode: OceanCarrierCode;
  abstract readonly displayName: string;

  protected abstract getConfig(): ExternalCarrierConfig;

  protected hasLiveCredentials(): boolean {
    return resolveCredentialConfigured(this.getConfig().credentialEnvKey);
  }

  async trackContainer(containerNumber: string): Promise<NormalizedOceanTracking | null> {
    if (this.hasLiveCredentials()) {
      const live = await this.fetchLiveTracking(OceanTrackingSearchType.CONTAINER, containerNumber);
      if (live) {
        return live;
      }
    }
    return this.buildExternalTracking(OceanTrackingSearchType.CONTAINER, containerNumber, containerNumber);
  }

  async trackBillOfLading(blNumber: string): Promise<NormalizedOceanTracking | null> {
    if (this.hasLiveCredentials()) {
      const live = await this.fetchLiveTracking(OceanTrackingSearchType.BILL_OF_LADING, blNumber);
      if (live) {
        return live;
      }
    }
    return this.buildExternalTracking(OceanTrackingSearchType.BILL_OF_LADING, blNumber, undefined, blNumber);
  }

  async trackBooking(bookingNumber: string): Promise<NormalizedOceanTracking | null> {
    if (this.hasLiveCredentials()) {
      const live = await this.fetchLiveTracking(OceanTrackingSearchType.BOOKING, bookingNumber);
      if (live) {
        return live;
      }
    }
    return this.buildExternalTracking(OceanTrackingSearchType.BOOKING, bookingNumber, undefined, undefined, bookingNumber);
  }

  async getSchedules(_input: ScheduleSearchInput): Promise<NormalizedSailingSchedule[]> {
    if (!this.hasLiveCredentials()) {
      return [];
    }
    return this.fetchLiveSchedules(_input);
  }

  async getVesselVoyage(_vesselName: string, _voyage?: string): Promise<Record<string, unknown> | null> {
    return null;
  }

  async getEstimatedArrival(reference: TrackOceanInput): Promise<{ eta?: string; source: string } | null> {
    const tracking = await this.resolveTracking(reference);
    if (!tracking?.eta) {
      return null;
    }
    return { eta: tracking.eta, source: tracking.source };
  }

  async getMilestones(reference: TrackOceanInput): Promise<NormalizedOceanTracking['events']> {
    const tracking = await this.resolveTracking(reference);
    return tracking?.events ?? [];
  }

  async getCarrierMetadata(): Promise<Record<string, unknown>> {
    const config = this.getConfig();
    return {
      carrierCode: config.carrierCode,
      displayName: config.displayName,
      scac: config.scac,
      liveApiAvailable: this.hasLiveCredentials(),
      dcsaCompatible: true,
    };
  }

  async testConnection(): Promise<TestConnectionResult> {
    const testedAt = new Date().toISOString();
    if (this.hasLiveCredentials()) {
      try {
        const ok = await this.pingLiveApi();
        return {
          success: ok,
          status: ok ? OceanCarrierConnectionStatus.CONNECTED : OceanCarrierConnectionStatus.DEGRADED,
          message: ok
            ? 'Live API credentials detected. Adapter ready for authorized API calls.'
            : 'Credentials present but live API ping failed. Check carrier portal access.',
          testedAt,
        };
      } catch (error) {
        return {
          success: false,
          status: OceanCarrierConnectionStatus.ERROR,
          message: error instanceof Error ? error.message : 'Connection test failed',
          testedAt,
        };
      }
    }

    return {
      success: true,
      status: OceanCarrierConnectionStatus.CONNECTED,
      message: 'External tracking link mode active. Configure API credentials for live data.',
      testedAt,
    };
  }

  protected async fetchLiveTracking(
    _searchType: OceanTrackingSearchType,
    _searchValue: string,
  ): Promise<NormalizedOceanTracking | null> {
    return null;
  }

  protected async fetchLiveSchedules(_input: ScheduleSearchInput): Promise<NormalizedSailingSchedule[]> {
    return [];
  }

  protected async pingLiveApi(): Promise<boolean> {
    return false;
  }

  private async resolveTracking(reference: TrackOceanInput): Promise<NormalizedOceanTracking | null> {
    switch (reference.searchType) {
      case OceanTrackingSearchType.CONTAINER:
        return this.trackContainer(reference.searchValue);
      case OceanTrackingSearchType.BILL_OF_LADING:
        return this.trackBillOfLading(reference.searchValue);
      case OceanTrackingSearchType.BOOKING:
        return this.trackBooking(reference.searchValue);
      default:
        return null;
    }
  }

  private buildExternalTracking(
    searchType: OceanTrackingSearchType,
    searchValue: string,
    containerNumber?: string,
    blNumber?: string,
    bookingNumber?: string,
  ): NormalizedOceanTracking {
    const config = this.getConfig();
    return {
      searchType,
      searchValue,
      carrierCode: config.carrierCode,
      carrierName: config.displayName,
      source: OceanCarrierIntegrationMode.EXTERNAL_TRACKING,
      dataQuality: 'external',
      containerNumber,
      blNumber,
      bookingNumber,
      currentStatus: 'external_tracking_available',
      externalTrackingUrl: buildExternalTrackingUrl(config.externalTrackingUrlTemplate, searchValue),
      events: [],
      carrierMetadata: { scac: config.scac },
    };
  }
}
