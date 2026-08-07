import { Injectable } from '@nestjs/common';
import { UserRole } from '@transit-logistic/shared';
import type { User } from '@/types/user';

import { PrismaService } from '../../database/prisma.service';
import { AdminDashboardService } from '../admin/admin-dashboard.service';
import { CustomsClearanceService } from '../logistics/customs-clearance.service';
import { FreightForwardingService } from '../logistics/freight-forwarding.service';
import { LogisticsDocumentsService } from '../logistics/logistics-documents.service';
import { LogisticsOrdersService } from '../logistics/logistics-orders.service';
import { TruckListingsService } from '../marketplace/truck-listings.service';

@Injectable()
export class AiToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: TruckListingsService,
    private readonly adminDashboard: AdminDashboardService,
    private readonly customs: CustomsClearanceService,
    private readonly freight: FreightForwardingService,
    private readonly logisticsOrders: LogisticsOrdersService,
    private readonly logisticsDocuments: LogisticsDocumentsService,
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
      case 'createCustomsDraft':
        return this.createCustomsDraft(user, args);
      case 'getCustomsRequestStatus':
        return this.getCustomsRequestStatus(user, String(args.requestId ?? ''));
      case 'listMissingDocuments':
        return this.listMissingDocuments(user, args);
      case 'createFreightDraft':
        return this.createFreightDraft(user, args);
      case 'getFreightQuoteStatus':
        return this.getFreightQuoteStatus(user, String(args.quoteId ?? ''));
      case 'getLogisticsOrderStatus':
        return this.getLogisticsOrderStatus(user, String(args.orderId ?? ''));
      case 'getContainerStatus':
        return this.getContainerStatus(user, String(args.containerNumber ?? ''));
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

  private async createCustomsDraft(user: User, args: Record<string, unknown>) {
    if (user.role !== UserRole.CUSTOMER && user.role !== UserRole.ADMIN) return { error: 'forbidden' };
    const transactionType = String(args.transactionType ?? 'import') as never;
    return this.customs.createDraft(user, {
      transactionType,
      logisticsOrderId: args.logisticsOrderId ? String(args.logisticsOrderId) : undefined,
    });
  }

  private async getCustomsRequestStatus(user: User, requestId: string) {
    if (!requestId) return { error: 'requestId required' };
    try {
      const req = await this.customs.getById(user, requestId);
      return { id: req.id, referenceNumber: req.referenceNumber, status: req.status, transactionType: req.transactionType };
    } catch {
      return { error: 'not found or forbidden' };
    }
  }

  private async listMissingDocuments(user: User, args: Record<string, unknown>) {
    return this.logisticsDocuments.listMissing(
      user,
      args.customsRequestId ? String(args.customsRequestId) : undefined,
      args.freightRequestId ? String(args.freightRequestId) : undefined,
    );
  }

  private async createFreightDraft(user: User, args: Record<string, unknown>) {
    if (user.role !== UserRole.CUSTOMER && user.role !== UserRole.ADMIN) return { error: 'forbidden' };
    return this.freight.createDraft(user, {
      transportMode: String(args.transportMode ?? 'sea') as never,
      serviceType: args.serviceType ? (String(args.serviceType) as never) : undefined,
      logisticsOrderId: args.logisticsOrderId ? String(args.logisticsOrderId) : undefined,
    });
  }

  private async getFreightQuoteStatus(user: User, quoteId: string) {
    if (!quoteId) return { error: 'quoteId required' };
    const quote = await this.prisma.logisticsQuote.findUnique({
      where: { id: quoteId },
      include: { lines: true, customsRequest: true, freightRequest: true, logisticsOrder: true },
    });
    if (!quote) return { error: 'not found' };
    const customerId =
      quote.customsRequest?.customerId ?? quote.freightRequest?.customerId ?? quote.logisticsOrder?.customerId;
    if (user.role === UserRole.CUSTOMER && customerId !== user.id) return { error: 'forbidden' };
    return { id: quote.id, status: quote.status, totalAmount: quote.totalAmount, currency: quote.currency };
  }

  private async getLogisticsOrderStatus(user: User, orderId: string) {
    if (!orderId) return { error: 'orderId required' };
    try {
      const order = await this.logisticsOrders.getById(user, orderId);
      return { id: order.id, referenceNumber: order.referenceNumber, status: order.status, title: order.title };
    } catch {
      return { error: 'not found or forbidden' };
    }
  }

  private async getContainerStatus(user: User, containerNumber: string) {
    if (!containerNumber) return { error: 'containerNumber required' };
    const container = await this.prisma.containerRecord.findFirst({
      where: { containerNumber: { equals: containerNumber, mode: 'insensitive' } },
    });
    if (!container) return { error: 'not found', note: 'Container data must be entered by authorized staff.' };
    if (container.customsRequestId) {
      try {
        await this.customs.getById(user, container.customsRequestId);
      } catch {
        return { error: 'forbidden' };
      }
    }
    return container;
  }
}
