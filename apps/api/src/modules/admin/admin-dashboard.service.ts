/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */

import { Injectable } from '@nestjs/common';

import {

  NotificationChannel,

  PaymentStatus,

  PayoutRequestStatus,

  ShipmentStatus,

} from '@prisma/client';



import { PrismaService } from '../../database/prisma.service';

import { ShipmentsService } from '../shipments/shipments.service';



@Injectable()

export class AdminDashboardService {

  constructor(

    private readonly prisma: PrismaService,

    private readonly shipments: ShipmentsService,

  ) {}



  async getMetrics(adminUserId: string) {

    const pendingPaymentStatuses = [

      PaymentStatus.requires_payment_method,

      PaymentStatus.requires_confirmation,

      PaymentStatus.processing,

    ];



    const [

      total,

      draft,

      pendingAssignment,

      assigned,

      pickedUp,

      inTransit,

      delivered,

      completed,

      cancelled,

      revenueAggregate,

      pendingPaymentsCount,

      pendingPaymentsAmount,

      fleetOwnersCount,

      driversCount,

      vehiclesCount,

      pendingPayoutRequests,

      recent,

      latestNotifications,

    ] = await Promise.all([

      this.prisma.shipment.count(),

      this.prisma.shipment.count({ where: { status: ShipmentStatus.draft } }),

      this.prisma.shipment.count({ where: { status: ShipmentStatus.pending_assignment } }),

      this.prisma.shipment.count({ where: { status: ShipmentStatus.assigned } }),

      this.prisma.shipment.count({ where: { status: ShipmentStatus.picked_up } }),

      this.prisma.shipment.count({ where: { status: ShipmentStatus.in_transit } }),

      this.prisma.shipment.count({ where: { status: ShipmentStatus.delivered } }),

      this.prisma.shipment.count({ where: { status: ShipmentStatus.completed } }),

      this.prisma.shipment.count({ where: { status: ShipmentStatus.cancelled } }),

      this.prisma.paymentIntent.aggregate({

        where: { status: PaymentStatus.succeeded },

        _sum: { amount: true },

      }),

      this.prisma.paymentIntent.count({

        where: { status: { in: pendingPaymentStatuses } },

      }),

      this.prisma.paymentIntent.aggregate({

        where: { status: { in: pendingPaymentStatuses } },

        _sum: { amount: true },

      }),

      this.prisma.fleetOwner.count(),

      this.prisma.driverProfile.count(),

      this.prisma.vehicle.count(),

      this.prisma.payoutRequest.count({ where: { status: PayoutRequestStatus.pending } }),

      this.prisma.shipment.findMany({

        orderBy: { createdAt: 'desc' },

        take: 8,

        include: {

          stops: { orderBy: { sequence: 'asc' } },

          priceCalculation: true,

          fleetOwner: true,

          vehicle: true,

        },

      }),

      this.prisma.notification.findMany({

        where: {

          userId: adminUserId,

          channel: NotificationChannel.in_app,

        },

        orderBy: { createdAt: 'desc' },

        take: 8,

      }),

    ]);



    const inProgress = pickedUp + inTransit + delivered;

    const active = assigned + inProgress;

    const revenue = revenueAggregate._sum.amount?.toString() ?? '0';

    const pendingPaymentsTotal = pendingPaymentsAmount._sum.amount?.toString() ?? '0';



    return {

      shipments: {

        total,

        draft,

        pending_assignment: pendingAssignment,

        assigned,

        active,

        in_progress: inProgress,

        completed,

        cancelled,

      },

      revenue: {

        total: revenue,

        currency: 'OMR',

      },

      pendingPayments: {

        count: pendingPaymentsCount,

        total: pendingPaymentsTotal,

        currency: 'OMR',

      },

      fleet: {

        owners: fleetOwnersCount,

        drivers: driversCount,

        vehicles: vehiclesCount,

      },

      pendingPayoutRequests,

      recentShipments: recent.map((shipment) => this.shipments.toPublicShipmentResponse(shipment)),

      latestNotifications: latestNotifications.map((notification) => ({

        id: notification.id,

        titleEn: notification.titleEn,

        titleAr: notification.titleAr,

        bodyEn: notification.bodyEn,

        bodyAr: notification.bodyAr,

        isRead: notification.isRead,

        createdAt: notification.createdAt,

      })),

    };

  }

}

