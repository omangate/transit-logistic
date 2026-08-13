import {
  GlobalTrackingSearchType,
  OceanTrackingSearchType,
  ShipmentStatus,
  TrackingMode,
} from '@transit-logistic/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { FreightTransportMode } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { OceanCarriersService } from '../ocean-carriers/ocean-carriers.service';

import type { TrackingSummary, UnifiedTrackingResult } from './global-tracking.types';
import { AirTrackingProvider } from './providers/air-tracking.provider';
import { RoadTrackingProvider } from './providers/road-tracking.provider';
import { detectSearchType, detectTrackingMode, normalizeReference } from './reference-detector.util';

@Injectable()
export class GlobalTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oceanCarriers: OceanCarriersService,
    private readonly airProvider: AirTrackingProvider,
    private readonly roadProvider: RoadTrackingProvider,
  ) {}

  async track(input: {
    mode?: TrackingMode | 'all';
    searchType?: GlobalTrackingSearchType;
    searchValue: string;
    requesterUserId?: string;
  }): Promise<UnifiedTrackingResult> {
    const reference = normalizeReference(input.searchValue);
    const resolvedMode = input.mode && input.mode !== 'all' ? input.mode : detectTrackingMode(reference);
    const searchType = input.searchType ?? detectSearchType(reference, resolvedMode);

    if (resolvedMode === TrackingMode.OCEAN) {
      const ocean = await this.trackOcean(searchType, reference);
      if (ocean) return ocean;
    }

    if (resolvedMode === TrackingMode.AIR) {
      const air = await this.airProvider.track({ searchType, searchValue: reference });
      if (air) return air;
    }

    if (resolvedMode === TrackingMode.ROAD) {
      return this.roadProvider.track({ searchType, searchValue: reference, requesterUserId: input.requesterUserId });
    }

    const ocean = await this.trackOcean(searchType, reference);
    if (ocean) return ocean;

    const air = await this.airProvider.track({ searchType, searchValue: reference });
    if (air) return air;

    try {
      return await this.roadProvider.track({ searchType, searchValue: reference, requesterUserId: input.requesterUserId });
    } catch {
      throw new NotFoundException({
        code: 'TRACKING_NOT_FOUND',
        message_en: 'No tracking data found for this reference.',
        message_ar: 'لا توجد بيانات تتبع لهذا المرجع.',
      });
    }
  }

  async getSummary(userId: string): Promise<TrackingSummary> {
    const [roadShipments, oceanFreight, airFreight, logisticsOrders] = await Promise.all([
      this.prisma.shipment.findMany({
        where: { customerId: userId },
        select: { referenceNumber: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.freightForwardingRequest.findMany({
        where: { customerId: userId, transportMode: FreightTransportMode.sea },
        select: { referenceNumber: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.freightForwardingRequest.findMany({
        where: { customerId: userId, transportMode: FreightTransportMode.air },
        select: { referenceNumber: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.logisticsOrder.findMany({
        where: { customerId: userId },
        select: { referenceNumber: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ]);

    const activeRoadStatuses = new Set<ShipmentStatus>([
      ShipmentStatus.PENDING_ASSIGNMENT,
      ShipmentStatus.ASSIGNED,
      ShipmentStatus.PICKED_UP,
      ShipmentStatus.IN_TRANSIT,
    ]);
    const arrivedRoadStatuses = new Set<ShipmentStatus>([ShipmentStatus.DELIVERED, ShipmentStatus.COMPLETED]);

    const summarizeFreight = (rows: Array<{ status: string }>) => ({
      active: rows.filter((row) => ['submitted', 'quotation_sent', 'quotation_accepted', 'in_progress', 'in_transit'].includes(row.status)).length,
      delayed: rows.filter((row) => ['on_hold', 'delayed'].includes(row.status)).length,
      arrived: rows.filter((row) => ['delivered', 'completed', 'arrived'].includes(row.status)).length,
      actionRequired: rows.filter((row) => ['documents_missing', 'quotation_sent', 'draft'].includes(row.status)).length,
    });

    const recentReferences = [
      ...roadShipments.slice(0, 5).map((row) => ({
        reference: row.referenceNumber,
        mode: TrackingMode.ROAD as TrackingMode,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
      })),
      ...oceanFreight.slice(0, 5).map((row) => ({
        reference: row.referenceNumber,
        mode: TrackingMode.OCEAN as TrackingMode,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
      })),
      ...airFreight.slice(0, 5).map((row) => ({
        reference: row.referenceNumber,
        mode: TrackingMode.AIR as TrackingMode,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8);

    return {
      ocean: summarizeFreight(oceanFreight),
      air: summarizeFreight(airFreight),
      road: {
        active: roadShipments.filter((row) => activeRoadStatuses.has(row.status)).length,
        delayed: 0,
        arrived: roadShipments.filter((row) => arrivedRoadStatuses.has(row.status)).length,
        actionRequired: roadShipments.filter((row) => row.status === ShipmentStatus.DRAFT).length,
      },
      recentReferences,
    };
  }

  private async trackOcean(
    searchType: GlobalTrackingSearchType,
    reference: string,
  ): Promise<UnifiedTrackingResult | null> {
    const oceanSearchType = this.mapOceanSearchType(searchType);
    try {
      const result = await this.oceanCarriers.track({
        searchType: oceanSearchType,
        searchValue: reference,
      });

      return {
        mode: TrackingMode.OCEAN,
        reference,
        searchType,
        providerName: result.carrierName,
        providerCode: result.carrierCode,
        currentStatus: result.currentStatus,
        lastUpdate: result.lastUpdate,
        eta: result.eta,
        etd: result.etd,
        nextMilestone: result.nextMilestone,
        dataQuality: result.dataQuality,
        externalTrackingUrl: result.externalTrackingUrl,
        origin: result.pol ? { code: result.pol.unlocode, name: result.pol.name, country: result.pol.country } : undefined,
        destination: result.pod ? { code: result.pod.unlocode, name: result.pod.name, country: result.pod.country } : undefined,
        events: result.events.map((event) => ({
          eventType: event.eventType,
          eventDateTime: event.eventDateTime,
          location: event.location
            ? { code: event.location.unlocode, name: event.location.name, country: event.location.country }
            : undefined,
          description: event.description,
          source: event.source,
        })),
        ocean: {
          vesselName: result.vesselName,
          voyage: result.voyage,
          containerNumber: result.containerNumber,
          blNumber: result.blNumber,
          bookingNumber: result.bookingNumber,
          pol: result.pol ? { code: result.pol.unlocode, name: result.pol.name, country: result.pol.country } : undefined,
          pod: result.pod ? { code: result.pod.unlocode, name: result.pod.name, country: result.pod.country } : undefined,
          transshipmentPorts: result.transshipmentPorts?.map((port) => ({
            code: port.unlocode,
            name: port.name,
            country: port.country,
          })),
        },
      };
    } catch {
      return null;
    }
  }

  private mapOceanSearchType(searchType: GlobalTrackingSearchType): OceanTrackingSearchType {
    switch (searchType) {
      case GlobalTrackingSearchType.CONTAINER:
        return OceanTrackingSearchType.CONTAINER;
      case GlobalTrackingSearchType.BILL_OF_LADING:
        return OceanTrackingSearchType.BILL_OF_LADING;
      case GlobalTrackingSearchType.BOOKING:
        return OceanTrackingSearchType.BOOKING;
      default:
        return OceanTrackingSearchType.REFERENCE;
    }
  }
}
