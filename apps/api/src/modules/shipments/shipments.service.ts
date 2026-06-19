/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus as PrismaPaymentStatus, Prisma } from '@prisma/client';
import { ShipmentStatus, WalletTransactionType } from '@transit-logistic/shared';
import type { User } from '@/types/user';

import { PrismaService } from '../../database/prisma.service';
import { FleetOwnershipService } from '../fleet/fleet-ownership.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import { PricingEngineService } from '../pricing/pricing-engine.service';
import { WalletLedgerService } from '../wallets/wallet-ledger.service';

import type { AcceptShipmentDto } from './dto/accept-shipment.dto';
import type { AssignShipmentDto } from './dto/assign-shipment.dto';
import type { CreateShipmentDto } from './dto/create-shipment.dto';
import type { ShipmentQueryDto } from './dto/shipment-query.dto';
import type { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ShipmentAccessService } from './shipment-access.service';
import { ShipmentCommerceService } from './shipment-commerce.service';
import {
  generateShipmentReference,
  getMaxReferenceAttempts,
  isShipmentReferenceCollision,
} from './shipment-reference.util';
import { ShipmentStateService } from './shipment-state.service';

const PAID_CANCELLATION_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.PENDING_ASSIGNMENT,
  ShipmentStatus.ASSIGNED,
];

const ACTIVE_DRIVER_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.ASSIGNED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
];

