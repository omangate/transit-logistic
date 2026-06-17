import { randomBytes } from 'crypto';

import { Injectable, ForbiddenException } from '@nestjs/common';
import type { Prisma, Shipment } from '@prisma/client';

import { type PrismaService } from '../../database/prisma.service';

type ShipmentWithDetails = Shipment & {
  stops: Array<{
    address: string;
    city: string;
    stopType: string;
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
  }>;
  priceCalculation: {
    baseAmount: Prisma.Decimal;
    platformFee: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    currency: string;
  } | null;
  customer: {
    email: string;
    customerProfile: { fullName: string; company: string | null } | null;
  };
};

@Injectable()
export class ShipmentCommerceService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureContractAndInvoice(
    shipmentId: string,
    paymentIntentId: string,
    amount: string,
    currency: string,
  ) {
    const shipment = await this.prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: {
        stops: { orderBy: { sequence: 'asc' } },
        priceCalculation: true,
        customer: { include: { customerProfile: true } },
      },
    });

    const contract = await this.ensureContract(shipment as ShipmentWithDetails, amount, currency);
    const invoice = await this.ensureInvoice(
      shipment as ShipmentWithDetails,
      paymentIntentId,
      amount,
      currency,
    );

    return { contract, invoice };
  }

  private async ensureContract(shipment: ShipmentWithDetails, amount: string, currency: string) {
    const existing = await this.prisma.shipmentContract.findUnique({
      where: { shipmentId: shipment.id },
    });

    if (existing) {
      return existing;
    }

    const pickup = shipment.stops.find((stop) => stop.stopType === 'pickup');
    const delivery = shipment.stops.find((stop) => stop.stopType === 'delivery');
    const signedAt = new Date();

    return this.prisma.shipmentContract.create({
      data: {
        shipmentId: shipment.id,
        contractNumber: this.generateNumber('CTR'),
        termsVersion: '1.0',
        signedAt,
        payload: {
          referenceNumber: shipment.referenceNumber,
          customerName: shipment.customer.customerProfile?.fullName ?? shipment.customer.email,
          customerCompany: shipment.customer.customerProfile?.company,
          cargoType: shipment.cargoType,
          cargoDescription: shipment.cargoDescription,
          weightKg: shipment.weightKg?.toString() ?? null,
          packageCount: shipment.packageCount,
          dimensions: {
            lengthCm: shipment.lengthCm?.toString() ?? null,
            widthCm: shipment.widthCm?.toString() ?? null,
            heightCm: shipment.heightCm?.toString() ?? null,
          },
          shippingMethod: shipment.shippingMethod,
          isCrossBorder: shipment.isCrossBorder,
          pickup: pickup
            ? { address: pickup.address, city: pickup.city }
            : null,
          delivery: delivery
            ? { address: delivery.address, city: delivery.city }
            : null,
          scheduledAt: shipment.scheduledAt?.toISOString() ?? null,
          amount,
          currency,
          signedAt: signedAt.toISOString(),
          termsEn:
            'Electronic transport contract: carrier assignment subject to fleet acceptance. Payment confirms binding order.',
          termsAr:
            'عقد نقل إلكتروني: تعيين الناقل يخضع لقبول أسطول النقل. يؤكد الدفع الطلب الملزم.',
        },
      },
    });
  }

  private async ensureInvoice(
    shipment: ShipmentWithDetails,
    paymentIntentId: string,
    amount: string,
    currency: string,
  ) {
    const existing = await this.prisma.shipmentInvoice.findUnique({
      where: { shipmentId: shipment.id },
    });

    if (existing) {
      return existing;
    }

    const issuedAt = new Date();

    return this.prisma.shipmentInvoice.create({
      data: {
        shipmentId: shipment.id,
        invoiceNumber: this.generateNumber('INV'),
        paymentIntentId,
        amount,
        currency,
        issuedAt,
        payload: {
          referenceNumber: shipment.referenceNumber,
          customerEmail: shipment.customer.email,
          customerName: shipment.customer.customerProfile?.fullName ?? shipment.customer.email,
          lineItems: [
            {
              description: `Shipment ${shipment.referenceNumber}`,
              amount,
              currency,
            },
          ],
          baseAmount: shipment.priceCalculation?.baseAmount.toString() ?? amount,
          platformFee: shipment.priceCalculation?.platformFee.toString() ?? '0',
          totalAmount: amount,
          issuedAt: issuedAt.toISOString(),
        },
      },
    });
  }

  async getContract(userId: string, role: string, shipmentId: string) {
    await this.assertCommerceAccess(userId, role, shipmentId);

    return this.prisma.shipmentContract.findUniqueOrThrow({
      where: { shipmentId },
    });
  }

  async getInvoice(userId: string, role: string, shipmentId: string) {
    await this.assertCommerceAccess(userId, role, shipmentId);

    return this.prisma.shipmentInvoice.findUniqueOrThrow({
      where: { shipmentId },
    });
  }

  async getContractPdf(userId: string, role: string, shipmentId: string) {
    const contract = await this.getContract(userId, role, shipmentId);
    const payload = contract.payload as Record<string, unknown>;

    return this.buildPdf([
      'Transit Logistic - Electronic Transport Contract',
      `Contract: ${contract.contractNumber}`,
      `Shipment: ${String(payload.referenceNumber ?? '')}`,
      `Customer: ${String(payload.customerName ?? '')}`,
      `Amount: ${String(payload.amount ?? '')} ${String(payload.currency ?? 'SAR')}`,
      `Signed: ${contract.signedAt.toISOString()}`,
      String(payload.termsEn ?? ''),
    ]);
  }

  async getInvoicePdf(userId: string, role: string, shipmentId: string) {
    const invoice = await this.getInvoice(userId, role, shipmentId);
    const payload = invoice.payload as Record<string, unknown>;

    return this.buildPdf([
      'Transit Logistic - Tax Invoice',
      `Invoice: ${invoice.invoiceNumber}`,
      `Shipment: ${String(payload.referenceNumber ?? '')}`,
      `Customer: ${String(payload.customerName ?? '')}`,
      `Total: ${invoice.amount.toString()} ${invoice.currency}`,
      `Issued: ${invoice.issuedAt.toISOString()}`,
    ]);
  }

  private generateNumber(prefix: string) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${prefix}-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private buildPdf(lines: string[]) {
    const escaped = lines
      .map((line, index) => `(${index * 14 + 50}) Td (${this.escapePdfText(line)}) Tj T*`)
      .join('\n');

    return Buffer.from(`%PDF-1.4
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
%%EOF`);
  }

  private escapePdfText(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  private async assertCommerceAccess(userId: string, role: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: { fleetOwner: true },
    });

    if (role === 'admin') {
      return;
    }

    if (role === 'customer' && shipment.customerId === userId) {
      return;
    }

    if (role === 'fleet_owner' && shipment.fleetOwner?.userId === userId) {
      return;
    }

    if (role === 'driver' && shipment.driverId === userId) {
      return;
    }

    throw new ForbiddenException({
      code: 'COMMERCE_ACCESS_DENIED',
      message_en: 'You cannot access this shipment record.',
      message_ar: 'لا يمكنك الوصول إلى سجل هذه الشحنة.',
    });
  }
}
