import {
  OceanCarrierIntegrationMode,
  OceanTrackingSearchType,
} from '@transit-logistic/shared';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import type { NormalizedOceanTracking } from '../ocean-carrier.types';

@Injectable()
export class InternalOceanTrackingProvider {
  constructor(private readonly prisma: PrismaService) {}

  async trackByReference(searchValue: string): Promise<NormalizedOceanTracking | null> {
    const normalized = searchValue.trim().toUpperCase();

    const container = await this.prisma.containerRecord.findFirst({
      where: {
        OR: [
          { containerNumber: { equals: normalized, mode: 'insensitive' } },
          { blNumber: { equals: normalized, mode: 'insensitive' } },
        ],
      },
      include: {
        logisticsOrder: true,
        freightRequest: true,
      },
    });

    if (!container) {
      const order = await this.prisma.logisticsOrder.findFirst({
        where: { referenceNumber: { equals: normalized, mode: 'insensitive' } },
      });
      if (!order) {
        return null;
      }

      return {
        searchType: OceanTrackingSearchType.REFERENCE,
        searchValue: normalized,
        shipmentReference: order.referenceNumber,
        source: OceanCarrierIntegrationMode.MANUAL_OPS,
        dataQuality: 'manual',
        currentStatus: order.status,
        lastUpdate: order.updatedAt.toISOString(),
        events: [
          {
            eventType: 'status_update',
            eventDateTime: order.updatedAt.toISOString(),
            description: `Logistics order ${order.referenceNumber}`,
            source: OceanCarrierIntegrationMode.MANUAL_OPS,
          },
        ],
      };
    }

    const status = container.currentStatus;
    const location = container.currentLocation ?? undefined;

    return {
      searchType: container.containerNumber.toUpperCase() === normalized
        ? OceanTrackingSearchType.CONTAINER
        : OceanTrackingSearchType.BILL_OF_LADING,
      searchValue: normalized,
      source: OceanCarrierIntegrationMode.MANUAL_OPS,
      dataQuality: 'manual',
      containerNumber: container.containerNumber,
      blNumber: container.blNumber ?? undefined,
      shipmentReference: container.logisticsOrder?.referenceNumber,
      carrierName: container.shippingLine ?? undefined,
      currentStatus: status,
      lastUpdate: container.updatedAt.toISOString(),
      pol: location ? { name: location } : undefined,
      events: [
        {
          eventType: 'equipment_update',
          eventDateTime: container.updatedAt.toISOString(),
          description: `Container ${container.containerNumber} — ${status}${location ? ` at ${location}` : ''}`,
          source: OceanCarrierIntegrationMode.MANUAL_OPS,
        },
      ],
      equipment: [
        {
          containerNumber: container.containerNumber,
          sizeType: container.size ?? undefined,
          sealNumber: container.sealNumber ?? undefined,
        },
      ],
    };
  }
}