type TransitionAuditOptions = {
  eventType: string;
  note?: string;
  payload?: Record<string, unknown>;
};

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ShipmentAccessService,
    private readonly state: ShipmentStateService,
    private readonly fleetOwnership: FleetOwnershipService,
    private readonly ledger: WalletLedgerService,
    private readonly notificationDelivery: NotificationDeliveryService,
    private readonly pricingEngine: PricingEngineService,
    private readonly commerce: ShipmentCommerceService,
  ) {}

  async create(user: User, dto: CreateShipmentDto) {
    this.assertCustomer(user);
    this.validateStops(dto.stops);

    const maxAttempts = getMaxReferenceAttempts();

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const shipment = await this.prisma.$transaction(async (tx) => {
          const created = await tx.shipment.create({
            data: {
              referenceNumber: generateShipmentReference(),
              customerId: user.id,
              status: ShipmentStatus.DRAFT,
              cargoType: dto.cargoType,
              cargoDescription: dto.cargoDescription,
              weightKg: dto.weightKg,
              packageCount: dto.packageCount,
              lengthCm: dto.lengthCm,
              widthCm: dto.widthCm,
              heightCm: dto.heightCm,
              shippingMethod: dto.shippingMethod,
              isCrossBorder: dto.isCrossBorder ?? false,
              scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
              stops: {
                create: dto.stops.map((stop, index) => ({
                  sequence: index + 1,
                  address: stop.address,
                  city: stop.city,
                  latitude: stop.latitude,
                  longitude: stop.longitude,
                  stopType: stop.stopType,
                })),
              },
            },
            include: this.defaultInclude(),
          });

          await this.recordTransitionInTransaction(tx, created.id, null, ShipmentStatus.DRAFT, user.id, {
            eventType: 'shipment.created',
            note: 'Shipment created',
          });

          return created;
        });

        void this.notificationDelivery.safeNotifyShipmentCreated({
          userId: user.id,
          email: user.email,
          referenceNumber: shipment.referenceNumber,
          locale: (user.locale as 'en' | 'ar') ?? 'en',
        });

        return this.toShipmentResponse(shipment);
      } catch (error) {
        if (isShipmentReferenceCollision(error) && attempt < maxAttempts - 1) {
          continue;
        }
        throw error;
      }
    }

    throw new BadRequestException({
      code: 'SHIPMENT_REFERENCE_CONFLICT',
      message_en: 'Unable to generate a unique shipment reference. Please retry.',
      message_ar: 'تعذر إنشاء رقم مرجعي فريد للشحنة. يرجى المحاولة مرة أخرى.',
    });
  }

  async findAll(user: User, query: ShipmentQueryDto) {
    const where = await this.access.buildListFilter(user);

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { referenceNumber: { contains: query.search, mode: 'insensitive' } },
        { cargoDescription: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [shipments, total] = await this.prisma.$transaction([
      this.prisma.shipment.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return {
      data: shipments.map((shipment) => this.toShipmentResponse(shipment)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAvailable(user: User, query: ShipmentQueryDto) {
    const where = await this.access.buildAvailableFilter(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [shipments, total] = await this.prisma.$transaction([
      this.prisma.shipment.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return {
      data: shipments.map((shipment) => this.toShipmentResponse(shipment)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(user: User, shipmentId: string) {
    await this.access.assertCanView(user, shipmentId);

    const shipment = await this.prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: this.defaultInclude(),
    });

    return this.toShipmentResponse(shipment);
  }

  async update(user: User, shipmentId: string, dto: UpdateShipmentDto) {
    const shipment = await this.access.assertCanView(user, shipmentId);
    this.assertCustomer(user);

    if (shipment.customerId !== user.id) {
      throw new BadRequestException({
        code: 'SHIPMENT_ACCESS_DENIED',
        message_en: 'Only the customer can update this shipment.',
        message_ar: 'يمكن للعميل فقط تحديث هذه الشحنة.',
      });
    }

    if (shipment.status !== ShipmentStatus.DRAFT) {
      throw new BadRequestException({
        code: 'SHIPMENT_NOT_EDITABLE',
        message_en: 'Only draft shipments can be updated.',
        message_ar: 'يمكن تحديث الشحنات المسودة فقط.',
      });
    }

    if (dto.stops) {
      this.validateStops(dto.stops);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.stops) {
        await tx.shipmentStop.deleteMany({ where: { shipmentId } });
        await tx.shipmentStop.createMany({
          data: dto.stops.map((stop, index) => ({
            shipmentId,
            sequence: index + 1,
            address: stop.address,
            city: stop.city,
            latitude: stop.latitude,
            longitude: stop.longitude,
            stopType: stop.stopType,
          })),
        });
      }

      return tx.shipment.update({
        where: { id: shipmentId },
        data: {
          ...(dto.cargoType !== undefined ? { cargoType: dto.cargoType } : {}),
          ...(dto.cargoDescription !== undefined
            ? { cargoDescription: dto.cargoDescription }
            : {}),
          ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg } : {}),
          ...(dto.packageCount !== undefined ? { packageCount: dto.packageCount } : {}),
          ...(dto.lengthCm !== undefined ? { lengthCm: dto.lengthCm } : {}),
          ...(dto.widthCm !== undefined ? { widthCm: dto.widthCm } : {}),
          ...(dto.heightCm !== undefined ? { heightCm: dto.heightCm } : {}),
          ...(dto.shippingMethod !== undefined ? { shippingMethod: dto.shippingMethod } : {}),
          ...(dto.isCrossBorder !== undefined ? { isCrossBorder: dto.isCrossBorder } : {}),
          ...(dto.scheduledAt !== undefined
            ? { scheduledAt: new Date(dto.scheduledAt) }
            : {}),
        },
        include: this.defaultInclude(),
      });
    });

    return this.toShipmentResponse(updated);
  }

  async confirm(user: User, shipmentId: string) {
    await this.access.assertCanView(user, shipmentId);
    this.assertCustomer(user);

    throw new BadRequestException({
      code: 'PAYMENT_REQUIRED',
      message_en: 'Card payment is required to confirm this shipment.',
      message_ar: 'يلزم الدفع بالبطاقة لتأكيد هذه الشحنة.',
    });
  }

  async findOneResponse(user: User, shipmentId: string) {
    return this.findOne(user, shipmentId);
  }

  async getShipmentPaymentQuote(user: User, shipmentId: string) {
    const shipment = await this.access.assertCanView(user, shipmentId);
    this.assertCustomer(user);

    if (shipment.customerId !== user.id) {
      throw new BadRequestException({
        code: 'SHIPMENT_ACCESS_DENIED',
        message_en: 'Only the customer can pay for this shipment.',
        message_ar: 'يمكن للعميل فقط الدفع مقابل هذه الشحنة.',
      });
    }

    if (shipment.status !== ShipmentStatus.DRAFT) {
      throw new BadRequestException({
        code: 'SHIPMENT_NOT_PAYABLE',
        message_en: 'Only draft shipments can be paid.',
        message_ar: 'يمكن دفع الشحنات في حالة المسودة فقط.',
      });
    }

    const pricing = await this.calculateShipmentPrice(shipmentId);

    return {
      shipmentId,
      referenceNumber: shipment.referenceNumber,
      baseAmount: pricing.baseAmount.toFixed(2),
      platformFee: pricing.platformFee.toFixed(2),
      totalAmount: pricing.totalAmount.toFixed(2),
      currency: 'SAR',
      breakdown: pricing.breakdown,
    };
  }

  async confirmAfterCardPayment(user: User, shipmentId: string, paymentIntentId: string) {
    const shipment = await this.access.assertCanView(user, shipmentId);
    this.assertCustomer(user);

    if (shipment.customerId !== user.id) {
      throw new BadRequestException({
        code: 'SHIPMENT_ACCESS_DENIED',
        message_en: 'Only the customer can confirm this shipment.',
        message_ar: 'يمكن للعميل فقط تأكيد هذه الشحنة.',
      });
    }

    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId },
    });

    if (
      !paymentIntent ||
      paymentIntent.shipmentId !== shipmentId ||
      paymentIntent.customerId !== user.id
    ) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_FOUND',
        message_en: 'A successful card payment is required before confirmation.',
        message_ar: 'يلزم دفع ناجح بالبطاقة قبل التأكيد.',
      });
    }

    if (paymentIntent.status !== PrismaPaymentStatus.succeeded) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_COMPLETED',
        message_en: 'Card payment has not completed successfully.',
        message_ar: 'لم يكتمل الدفع بالبطاقة بنجاح.',
      });
    }

    this.state.assertTransition(shipment.status, ShipmentStatus.PENDING_ASSIGNMENT);

    const pricing = await this.calculateShipmentPrice(shipmentId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockShipmentForUpdate(tx, shipmentId);

      if (locked.customerId !== user.id) {
        throw new BadRequestException({
          code: 'SHIPMENT_ACCESS_DENIED',
          message_en: 'Only the customer can confirm this shipment.',
          message_ar: 'يمكن للعميل فقط تأكيد هذه الشحنة.',
        });
      }

      if (locked.status === ShipmentStatus.PENDING_ASSIGNMENT) {
        return tx.shipment.findUniqueOrThrow({
          where: { id: shipmentId },
          include: this.defaultInclude(),
        });
      }

      if (locked.status !== ShipmentStatus.DRAFT) {
        throw new BadRequestException({
          code: 'SHIPMENT_CONFIRM_CONFLICT',
          message_en: 'Shipment can no longer be confirmed.',
          message_ar: 'لم يعد من الممكن تأكيد هذه الشحنة.',
        });
      }

      await tx.priceCalculation.upsert({
        where: { shipmentId },
        create: {
          shipmentId,
          pricingRuleId: pricing.pricingRuleId,
          baseAmount: pricing.baseAmount,
          platformFee: pricing.platformFee,
          totalAmount: pricing.totalAmount,
          breakdown: pricing.breakdown as unknown as Prisma.InputJsonValue,
        },
        update: {
          pricingRuleId: pricing.pricingRuleId,
          baseAmount: pricing.baseAmount,
          platformFee: pricing.platformFee,
          totalAmount: pricing.totalAmount,
          breakdown: pricing.breakdown as unknown as Prisma.InputJsonValue,
        },
      });

      const transitioned = await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: ShipmentStatus.PENDING_ASSIGNMENT },
        include: this.defaultInclude(),
      });

      await this.recordTransitionInTransaction(
        tx,
        shipmentId,
        ShipmentStatus.DRAFT,
        ShipmentStatus.PENDING_ASSIGNMENT,
        user.id,
        {
          eventType: 'shipment.confirmed',
          note: 'Shipment confirmed after card payment',
          payload: { paymentIntentId },
        },
      );

      return transitioned;
    });

    if (updated.status === ShipmentStatus.PENDING_ASSIGNMENT) {
      void this.dispatchShipmentNotifications(updated, ShipmentStatus.DRAFT);
    }

    void this.commerce.ensureContractAndInvoice(
      shipmentId,
      paymentIntentId,
      paymentIntent.amount.toString(),
      paymentIntent.currency,
    );

    return this.toShipmentResponse(updated);
  }

  async cancel(user: User, shipmentId: string) {
    const shipment = await this.access.assertCanView(user, shipmentId);

    const canCancel =
      (user.role === 'customer' && shipment.customerId === user.id) ||
      this.access.isAdmin(user);

    if (!canCancel) {
      throw new BadRequestException({
        code: 'SHIPMENT_ACCESS_DENIED',
        message_en: 'You cannot cancel this shipment.',
        message_ar: 'لا يمكنك إلغاء هذه الشحنة.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockShipmentForUpdate(tx, shipmentId);

      if (locked.status === ShipmentStatus.CANCELLED) {
        const didRefund = await this.refundCustomerInTransaction(
          tx,
          shipmentId,
          locked.referenceNumber,
          locked.customerId,
          user.id,
        );

        if (didRefund) {
          await this.recordTransitionInTransaction(
            tx,
            shipmentId,
            ShipmentStatus.CANCELLED,
            ShipmentStatus.CANCELLED,
            user.id,
            { eventType: 'shipment.refunded', note: 'Customer refunded after cancellation' },
          );
        }

        return tx.shipment.findUniqueOrThrow({
          where: { id: shipmentId },
          include: this.defaultInclude(),
        });
      }

      this.state.assertTransition(locked.status, ShipmentStatus.CANCELLED);
      const previousStatus = locked.status;

      const cancelled = await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: ShipmentStatus.CANCELLED },
        include: this.defaultInclude(),
      });

      await this.recordTransitionInTransaction(
        tx,
        shipmentId,
        previousStatus,
        ShipmentStatus.CANCELLED,
        user.id,
        { eventType: 'shipment.cancelled', note: 'Shipment cancelled' },
      );

      if (this.isPaidCancellationStatus(previousStatus)) {
        const didRefund = await this.refundCustomerInTransaction(
          tx,
          shipmentId,
          locked.referenceNumber,
          locked.customerId,
          user.id,
        );

        if (didRefund) {
          await this.recordTransitionInTransaction(
            tx,
            shipmentId,
            ShipmentStatus.CANCELLED,
            ShipmentStatus.CANCELLED,
            user.id,
            { eventType: 'shipment.refunded', note: 'Customer refunded after cancellation' },
          );
        }
      }

      return cancelled;
    });

    if (updated.status === ShipmentStatus.CANCELLED) {
      void this.dispatchShipmentNotifications(updated, shipment.status);
    }

    return this.toShipmentResponse(updated);
  }

  async accept(user: User, shipmentId: string, dto: AcceptShipmentDto) {
    const shipment = await this.access.assertCanView(user, shipmentId);
    const fleetOwner = await this.fleetOwnership.requireFleetOwner(user);

    if (shipment.status !== ShipmentStatus.PENDING_ASSIGNMENT) {
      throw new BadRequestException({
        code: 'SHIPMENT_NOT_AVAILABLE',
        message_en: 'Shipment is not available for assignment.',
        message_ar: 'الشحنة غير متاحة للتعيين.',
      });
    }

    await this.fleetOwnership.assertVehicleOwnership(user, dto.vehicleId);
    const driver = await this.fleetOwnership.assertDriverOwnership(user, dto.driverId);

    this.state.assertTransition(shipment.status, ShipmentStatus.ASSIGNED);

    const updated = await this.prisma.$transaction((tx) =>
      this.assignShipmentInTransaction(
        tx,
        shipmentId,
        {
          fleetOwnerId: fleetOwner.id,
          vehicleId: dto.vehicleId,
          driverUserId: driver.userId,
        },
        user.id,
        {
          eventType: 'shipment.assigned',
          note: 'Shipment assigned to fleet',
          payload: { vehicleId: dto.vehicleId, driverId: driver.userId },
        },
      ),
    );

    void this.dispatchShipmentNotifications(updated, ShipmentStatus.PENDING_ASSIGNMENT);

    return this.toShipmentResponse(updated);
  }

  async adminAssign(user: User, shipmentId: string, dto: AssignShipmentDto) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException({
        code: 'SHIPMENT_NOT_FOUND',
        message_en: 'Shipment not found.',
        message_ar: 'الشحنة غير موجودة.',
      });
    }

    if (shipment.status !== ShipmentStatus.PENDING_ASSIGNMENT) {
      throw new BadRequestException({
        code: 'SHIPMENT_NOT_AVAILABLE',
        message_en: 'Shipment is not available for assignment.',
        message_ar: 'الشحنة غير متاحة للتعيين.',
      });
    }

    const fleetOwner = await this.prisma.fleetOwner.findUnique({
      where: { id: dto.fleetOwnerId },
    });

    if (!fleetOwner) {
      throw new NotFoundException({
        code: 'FLEET_OWNER_NOT_FOUND',
        message_en: 'Fleet owner not found.',
        message_ar: 'مالك الأسطول غير موجود.',
      });
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, fleetOwnerId: fleetOwner.id, isActive: true },
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: 'VEHICLE_NOT_FOUND',
        message_en: 'Vehicle not found for this fleet owner.',
        message_ar: 'المركبة غير موجودة لمالك الأسطول هذا.',
      });
    }

    const driver = await this.prisma.driverProfile.findFirst({
      where: { id: dto.driverId, fleetOwnerId: fleetOwner.id },
    });

    if (!driver) {
      throw new NotFoundException({
        code: 'DRIVER_NOT_FOUND',
        message_en: 'Driver not found for this fleet owner.',
        message_ar: 'السائق غير موجود لمالك الأسطول هذا.',
      });
    }

    this.state.assertTransition(shipment.status, ShipmentStatus.ASSIGNED);

    const updated = await this.prisma.$transaction((tx) =>
      this.assignShipmentInTransaction(
        tx,
        shipmentId,
        {
          fleetOwnerId: fleetOwner.id,
          vehicleId: dto.vehicleId,
          driverUserId: driver.userId,
        },
        user.id,
        {
          eventType: 'shipment.assigned',
          note: 'Shipment assigned by admin',
          payload: {
            fleetOwnerId: dto.fleetOwnerId,
            vehicleId: dto.vehicleId,
            driverId: driver.userId,
          },
        },
      ),
    );

    void this.dispatchShipmentNotifications(updated, ShipmentStatus.PENDING_ASSIGNMENT);

    return this.toShipmentResponse(updated);
  }

  async adminUpdateStatus(user: User, shipmentId: string, status: ShipmentStatus, note?: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { fleetOwner: true },
    });

    if (!shipment) {
      throw new NotFoundException({
        code: 'SHIPMENT_NOT_FOUND',
        message_en: 'Shipment not found.',
        message_ar: 'الشحنة غير موجودة.',
      });
    }

    if (shipment.status === status) {
      const current = await this.prisma.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: this.defaultInclude(),
      });
      return this.toShipmentResponse(current);
    }

    this.state.assertTransition(shipment.status, status);

    const previousStatus = shipment.status;
    const timestampPatch: Prisma.ShipmentUpdateInput = {};

    if (status === ShipmentStatus.PICKED_UP) {
      timestampPatch.pickedUpAt = new Date();
    }

    if (status === ShipmentStatus.DELIVERED) {
      timestampPatch.deliveredAt = new Date();
    }

    if (status === ShipmentStatus.COMPLETED) {
      timestampPatch.completedAt = new Date();
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockShipmentForUpdate(tx, shipmentId);

      if (locked.status === status) {
        return tx.shipment.findUniqueOrThrow({
          where: { id: shipmentId },
          include: this.defaultInclude(),
        });
      }

      this.state.assertTransition(locked.status, status);

      const transitioned = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status,
          ...timestampPatch,
        },
        include: this.defaultInclude(),
      });

      await this.recordTransitionInTransaction(
        tx,
        shipmentId,
        previousStatus,
        status,
        user.id,
        {
          eventType: 'shipment.status_updated',
          note: note ?? `Status updated to ${status} by admin`,
          payload: { status, updatedBy: 'admin' },
        },
      );

      if (status === ShipmentStatus.COMPLETED) {
        await this.creditFleetOwnerInTransaction(tx, transitioned);
      }

      return transitioned;
    });

    void this.dispatchShipmentNotifications(updated, previousStatus);

    if (status === ShipmentStatus.COMPLETED && updated.fleetOwner?.userId) {
      void this.notifyWalletByIdempotencyKey(
        `shipment-earning-${updated.id}`,
        updated.fleetOwner.userId,
      );
    }

    return this.toShipmentResponse(updated);
  }

  async exportShipmentsCsv(user: User, query: ShipmentQueryDto) {
    const result = await this.findAll(user, { ...query, page: 1, limit: 1000 });
    const header = ['Reference', 'Status', 'Cargo', 'Created At', 'Customer ID'];
    const rows = result.data.map((shipment) => [
      shipment.referenceNumber,
      shipment.status,
      shipment.cargoDescription,
      shipment.createdAt,
      shipment.customerId,
    ]);

    return [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  async exportShipmentsPdf(user: User, query: ShipmentQueryDto) {
    const result = await this.findAll(user, { ...query, page: 1, limit: 1000 });
    const lines = [
      'Transit Logistic - Shipments Export',
      `Generated: ${new Date().toISOString()}`,
      '',
      ...result.data.map(
        (shipment) =>
          `${shipment.referenceNumber} | ${shipment.status} | ${shipment.cargoDescription}`,
      ),
    ];

    return Buffer.from(this.buildSimplePdf(lines), 'utf8');
  }

  toPublicShipmentResponse(
    shipment: Prisma.ShipmentGetPayload<{
      include: {
        stops: true;
        priceCalculation: true;
        fleetOwner: true;
        vehicle: true;
      };
    }>,
  ) {
    return this.toShipmentResponse(shipment);
  }

  async getActiveForDriver(user: User) {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        driverId: user.id,
        status: {
          in: [
            ShipmentStatus.ASSIGNED,
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.IN_TRANSIT,
          ],
        },
      },
      include: this.defaultInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return shipment ? this.toShipmentResponse(shipment) : null;
  }

  async driverPickup(user: User, shipmentId: string) {
    await this.assertDriverShipment(user, shipmentId);

    const updated = await this.prisma.$transaction((tx) =>
      this.transitionDriverShipmentInTransaction(
        tx,
        shipmentId,
        user.id,
        ShipmentStatus.PICKED_UP,
        { pickedUpAt: new Date() },
        { eventType: 'shipment.picked_up', note: 'Shipment picked up' },
      ),
    );

    void this.dispatchShipmentNotifications(updated, ShipmentStatus.ASSIGNED);

    return this.toShipmentResponse(updated);
  }

  async driverStartTransit(user: User, shipmentId: string) {
    await this.assertDriverShipment(user, shipmentId);

    const updated = await this.prisma.$transaction((tx) =>
      this.transitionDriverShipmentInTransaction(
        tx,
        shipmentId,
        user.id,
        ShipmentStatus.IN_TRANSIT,
        {},
        { eventType: 'shipment.in_transit', note: 'Shipment in transit' },
      ),
    );

    void this.dispatchShipmentNotifications(updated, ShipmentStatus.PICKED_UP);

    return this.toShipmentResponse(updated);
  }

  async driverDeliver(user: User, shipmentId: string) {
    await this.assertDriverShipment(user, shipmentId);

    const updated = await this.prisma.$transaction((tx) =>
      this.transitionDriverShipmentInTransaction(
        tx,
        shipmentId,
        user.id,
        ShipmentStatus.DELIVERED,
        { deliveredAt: new Date() },
        { eventType: 'shipment.delivered', note: 'Shipment delivered' },
      ),
    );

    void this.dispatchShipmentNotifications(updated, ShipmentStatus.IN_TRANSIT);

    return this.toShipmentResponse(updated);
  }

  async complete(user: User, shipmentId: string) {
    const shipment = await this.access.assertCanView(user, shipmentId);

    const canComplete =
      (user.role === 'customer' && shipment.customerId === user.id) ||
      this.access.isAdmin(user);

    if (!canComplete) {
      throw new BadRequestException({
        code: 'SHIPMENT_ACCESS_DENIED',
        message_en: 'Only the customer can complete this shipment.',
        message_ar: 'يمكن للعميل فقط إكمال هذه الشحنة.',
      });
    }

    if (shipment.status !== ShipmentStatus.DELIVERED) {
      throw new BadRequestException({
        code: 'SHIPMENT_NOT_DELIVERED',
        message_en: 'Shipment can only be completed after delivery.',
        message_ar: 'يمكن إكمال الشحنة فقط بعد التسليم.',
      });
    }

    this.state.assertTransition(shipment.status, ShipmentStatus.COMPLETED);

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.lockShipmentForUpdate(tx, shipmentId);

      if (locked.status === ShipmentStatus.COMPLETED) {
        const current = await tx.shipment.findUniqueOrThrow({
          where: { id: shipmentId },
          include: this.defaultInclude(),
        });
        await this.creditFleetOwnerInTransaction(tx, current);
        return current;
      }

      if (locked.status !== ShipmentStatus.DELIVERED) {
        throw new BadRequestException({
          code: 'SHIPMENT_NOT_DELIVERED',
          message_en: 'Shipment can only be completed after delivery.',
          message_ar: 'يمكن إكمال الشحنة فقط بعد التسليم.',
        });
      }

      const completed = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: this.defaultInclude(),
      });

      await this.creditFleetOwnerInTransaction(tx, completed);

      await this.recordTransitionInTransaction(
        tx,
        shipmentId,
        ShipmentStatus.DELIVERED,
        ShipmentStatus.COMPLETED,
        user.id,
        { eventType: 'shipment.completed', note: 'Shipment completed' },
      );

      return completed;
    });

    void this.dispatchShipmentNotifications(updated, ShipmentStatus.DELIVERED);

    if (updated.fleetOwner?.userId) {
      void this.notifyWalletByIdempotencyKey(
        `shipment-earning-${updated.id}`,
        updated.fleetOwner.userId,
      );
    }

    return this.toShipmentResponse(updated);
  }

  async getTimeline(user: User, shipmentId: string) {
    await this.access.assertCanView(user, shipmentId);

    const [history, events] = await this.prisma.$transaction([
      this.prisma.shipmentStatusHistory.findMany({
        where: { shipmentId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.shipmentEvent.findMany({
        where: { shipmentId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return { history, events };
  }

  private async assertDriverShipment(user: User, shipmentId: string) {
    const shipment = await this.access.assertCanView(user, shipmentId);

    if (shipment.driverId !== user.id) {
      throw new BadRequestException({
        code: 'SHIPMENT_ACCESS_DENIED',
        message_en: 'Only the assigned driver can perform this action.',
        message_ar: 'يمكن للسائق المعين فقط تنفيذ هذا الإجراء.',
      });
    }

    return shipment;
  }

  private async transitionDriverShipmentInTransaction(
    tx: Prisma.TransactionClient,
    shipmentId: string,
    driverUserId: string,
    toStatus: ShipmentStatus,
    extraData: Prisma.ShipmentUpdateInput,
    audit: TransitionAuditOptions,
  ) {
    const locked = await this.lockShipmentForUpdate(tx, shipmentId);

    if (locked.driverId !== driverUserId) {
      throw new BadRequestException({
        code: 'SHIPMENT_ACCESS_DENIED',
        message_en: 'Only the assigned driver can perform this action.',
        message_ar: 'يمكن للسائق المعين فقط تنفيذ هذا الإجراء.',
      });
    }

    if (locked.status === toStatus) {
      return tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: this.defaultInclude(),
      });
    }

    this.state.assertTransition(locked.status, toStatus);

    const transition = await tx.shipment.updateMany({
      where: { id: shipmentId, status: locked.status },
      data: {
        status: toStatus,
        ...extraData,
      },
    });

    if (transition.count === 0) {
      const current = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
      });

      if (current.status === toStatus) {
        return tx.shipment.findUniqueOrThrow({
          where: { id: shipmentId },
          include: this.defaultInclude(),
        });
      }

      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message_en: `Cannot transition shipment from ${current.status} to ${toStatus}.`,
        message_ar: `لا يمكن تغيير حالة الشحنة من ${current.status} إلى ${toStatus}.`,
      });
    }

    await this.recordTransitionInTransaction(
      tx,
      shipmentId,
      locked.status,
      toStatus,
      driverUserId,
      audit,
    );

    return tx.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: this.defaultInclude(),
    });
  }

  private async assignShipmentInTransaction(
    tx: Prisma.TransactionClient,
    shipmentId: string,
    assignment: {
      fleetOwnerId: string;
      vehicleId: string;
      driverUserId: string;
    },
    actorId: string,
    audit: TransitionAuditOptions,
  ) {
    const locked = await this.lockShipmentForUpdate(tx, shipmentId);

    if (locked.status !== ShipmentStatus.PENDING_ASSIGNMENT) {
      throw new BadRequestException({
        code: 'SHIPMENT_NOT_AVAILABLE',
        message_en: 'Shipment is no longer available for assignment.',
        message_ar: 'الشحنة لم تعد متاحة للتعيين.',
      });
    }

    const vehicle = await tx.vehicle.findFirst({
      where: {
        id: assignment.vehicleId,
        fleetOwnerId: assignment.fleetOwnerId,
        isActive: true,
      },
    });

    if (!vehicle) {
      throw new BadRequestException({
        code: 'VEHICLE_INACTIVE',
        message_en: 'Vehicle is not active or not available for this fleet.',
        message_ar: 'المركبة غير نشطة أو غير متاحة لهذا الأسطول.',
      });
    }

    await this.assertDriverAvailableInTransaction(
      tx,
      assignment.driverUserId,
      shipmentId,
    );

    const updated = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: ShipmentStatus.ASSIGNED,
        fleetOwnerId: assignment.fleetOwnerId,
        vehicleId: assignment.vehicleId,
        driverId: assignment.driverUserId,
      },
      include: this.defaultInclude(),
    });

    await this.recordTransitionInTransaction(
      tx,
      shipmentId,
      ShipmentStatus.PENDING_ASSIGNMENT,
      ShipmentStatus.ASSIGNED,
      actorId,
      audit,
    );

    return updated;
  }

  private async lockShipmentForUpdate(
    tx: Prisma.TransactionClient,
    shipmentId: string,
  ) {
    const lockResult = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM shipments WHERE id = ${shipmentId}::uuid FOR UPDATE
    `;

    if (lockResult.length === 0) {
      throw new NotFoundException({
        code: 'SHIPMENT_NOT_FOUND',
        message_en: 'Shipment not found.',
        message_ar: 'الشحنة غير موجودة.',
      });
    }

    return tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  }

  private async lockDriverForUpdate(
    tx: Prisma.TransactionClient,
    driverUserId: string,
  ) {
    const lockResult = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM driver_profiles WHERE user_id = ${driverUserId}::uuid FOR UPDATE
    `;

    if (lockResult.length === 0) {
      throw new BadRequestException({
        code: 'DRIVER_NOT_FOUND',
        message_en: 'Driver not found.',
        message_ar: 'السائق غير موجود.',
      });
    }
  }

  private async assertDriverAvailableInTransaction(
    tx: Prisma.TransactionClient,
    driverUserId: string,
    excludeShipmentId?: string,
  ) {
    await this.lockDriverForUpdate(tx, driverUserId);

    const driver = await tx.driverProfile.findUnique({
      where: { userId: driverUserId },
    });

    if (!driver?.isAvailable) {
      throw new BadRequestException({
        code: 'DRIVER_NOT_AVAILABLE',
        message_en: 'Driver is not available.',
        message_ar: 'السائق غير متاح.',
      });
    }

    const activeShipmentWhere: Prisma.ShipmentWhereInput = {
      driverId: driverUserId,
      status: { in: ACTIVE_DRIVER_STATUSES },
    };

    if (excludeShipmentId) {
      activeShipmentWhere.id = { not: excludeShipmentId };
    }

    const activeShipment = await tx.shipment.findFirst({
      where: activeShipmentWhere,
    });

    if (activeShipment) {
      throw new BadRequestException({
        code: 'DRIVER_BUSY',
        message_en: 'Driver is already assigned to an active shipment.',
        message_ar: 'السائق معين بالفعل على شحنة نشطة.',
      });
    }
  }

  private async creditFleetOwnerInTransaction(
    tx: Prisma.TransactionClient,
    shipment: Prisma.ShipmentGetPayload<{
      include: { priceCalculation: true; fleetOwner: true };
    }>,
  ) {
    if (!shipment.fleetOwnerId || !shipment.priceCalculation) {
      return;
    }

    const fleetOwner = await tx.fleetOwner.findUnique({
      where: { id: shipment.fleetOwnerId },
    });

    if (!fleetOwner) {
      return;
    }

    const total = new Prisma.Decimal(shipment.priceCalculation.totalAmount);
    const platformFee = new Prisma.Decimal(shipment.priceCalculation.platformFee);
    const earning = total.minus(platformFee);
    const wallet = await this.ledger.getOrCreateWallet(fleetOwner.userId, tx);

    await this.ledger.credit(
      {
        walletId: wallet.id,
        amount: earning,
        type: WalletTransactionType.ADJUSTMENT,
        idempotencyKey: `shipment-earning-${shipment.id}`,
        description: `Earning for shipment ${shipment.referenceNumber}`,
        referenceType: 'shipment',
        referenceId: shipment.id,
      },
      tx,
    );
  }

  private async refundCustomerInTransaction(
    tx: Prisma.TransactionClient,
    shipmentId: string,
    referenceNumber: string,
    _customerId: string,
    _actorId: string,
  ): Promise<boolean> {
    const payment = await tx.paymentIntent.findFirst({
      where: {
        shipmentId,
        status: PrismaPaymentStatus.succeeded,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return false;
    }

    if (payment.status === PrismaPaymentStatus.refunded) {
      return false;
    }

    await tx.paymentIntent.update({
      where: { id: payment.id },
      data: { status: PrismaPaymentStatus.refunded },
    });

    await tx.paymentEvent.create({
      data: {
        paymentIntentId: payment.id,
        eventType: 'payment.refunded',
        payload: {
          shipmentId,
          referenceNumber,
        },
      },
    });

    return true;
  }

  private isPaidCancellationStatus(status: ShipmentStatus) {
    return PAID_CANCELLATION_STATUSES.includes(status);
  }

  private async recordTransitionInTransaction(
    tx: Prisma.TransactionClient,
    shipmentId: string,
    fromStatus: ShipmentStatus | null,
    toStatus: ShipmentStatus,
    actorId: string,
    options: TransitionAuditOptions,
  ) {
    await tx.shipmentStatusHistory.create({
      data: {
        shipmentId,
        fromStatus,
        toStatus,
        actorId,
        note: options.note,
      },
    });

    await tx.shipmentEvent.create({
      data: {
        shipmentId,
        eventType: options.eventType,
        actorId,
        payload: (options.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  private async calculateShipmentPrice(shipmentId: string) {
    const stops = await this.prisma.shipmentStop.findMany({
      where: { shipmentId },
      orderBy: { sequence: 'asc' },
    });

    if (stops.length < 2) {
      throw new BadRequestException({
        code: 'INVALID_STOPS',
        message_en: 'At least pickup and delivery stops are required for pricing.',
        message_ar: 'مطلوب على الأقل محطتا الاستلام والتسليم لحساب السعر.',
      });
    }

    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { vehicle: true },
    });

    return this.pricingEngine.calculate({
      stops: stops.map((stop) => ({
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
        sequence: stop.sequence,
      })),
      vehicleType: shipment?.vehicle?.vehicleType,
    });
  }

  private validateStops(stops: CreateShipmentDto['stops']) {
    if (stops.length < 2) {
      throw new BadRequestException({
        code: 'INVALID_STOPS',
        message_en: 'At least pickup and delivery stops are required.',
        message_ar: 'مطلق على الأقل محطتا الاستلام والتسليم.',
      });
    }

    const hasPickup = stops.some((stop) => stop.stopType === 'pickup');
    const hasDelivery = stops.some((stop) => stop.stopType === 'delivery');

    if (!hasPickup || !hasDelivery) {
      throw new BadRequestException({
        code: 'INVALID_STOPS',
        message_en: 'Shipment must include one pickup and one delivery stop.',
        message_ar: 'يجب أن تتضمن الشحنة محطة استلام ومحطة تسليم.',
      });
    }
  }

  private assertCustomer(user: User) {
    if (user.role !== 'customer' && !this.access.isAdmin(user)) {
      throw new BadRequestException({
        code: 'CUSTOMER_ONLY',
        message_en: 'Only customers can perform this action.',
        message_ar: 'يمكن للعملاء فقط تنفيذ هذا الإجراء.',
      });
    }
  }

  private defaultInclude() {
    return {
      stops: { orderBy: { sequence: 'asc' as const } },
      priceCalculation: true,
      fleetOwner: true,
      vehicle: true,
    };
  }

  private dispatchShipmentNotifications(
    shipment: Prisma.ShipmentGetPayload<{ include: { fleetOwner: true } }>,
    fromStatus: ShipmentStatus | null,
  ) {
    void this.notificationDelivery.safeNotifyShipmentStatusChange({
      shipmentId: shipment.id,
      referenceNumber: shipment.referenceNumber,
      customerId: shipment.customerId,
      driverId: shipment.driverId,
      fleetOwnerUserId: shipment.fleetOwner?.userId ?? null,
      fromStatus,
      toStatus: shipment.status,
    });

    if (shipment.status === ShipmentStatus.PENDING_ASSIGNMENT) {
      void this.notificationDelivery.safeNotifyAdminsNewShipment({
        shipmentId: shipment.id,
        referenceNumber: shipment.referenceNumber,
        customerId: shipment.customerId,
      });
    }
  }

  private async notifyWalletByIdempotencyKey(idempotencyKey: string, userId: string) {
    const transaction = await this.prisma.walletTransaction.findUnique({
      where: { idempotencyKey },
      include: { wallet: true },
    });

    if (!transaction || transaction.wallet.userId !== userId) {
      return;
    }

    void this.notificationDelivery.safeNotifyWalletTransaction({
      userId,
      transactionId: transaction.id,
      transactionType: transaction.type,
      amount: transaction.amount.toString(),
      balanceAfter: transaction.balanceAfter.toString(),
      referenceType: transaction.referenceType,
      referenceId: transaction.referenceId,
    });
  }

  private buildSimplePdf(lines: string[]) {
    const escaped = lines
      .map((line, index) => `(${index * 14 + 50}) Td (${this.escapePdfText(line)}) Tj T*`)
      .join('\n');

    return `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${escaped.length + 60}>>stream
BT /F1 10 Tf 50 750 Td
${escaped}
ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF`;
  }

  private escapePdfText(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  private toShipmentResponse(
    shipment: Prisma.ShipmentGetPayload<{
      include: {
        stops: true;
        priceCalculation: true;
        fleetOwner: true;
        vehicle: true;
      };
    }>,
  ) {
    return {
      id: shipment.id,
      referenceNumber: shipment.referenceNumber,
      customerId: shipment.customerId,
      fleetOwnerId: shipment.fleetOwnerId,
      driverId: shipment.driverId,
      vehicleId: shipment.vehicleId,
      status: shipment.status,
      cargoType: shipment.cargoType,
      cargoDescription: shipment.cargoDescription,
      weightKg: shipment.weightKg?.toString() ?? null,
      packageCount: shipment.packageCount,
      lengthCm: shipment.lengthCm?.toString() ?? null,
      widthCm: shipment.widthCm?.toString() ?? null,
      heightCm: shipment.heightCm?.toString() ?? null,
      shippingMethod: shipment.shippingMethod,
      isCrossBorder: shipment.isCrossBorder,
      scheduledAt: shipment.scheduledAt,
      pickedUpAt: shipment.pickedUpAt,
      deliveredAt: shipment.deliveredAt,
      completedAt: shipment.completedAt,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
      stops: shipment.stops,
      pricing: shipment.priceCalculation
        ? {
            baseAmount: shipment.priceCalculation.baseAmount.toString(),
            platformFee: shipment.priceCalculation.platformFee.toString(),
            totalAmount: shipment.priceCalculation.totalAmount.toString(),
            currency: shipment.priceCalculation.currency,
            breakdown: shipment.priceCalculation.breakdown,
          }
        : null,
      fleetOwner: shipment.fleetOwner,
      vehicle: shipment.vehicle,
    };
  }
}
