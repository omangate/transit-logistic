import { Injectable } from '@nestjs/common';
import type { User } from '@/types/user';

import { FleetOwnershipService } from '../fleet/fleet-ownership.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FleetLogisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fleetOwnership: FleetOwnershipService,
  ) {}

  async getDashboard(user: User) {
    const fleetOwner = await this.fleetOwnership.requireFleetOwner(user);

    const activeShipmentStatuses = ['assigned', 'picked_up', 'in_transit', 'delivered'] as const;
    const activeBookingStatuses = ['pending', 'confirmed'] as const;

    const [assignedShipments, activeBookings, recentShipments, recentBookings] = await Promise.all([
      this.prisma.shipment.count({
        where: { fleetOwnerId: fleetOwner.id, status: { in: [...activeShipmentStatuses] } },
      }),
      this.prisma.truckBooking.count({
        where: { fleetOwnerId: fleetOwner.id, status: { in: [...activeBookingStatuses] } },
      }),
      this.prisma.shipment.findMany({
        where: { fleetOwnerId: fleetOwner.id },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          referenceNumber: true,
          status: true,
          updatedAt: true,
          cargoDescription: true,
        },
      }),
      this.prisma.truckBooking.findMany({
        where: { fleetOwnerId: fleetOwner.id },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          updatedAt: true,
          truckListing: { select: { name: true, slug: true } },
        },
      }),
    ]);

    const bookingIds = recentBookings.map((b) => b.id);
    const shipmentIds = recentShipments.map((s) => s.id);

    const linkedOrders = bookingIds.length || shipmentIds.length
      ? await this.prisma.logisticsOrder.findMany({
          where: {
            OR: [
              ...(bookingIds.length ? [{ truckBookingId: { in: bookingIds } }] : []),
              ...(shipmentIds.length ? [{ shipmentId: { in: shipmentIds } }] : []),
            ],
          },
          select: {
            id: true,
            referenceNumber: true,
            status: true,
            title: true,
            updatedAt: true,
            truckBookingId: true,
            shipmentId: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        })
      : [];

    return {
      counts: {
        assignedShipments,
        activeBookings,
        linkedOrders: linkedOrders.length,
      },
      recentShipments,
      recentBookings,
      linkedOrders,
    };
  }
}
