import { GlobalTrackingSearchType, TrackingMode } from '@transit-logistic/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { FreightTransportMode } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';

import {
  AIR_CARRIER_SEEDS,
  buildAirExternalTrackingUrl,
  resolveAirCredentialConfigured,
  resolveAirlineFromAwb,
} from '../air-carriers.constants';
import type { UnifiedTrackingResult } from '../global-tracking.types';

@Injectable()
export class AirTrackingProvider {
  constructor(private readonly prisma: PrismaService) {}

  async track(input: {
    searchType: GlobalTrackingSearchType;
    searchValue: string;
  }): Promise<UnifiedTrackingResult | null> {
    const reference = input.searchValue.trim();
    if (!reference) return null;

    const internal = await this.trackInternal(reference);
    if (internal) return internal;

    const awb = this.normalizeAwb(reference);
    const airline = resolveAirlineFromAwb(awb);
    const credentialConfigured = airline
      ? resolveAirCredentialConfigured(airline.credentialEnvKey)
      : false;

    if (credentialConfigured) {
      return null;
    }

    if (airline) {
      return {
        mode: TrackingMode.AIR,
        reference: awb,
        searchType: input.searchType,
        providerName: airline.displayName,
        providerCode: airline.carrierCode,
        currentStatus: 'External tracking available',
        dataQuality: 'external',
        externalTrackingUrl: buildAirExternalTrackingUrl(airline.externalTrackingUrlTemplate, awb),
        events: [],
        air: {
          airline: airline.displayName,
          awb,
        },
      };
    }

    const fallback = AIR_CARRIER_SEEDS[0]!;
    return {
      mode: TrackingMode.AIR,
      reference: awb,
      searchType: input.searchType,
      providerName: 'Air cargo',
      currentStatus: 'External tracking available',
      dataQuality: 'external',
      externalTrackingUrl: buildAirExternalTrackingUrl(fallback.externalTrackingUrlTemplate, awb),
      events: [],
      air: { awb },
    };
  }

  private async trackInternal(reference: string): Promise<UnifiedTrackingResult | null> {
    const freight = await this.prisma.freightForwardingRequest.findFirst({
      where: {
        referenceNumber: reference,
        transportMode: FreightTransportMode.air,
      },
      include: {
        logisticsOrder: { select: { referenceNumber: true } },
      },
    });

    if (!freight) {
      const order = await this.prisma.logisticsOrder.findFirst({
        where: { referenceNumber: reference },
        include: {
          freightRequests: { where: { transportMode: FreightTransportMode.air }, take: 1 },
        },
      });
      if (!order?.freightRequests[0]) return null;
      return this.buildFromFreight(order.freightRequests[0], order.referenceNumber);
    }

    return this.buildFromFreight(freight, freight.referenceNumber);
  }

  private buildFromFreight(
    freight: {
      id: string;
      referenceNumber: string;
      status: string;
      updatedAt: Date;
      origin?: string | null;
      destination?: string | null;
    },
    reference: string,
  ): UnifiedTrackingResult {
    return {
      mode: TrackingMode.AIR,
      reference,
      searchType: GlobalTrackingSearchType.REFERENCE,
      providerName: 'Transit Logistic',
      currentStatus: freight.status.replace(/_/g, ' '),
      lastUpdate: freight.updatedAt.toISOString(),
      dataQuality: 'manual',
      origin: freight.origin ? { name: freight.origin } : undefined,
      destination: freight.destination ? { name: freight.destination } : undefined,
      entityId: freight.id,
      entityType: 'freight_request',
      events: [
        {
          eventType: 'status',
          eventDateTime: freight.updatedAt.toISOString(),
          description: freight.status.replace(/_/g, ' '),
          source: 'manual_ops',
        },
      ],
      air: {
        awb: reference,
        airline: 'Transit Logistic operations',
      },
    };
  }

  private normalizeAwb(reference: string): string {
    const digits = reference.replace(/\D/g, '');
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    return reference.trim().toUpperCase();
  }
}
