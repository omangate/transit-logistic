import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';

import { LogisticsAccessService } from './logistics-access.service';
import { LogisticsChargesService } from './logistics-charges.service';

@Injectable()
export class LogisticsPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LogisticsAccessService,
    private readonly charges: LogisticsChargesService,
  ) {}

  async quotePdf(user: User, quoteId: string) {
    const quote = await this.prisma.logisticsQuote.findUniqueOrThrow({
      where: { id: quoteId },
      include: {
        lines: true,
        logisticsOrder: { include: { customer: { select: { email: true } } } },
        customsRequest: true,
        freightRequest: true,
      },
    });

    await this.assertQuoteAccess(user, quote);

    const title = quote.customsRequestId
      ? 'Customs Clearance Quotation'
      : quote.freightRequestId
        ? 'Freight Forwarding Quotation'
        : 'Logistics Quotation';

    const lines = [
      'Transit Logistic',
      title,
      `Reference: ${quote.referenceNumber}`,
      `Date: ${new Date().toISOString().slice(0, 10)}`,
      `Customer: ${quote.logisticsOrder?.customer?.email ?? '—'}`,
      `Status: ${quote.status}`,
      '---',
      ...quote.lines.map(
        (l) =>
          `${l.category.replace(/_/g, ' ')} | ${l.description} | ${Number(l.amount).toFixed(3)} x ${Number(l.quantity)} + tax ${Number(l.tax).toFixed(3)} OMR`,
      ),
      '---',
      `Subtotal: ${Number(quote.subtotal).toFixed(3)} OMR`,
      `Tax: ${Number(quote.taxAmount).toFixed(3)} OMR`,
      `Total: ${Number(quote.totalAmount).toFixed(3)} OMR`,
      'Amounts require confirmation by authorized staff.',
    ];

    return { buffer: this.buildPdf(lines), filename: `${quote.referenceNumber}.pdf` };
  }

  async invoicePdf(user: User, logisticsOrderId: string) {
    await this.access.assertOrderAccess(user, logisticsOrderId);
    const order = await this.prisma.logisticsOrder.findUniqueOrThrow({
      where: { id: logisticsOrderId },
      include: { customer: { select: { email: true } }, charges: true },
    });

    const visible = order.charges.filter((c) => c.isCustomerVisible);
    const totals = await this.charges.totals(user, logisticsOrderId);

    const lines = [
      'Transit Logistic - Invoice',
      `Order: ${order.referenceNumber}`,
      `Customer: ${order.customer.email}`,
      `Date: ${new Date().toISOString().slice(0, 10)}`,
      '---',
      ...visible.map(
        (c) =>
          `${c.category.replace(/_/g, ' ')} | ${c.description} | ${Number(c.amount).toFixed(3)} OMR (${c.paymentStatus})`,
      ),
      '---',
      `Total: ${totals.total.toFixed(3)} OMR`,
      `Paid: ${totals.paid.toFixed(3)} OMR`,
      `Balance: ${(totals.total - totals.paid).toFixed(3)} OMR`,
    ];

    return { buffer: this.buildPdf(lines), filename: `invoice-${order.referenceNumber}.pdf` };
  }

  async costStatementPdf(user: User, logisticsOrderId: string) {
    return this.invoicePdf(user, logisticsOrderId);
  }

  async customsSummaryPdf(user: User, customsRequestId: string) {
    await this.access.assertCustomsAccess(user, customsRequestId);
    const req = await this.prisma.customsClearanceRequest.findUniqueOrThrow({
      where: { id: customsRequestId },
      include: { cargoLines: true, customer: { select: { email: true } } },
    });

    const lines = [
      'Transit Logistic - Customs Transaction Summary',
      `Reference: ${req.referenceNumber}`,
      `Type: ${req.transactionType}`,
      `Status: ${req.status}`,
      `Customer: ${req.customer.email}`,
      `BL: ${req.billOfLadingNumber ?? '—'}`,
      `Port of discharge: ${req.portOfDischarge ?? '—'}`,
      `Destination: ${req.finalDestination ?? '—'}`,
      '---',
      ...req.cargoLines.map((c) => `${c.description} | HS ${c.hsCode ?? '—'} | ${c.grossWeightKg ?? '—'} kg`),
    ];

    return { buffer: this.buildPdf(lines), filename: `customs-${req.referenceNumber}.pdf` };
  }

  async containerListPdf(user: User, logisticsOrderId: string) {
    await this.access.assertOrderAccess(user, logisticsOrderId);
    const order = await this.prisma.logisticsOrder.findUniqueOrThrow({
      where: { id: logisticsOrderId },
      include: { containers: true },
    });

    const lines = [
      'Transit Logistic - Container List',
      `Order: ${order.referenceNumber}`,
      '---',
      ...order.containers.map(
        (c) => `${c.containerNumber} | ${c.size ?? '—'} | ${c.currentStatus} | ${c.currentLocation ?? '—'}`,
      ),
    ];

    return { buffer: this.buildPdf(lines), filename: `containers-${order.referenceNumber}.pdf` };
  }

  async vehicleListPdf(user: User, logisticsOrderId: string) {
    await this.access.assertOrderAccess(user, logisticsOrderId);
    const order = await this.prisma.logisticsOrder.findUniqueOrThrow({
      where: { id: logisticsOrderId },
      include: { vehicleShipments: true },
    });

    const lines = [
      'Transit Logistic - Vehicle List',
      `Order: ${order.referenceNumber}`,
      '---',
      ...order.vehicleShipments.map(
        (v) => `${v.vin ?? v.chassisNumber ?? '—'} | ${v.make ?? ''} ${v.model ?? ''} ${v.year ?? ''} | ${v.customsStatus ?? '—'}`,
      ),
    ];

    return { buffer: this.buildPdf(lines), filename: `vehicles-${order.referenceNumber}.pdf` };
  }

  async shipmentSummaryPdf(user: User, logisticsOrderId: string) {
    await this.access.assertOrderAccess(user, logisticsOrderId);
    const order = await this.prisma.logisticsOrder.findUniqueOrThrow({
      where: { id: logisticsOrderId },
      include: {
        customsRequests: true,
        freightRequests: true,
        customer: { select: { email: true } },
      },
    });

    const lines = [
      'Transit Logistic - Shipment Summary',
      `Order: ${order.referenceNumber}`,
      `Customer: ${order.customer.email}`,
      `Status: ${order.status}`,
      '---',
      `Customs requests: ${order.customsRequests.length}`,
      ...order.customsRequests.map((c) => `  ${c.referenceNumber} (${c.status})`),
      `Freight requests: ${order.freightRequests.length}`,
      ...order.freightRequests.map((f) => `  ${f.referenceNumber} (${f.status})`),
    ];

    return { buffer: this.buildPdf(lines), filename: `summary-${order.referenceNumber}.pdf` };
  }

  async deliveryConfirmationPdf(user: User, logisticsOrderId: string) {
    await this.access.assertOrderAccess(user, logisticsOrderId);
    const order = await this.prisma.logisticsOrder.findUniqueOrThrow({
      where: { id: logisticsOrderId },
      include: { customer: { select: { email: true } } },
    });

    const lines = [
      'Transit Logistic - Delivery Confirmation',
      `Order: ${order.referenceNumber}`,
      `Customer: ${order.customer.email}`,
      `Completed: ${new Date().toISOString().slice(0, 10)}`,
      'Cargo received in good order subject to inspection.',
    ];

    return { buffer: this.buildPdf(lines), filename: `delivery-${order.referenceNumber}.pdf` };
  }

  private async assertQuoteAccess(
    user: User,
    quote: {
      logisticsOrder?: { customerId: string } | null;
      customsRequest?: { customerId: string } | null;
      freightRequest?: { customerId: string } | null;
    },
  ) {
    const customerId =
      quote.customsRequest?.customerId ?? quote.freightRequest?.customerId ?? quote.logisticsOrder?.customerId;
    if (!customerId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message_en: 'Quote not found.', message_ar: 'عرض السعر غير موجود.' });
    }
    if (user.role !== UserRole.ADMIN && user.id !== customerId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message_en: 'Forbidden.', message_ar: 'غير مسموح.' });
    }
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
}
