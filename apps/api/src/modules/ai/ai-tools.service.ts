import { Injectable } from '@nestjs/common';
import { UserRole } from '@transit-logistic/shared';
import type { User } from '@/types/user';

import { PrismaService } from '../../database/prisma.service';
import { TruckListingsService } from '../marketplace/truck-listings.service';
import { AdminDashboardService } from '../admin/admin-dashboard.service';

@Injectable()
export class AiToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: TruckListingsService,
    private readonly adminDashboard: AdminDashboardService,
  ) {}

  async execute(user: User, name: string, args: Record<string, unknown>) {
    switch (name) {
      case 'searchMarketplaceTrucks':
        return this.searchMarketplaceTrucks(args);
      case 'getTruckDetails':
        return this.getTruckDetails(String(args.slug ?? ''));
      case 'getQuoteStatus':
        return this.getQuoteStatus(user, String(args.quoteId ?? ''));
      case 'getShipmentStatus':
        return this.getShipmentStatus(user, String(args.shipmentId ?? ''));
      case 'getFleetMetrics':
        return this.getFleetMetrics(user);
      case 'getAdminMetrics':
        return this.getAdminMetrics(user);
      default:
        return { error: 'Unknown tool' };
    }
  }

  private async searchMarketplaceTrucks(args: Record<string, unknown>) {
    return this.listings.browsePublic({
      search: args.search ? String(args.search) : undefined,
      vehicleType: args.vehicleType as never,
      minCapacityKg: args.minCapacityKg ? Number(args.minCapacityKg) : undefined,
      governorateId: args.governorateId ? String(args.governorateId) : undefined,
      page: 1,
      limit: 8,
    });
  }

  private async getTruckDetails(slug: string) {
    if (!slug) return { error: 'slug required' };
    return this.listings.getPublicBySlug(slug);
  }

  private async getQuoteStatus(user: User, quoteId: string) {
    if (!quoteId) return { error: 'quoteId required' };
    const quote = await this.prisma.truckQuoteRequest.findUnique({
      where: { id: quoteId },
      include: { truckListing: { select: { name: true, slug: true } } },
    });
    if (!quote) return { error: 'not found' };
    if (user.role === UserRole.CUSTOMER && quote.customerId !== user.id) {
      return { error: 'forbidden' };
    }
    return quote;
  }

  private async getShipmentStatus(user: User, shipmentId: string) {
    if (!shipmentId) return { error: 'shipmentId required' };
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, referenceNumber: true, status: true, customerId: true, fleetOwnerId: true },
    });
    if (!shipment) return { error: 'not found' };
    if (user.role === UserRole.CUSTOMER && shipment.customerId !== user.id) {
      return { error: 'forbidden' };
    }
    return shipment;
  }

  private async getFleetMetrics(user: User) {
    if (user.role !== UserRole.FLEET_OWNER && user.role !== UserRole.ADMIN) {
      return { error: 'forbidden' };
    }
    const owner = await this.prisma.fleetOwner.findUnique({ where: { userId: user.id } });
    if (!owner && user.role === UserRole.FLEET_OWNER) return { error: 'no fleet profile' };
    const fleetOwnerId = owner?.id;
    const [listings, quotes, bookings] = await Promise.all([
      this.prisma.truckListing.count({ where: fleetOwnerId ? { fleetOwnerId } : {} }),
      this.prisma.truckQuoteRequest.count({
        where: fleetOwnerId ? { truckListing: { fleetOwnerId }, status: 'pending' } : { status: 'pending' },
      }),
      this.prisma.truckBooking.count({ where: fleetOwnerId ? { fleetOwnerId, status: 'pending' } : { status: 'pending' } }),
    ]);
    return { listings, pendingQuotes: quotes, pendingBookings: bookings };
  }

  private async getAdminMetrics(user: User) {
    if (user.role !== UserRole.ADMIN) return { error: 'forbidden' };
    return this.adminDashboard.getMetrics(user.id);
  }
}
