import {
  OceanCarrierCode,
  OceanCarrierConnectionStatus,
  OceanCarrierIntegrationMode,
  OceanTrackingSearchType,
} from '@transit-logistic/shared';
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type {
  AdminCarrierConnection,
  CarrierDirectoryEntry,
  NormalizedOceanTracking,
  NormalizedSailingSchedule,
  ScheduleSearchInput,
  TestConnectionResult,
  TrackOceanInput,
} from './ocean-carrier.types';
import type { OceanCarrierProvider } from './ocean-carrier-provider.interface';
import { createOceanCarrierProviders } from './providers/carrier-adapters';
import { InternalOceanTrackingProvider } from './providers/internal-ocean-tracking.provider';
import {
  CARRIER_SEED_DEFINITIONS,
  resolveCredentialConfigured,
  resolveIntegrationStatus,
} from './ocean-carriers.constants';

@Injectable()
export class OceanCarriersService implements OnModuleInit {
  private readonly logger = new Logger(OceanCarriersService.name);
  private readonly providers = new Map<OceanCarrierCode, OceanCarrierProvider>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly internalProvider: InternalOceanTrackingProvider,
  ) {
    for (const provider of createOceanCarrierProviders()) {
      this.providers.set(provider.carrierCode, provider);
    }
  }

  async onModuleInit() {
    await this.ensureCarrierConfigs();
  }

  async track(input: TrackOceanInput): Promise<NormalizedOceanTracking> {
    const searchValue = input.searchValue.trim();
    if (!searchValue) {
      throw new NotFoundException('Tracking reference is required');
    }

    const internal = await this.internalProvider.trackByReference(searchValue);
    if (internal) {
      await this.cacheTracking(internal);
      return internal;
    }

    if (input.carrierCode) {
      const carrierResult = await this.trackWithCarrier(input.carrierCode, input);
      if (carrierResult) {
        await this.cacheTracking(carrierResult);
        return carrierResult;
      }
    }

    for (const provider of this.providers.values()) {
      const result = await this.trackWithCarrier(provider.carrierCode, input);
      if (result && result.dataQuality === 'live') {
        await this.cacheTracking(result);
        return result;
      }
    }

    if (
      input.searchType === OceanTrackingSearchType.CONTAINER ||
      input.searchType === OceanTrackingSearchType.BILL_OF_LADING ||
      input.searchType === OceanTrackingSearchType.BOOKING
    ) {
      for (const provider of this.providers.values()) {
        const result = await this.trackWithCarrier(provider.carrierCode, input);
        if (result?.dataQuality === 'external') {
          await this.cacheTracking(result);
          return result;
        }
      }
    }

    throw new NotFoundException('No tracking data found for this reference');
  }

  async searchSchedules(input: ScheduleSearchInput): Promise<NormalizedSailingSchedule[]> {
    const enabledCarriers = await this.prisma.oceanCarrierConfig.findMany({
      where: { enabled: true, supportsSchedules: true },
    });

    const results: NormalizedSailingSchedule[] = [];
    for (const carrier of enabledCarriers) {
      const provider = this.providers.get(carrier.carrierCode as OceanCarrierCode);
      if (!provider) {
        continue;
      }
      const rows = await provider.getSchedules(input);
      results.push(...rows);
    }

    return results.sort((a, b) => a.etd.localeCompare(b.etd));
  }

  async listCarrierDirectory(): Promise<CarrierDirectoryEntry[]> {
    const configs = await this.prisma.oceanCarrierConfig.findMany({ orderBy: { displayName: 'asc' } });
    return configs.map((config) => ({
      carrierCode: config.carrierCode as OceanCarrierCode,
      displayName: config.displayName,
      scac: config.scac,
      supportsTracking: config.supportsTracking,
      supportsSchedules: config.supportsSchedules,
      supportsBooking: config.supportsBooking,
      integrationStatus: config.status as OceanCarrierConnectionStatus,
      integrationMode: config.integrationMode as OceanCarrierIntegrationMode,
    }));
  }

  async listAdminConnections(): Promise<AdminCarrierConnection[]> {
    const configs = await this.prisma.oceanCarrierConfig.findMany({ orderBy: { displayName: 'asc' } });
    return configs.map((config) => ({
      id: config.id,
      carrierCode: config.carrierCode as OceanCarrierCode,
      displayName: config.displayName,
      scac: config.scac,
      integrationMode: config.integrationMode as OceanCarrierIntegrationMode,
      status: config.status as OceanCarrierConnectionStatus,
      enabled: config.enabled,
      supportsTracking: config.supportsTracking,
      supportsSchedules: config.supportsSchedules,
      supportsBooking: config.supportsBooking,
      credentialConfigured: resolveCredentialConfigured(config.credentialEnvKey),
      lastSyncAt: config.lastSyncAt?.toISOString() ?? null,
      lastError: config.lastError,
    }));
  }

  async updateAdminConnection(
    carrierCode: OceanCarrierCode,
    input: {
      enabled?: boolean;
      integrationMode?: OceanCarrierIntegrationMode;
      supportsSchedules?: boolean;
      supportsBooking?: boolean;
    },
  ): Promise<AdminCarrierConnection> {
    const existing = await this.prisma.oceanCarrierConfig.findUnique({ where: { carrierCode } });
    if (!existing) {
      throw new NotFoundException('Carrier not found');
    }

    const credentialConfigured = resolveCredentialConfigured(existing.credentialEnvKey);
    const integrationMode = input.integrationMode ?? (existing.integrationMode as OceanCarrierIntegrationMode);
    const status = resolveIntegrationStatus(
      credentialConfigured,
      integrationMode,
      existing.lastError,
      existing.lastSyncAt,
    );

    const updated = await this.prisma.oceanCarrierConfig.update({
      where: { carrierCode },
      data: {
        enabled: input.enabled ?? existing.enabled,
        integrationMode,
        supportsSchedules: input.supportsSchedules ?? existing.supportsSchedules,
        supportsBooking: input.supportsBooking ?? existing.supportsBooking,
        status,
      },
    });

    return {
      id: updated.id,
      carrierCode: updated.carrierCode as OceanCarrierCode,
      displayName: updated.displayName,
      scac: updated.scac,
      integrationMode: updated.integrationMode as OceanCarrierIntegrationMode,
      status: updated.status as OceanCarrierConnectionStatus,
      enabled: updated.enabled,
      supportsTracking: updated.supportsTracking,
      supportsSchedules: updated.supportsSchedules,
      supportsBooking: updated.supportsBooking,
      credentialConfigured,
      lastSyncAt: updated.lastSyncAt?.toISOString() ?? null,
      lastError: updated.lastError,
    };
  }

  async testAdminConnection(carrierCode: OceanCarrierCode): Promise<TestConnectionResult> {
    const provider = this.providers.get(carrierCode);
    if (!provider) {
      throw new NotFoundException('Carrier adapter not found');
    }

    const result = await provider.testConnection();
    await this.prisma.oceanCarrierConfig.update({
      where: { carrierCode },
      data: {
        status: result.status,
        lastSyncAt: result.success ? new Date() : undefined,
        lastError: result.success ? null : result.message,
      },
    });

    return result;
  }

  private async trackWithCarrier(
    carrierCode: OceanCarrierCode,
    input: TrackOceanInput,
  ): Promise<NormalizedOceanTracking | null> {
    const config = await this.prisma.oceanCarrierConfig.findUnique({ where: { carrierCode } });
    if (!config?.enabled) {
      return null;
    }

    const provider = this.providers.get(carrierCode);
    if (!provider) {
      return null;
    }

    return this.resolveCarrierTracking(provider, input);
  }

  private async resolveCarrierTracking(
    provider: OceanCarrierProvider,
    input: TrackOceanInput,
  ): Promise<NormalizedOceanTracking | null> {
    switch (input.searchType) {
      case OceanTrackingSearchType.CONTAINER:
        return provider.trackContainer(input.searchValue);
      case OceanTrackingSearchType.BILL_OF_LADING:
        return provider.trackBillOfLading(input.searchValue);
      case OceanTrackingSearchType.BOOKING:
        return provider.trackBooking(input.searchValue);
      default:
        return provider.trackContainer(input.searchValue);
    }
  }

  private async cacheTracking(tracking: NormalizedOceanTracking) {
    try {
      await this.prisma.oceanTrackingCache.create({
        data: {
          searchType: tracking.searchType,
          searchValue: tracking.searchValue,
          carrierCode: tracking.carrierCode ?? null,
          source: tracking.source,
          normalizedData: tracking as unknown as Prisma.InputJsonValue,
          containerNumber: tracking.containerNumber ?? null,
          blNumber: tracking.blNumber ?? null,
          bookingNumber: tracking.bookingNumber ?? null,
          vesselName: tracking.vesselName ?? null,
          voyage: tracking.voyage ?? null,
          polUnlocode: tracking.pol?.unlocode ?? null,
          podUnlocode: tracking.pod?.unlocode ?? null,
          etd: tracking.etd ? new Date(tracking.etd) : null,
          eta: tracking.eta ? new Date(tracking.eta) : null,
          currentStatus: tracking.currentStatus ?? null,
          lastEventAt: tracking.lastUpdate ? new Date(tracking.lastUpdate) : null,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to cache ocean tracking: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async ensureCarrierConfigs() {
    for (const seed of CARRIER_SEED_DEFINITIONS) {
      const credentialConfigured = resolveCredentialConfigured(seed.credentialEnvKey);
      const integrationMode = OceanCarrierIntegrationMode.EXTERNAL_TRACKING;
      const status = resolveIntegrationStatus(credentialConfigured, integrationMode, null, null);

      await this.prisma.oceanCarrierConfig.upsert({
        where: { carrierCode: seed.carrierCode },
        create: {
          carrierCode: seed.carrierCode,
          displayName: seed.displayName,
          scac: seed.scac,
          integrationMode,
          status,
          externalTrackingUrlTemplate: seed.externalTrackingUrlTemplate,
          credentialEnvKey: seed.credentialEnvKey,
        },
        update: {
          displayName: seed.displayName,
          scac: seed.scac,
          externalTrackingUrlTemplate: seed.externalTrackingUrlTemplate,
          credentialEnvKey: seed.credentialEnvKey,
        },
      });
    }
  }
}
