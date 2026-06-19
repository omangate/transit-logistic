/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus as PrismaPaymentStatus, Prisma } from '@prisma/client';
import type { User } from '@/types/user';
import { PaymentProviderType, PaymentStatus } from '@transit-logistic/shared';

import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import { SettingsService, DEFAULT_SETTINGS } from '../settings/settings.service';
import { ShipmentsService } from '../shipments/shipments.service';

import type { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import type { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import type { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { buildPaymentCallbackUrl } from './payment-callback-url.util';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type ProviderWebhookEvent,
} from './payment-provider.interface';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipments: ShipmentsService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    private readonly notificationDelivery: NotificationDeliveryService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async getShipmentPaymentQuote(user: User, shipmentId: string) {
    const quote = await this.shipments.getShipmentPaymentQuote(user, shipmentId);

    return {
      shipmentId: quote.shipmentId,
      referenceNumber: quote.referenceNumber,
      amount: quote.totalAmount,
      currency: quote.currency,
      baseAmount: quote.baseAmount,
      platformFee: quote.platformFee,
      breakdown: quote.breakdown,
    };
  }

  async createShipmentPaymentIntent(
    user: User,
    shipmentId: string,
    dto: CreatePaymentIntentDto = {},
  ) {
    const quote = await this.shipments.getShipmentPaymentQuote(user, shipmentId);

    const existingIntent = await this.prisma.paymentIntent.findFirst({
      where: {
        shipmentId,
        customerId: user.id,
        status: {
          in: [
            PrismaPaymentStatus.requires_confirmation,
            PrismaPaymentStatus.processing,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingIntent?.providerIntentId) {
      const metadata = (existingIntent.metadata ?? {}) as Record<string, unknown>;
      if (metadata.checkoutUrl) {
        return this.toPaymentIntentResponse(existingIntent, quote.referenceNumber);
      }
    }

    const paymentSettings = await this.settings.getSection('payment');
    const successPath =
      paymentSettings.successPath ?? DEFAULT_SETTINGS.payment.successPath;
    const cancelPath = paymentSettings.cancelPath ?? DEFAULT_SETTINGS.payment.cancelPath;
    const webAppUrl = this.config.get<string>('app.webUrl', 'http://127.0.0.1:3000');
    const locale = dto.locale;

    const providerResult = await this.provider.createPaymentIntent({
      amount: quote.totalAmount,
      currency: quote.currency,
      metadata: {
        shipmentId,
        referenceNumber: quote.referenceNumber,
        customerId: user.id,
        customerEmail: user.email,
        locale: locale ?? 'en',
        successUrl: buildPaymentCallbackUrl(webAppUrl, locale, shipmentId, successPath),
        cancelUrl: buildPaymentCallbackUrl(webAppUrl, locale, shipmentId, cancelPath),
      },
    });

    const intent = await this.prisma.paymentIntent.create({
      data: {
        shipmentId,
        customerId: user.id,
        amount: quote.totalAmount,
        currency: quote.currency,
        status: this.toPrismaStatus(providerResult.status),
        provider: this.resolveProviderType(),
        providerIntentId: providerResult.providerIntentId,
        clientSecret: providerResult.clientSecret,
        metadata: {
          referenceNumber: quote.referenceNumber,
          baseAmount: quote.baseAmount,
          platformFee: quote.platformFee,
          checkoutUrl: providerResult.checkoutUrl ?? null,
        },
      },
    });

    await this.recordEvent(intent.id, 'payment_intent.created', {
      providerIntentId: providerResult.providerIntentId,
    });

    return this.toPaymentIntentResponse(intent, quote.referenceNumber);
  }

  async confirmPaymentIntent(user: User, paymentIntentId: string, dto: ConfirmPaymentDto) {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId },
      include: { shipment: true },
    });

    if (!intent) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message_en: 'Payment not found.',
        message_ar: 'الدفع غير موجود.',
      });
    }

    if (intent.customerId !== user.id) {
      throw new BadRequestException({
        code: 'PAYMENT_ACCESS_DENIED',
        message_en: 'You cannot confirm this payment.',
        message_ar: 'لا يمكنك تأكيد هذا الدفع.',
      });
    }

    if (intent.status === PrismaPaymentStatus.succeeded) {
      const shipment = await this.shipments.findOneResponse(user, intent.shipmentId);
      return {
        payment: this.toPaymentIntentResponse(intent, intent.shipment.referenceNumber),
        shipment,
      };
    }

    if (
      intent.status === PrismaPaymentStatus.failed ||
      intent.status === PrismaPaymentStatus.cancelled
    ) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_CONFIRMABLE',
        message_en: 'This payment can no longer be confirmed. Create a new payment.',
        message_ar: 'لا يمكن تأكيد هذا الدفع. أنشئ دفعة جديدة.',
      });
    }

    if (!intent.providerIntentId) {
      throw new BadRequestException({
        code: 'PAYMENT_PROVIDER_ERROR',
        message_en: 'Payment provider reference is missing.',
        message_ar: 'مرجع مزود الدفع مفقود.',
      });
    }

    const cardLast4 = dto.cardNumber.slice(-4);

    await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: PrismaPaymentStatus.processing },
    });

    const providerResult = await this.provider.confirmPayment(intent.providerIntentId, {
      cardLast4,
    });

    if (providerResult.status !== PaymentStatus.SUCCEEDED) {
      await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: PrismaPaymentStatus.failed,
          failureCode: providerResult.failureCode,
          failureMessage: providerResult.failureMessage,
        },
      });

      await this.recordEvent(intent.id, 'payment.failed', {
        failureCode: providerResult.failureCode,
        failureMessage: providerResult.failureMessage,
      });

      throw new BadRequestException({
        code: providerResult.failureCode ?? 'PAYMENT_FAILED',
        message_en: providerResult.failureMessage ?? 'Card payment failed.',
        message_ar: providerResult.failureMessage ?? 'فشل الدفع بالبطاقة.',
      });
    }

    const succeeded = await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: PrismaPaymentStatus.succeeded,
        confirmedAt: new Date(),
        failureCode: null,
        failureMessage: null,
      },
      include: { shipment: true },
    });

    await this.recordEvent(intent.id, 'payment.succeeded', { cardLast4 });

    const shipment = await this.completeSuccessfulPayment(user, succeeded);

    return {
      payment: this.toPaymentIntentResponse(succeeded, succeeded.shipment.referenceNumber),
      shipment,
    };
  }

  async verifyShipmentPayment(user: User, shipmentId: string) {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: {
        shipmentId,
        customerId: user.id,
        status: {
          in: [
            PrismaPaymentStatus.requires_confirmation,
            PrismaPaymentStatus.processing,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { shipment: true },
    });

    if (!intent?.providerIntentId) {
      const succeeded = await this.prisma.paymentIntent.findFirst({
        where: {
          shipmentId,
          customerId: user.id,
          status: PrismaPaymentStatus.succeeded,
        },
        orderBy: { createdAt: 'desc' },
        include: { shipment: true },
      });

      if (succeeded) {
        const shipment = await this.shipments.findOneResponse(user, shipmentId);
        return {
          payment: this.toPaymentIntentResponse(succeeded, succeeded.shipment.referenceNumber),
          shipment,
        };
      }

      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message_en: 'No pending payment found for this shipment.',
        message_ar: 'لا يوجد دفع معلق لهذه الشحنة.',
      });
    }

    await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: PrismaPaymentStatus.processing },
    });

    const providerResult = await this.provider.confirmPayment(intent.providerIntentId);

    if (providerResult.status !== PaymentStatus.SUCCEEDED) {
      await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: PrismaPaymentStatus.failed,
          failureCode: providerResult.failureCode,
          failureMessage: providerResult.failureMessage,
        },
      });

      throw new BadRequestException({
        code: providerResult.failureCode ?? 'PAYMENT_NOT_COMPLETED',
        message_en: providerResult.failureMessage ?? 'Payment has not been completed.',
        message_ar: providerResult.failureMessage ?? 'لم يكتمل الدفع.',
      });
    }

    const succeeded = await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: PrismaPaymentStatus.succeeded,
        confirmedAt: new Date(),
        failureCode: null,
        failureMessage: null,
      },
      include: { shipment: true },
    });

    await this.recordEvent(intent.id, 'payment.succeeded', { source: 'callback' });

    const shipment = await this.completeSuccessfulPayment(user, succeeded);

    return {
      payment: this.toPaymentIntentResponse(succeeded, succeeded.shipment.referenceNumber),
      shipment,
    };
  }

  async listPaymentHistory(user: User, query: { page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = user.role === 'admin' ? {} : { customerId: user.id };

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.paymentIntent.findMany({
        where,
        include: { shipment: { select: { referenceNumber: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.paymentIntent.count({ where }),
    ]);

    return {
      data: payments.map((intent) =>
        this.toPaymentIntentResponse(intent, intent.shipment.referenceNumber),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async handleWebhook(
    providerName: string,
    dto: PaymentWebhookDto,
    options?: { rawBody?: string; signature?: string },
  ) {
    const configured = this.config.get<string>('payment.provider', PaymentProviderType.THAWANI);

    if (this.provider.verifyWebhookSignature && options?.rawBody) {
      const valid = this.provider.verifyWebhookSignature(options.rawBody, options.signature);
      if (!valid) {
        throw new BadRequestException({
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message_en: 'Webhook signature verification failed.',
          message_ar: 'فشل التحقق من توقيع الويب هوك.',
        });
      }
    }

    if (providerName !== configured) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_PAYMENT_PROVIDER',
        message_en: 'Unsupported payment provider.',
        message_ar: 'مزود الدفع غير مدعوم.',
      });
    }

    const event: ProviderWebhookEvent = {
      type: dto.type,
      providerIntentId: dto.providerIntentId,
      payload: dto.payload,
    };

    const providerResult = await this.provider.handleWebhook(event);

    if (!providerResult) {
      return { received: true, processed: false };
    }

    const intent = await this.prisma.paymentIntent.findUnique({
      where: { providerIntentId: dto.providerIntentId },
      include: { shipment: true },
    });

    if (!intent) {
      return { received: true, processed: false };
    }

    if (providerResult.status === PaymentStatus.SUCCEEDED) {
      if (intent.status !== PrismaPaymentStatus.succeeded) {
        await this.prisma.paymentIntent.update({
          where: { id: intent.id },
          data: {
            status: PrismaPaymentStatus.succeeded,
            confirmedAt: new Date(),
          },
        });

        await this.recordEvent(intent.id, 'payment.succeeded', { source: 'webhook' });

        if (intent.shipment.status === 'draft') {
          const customer = await this.prisma.user.findUniqueOrThrow({
            where: { id: intent.customerId },
          });
          const succeededIntent = await this.prisma.paymentIntent.findUniqueOrThrow({
            where: { id: intent.id },
            include: { shipment: true },
          });
          await this.completeSuccessfulPayment(customer, succeededIntent);
        }
      }

      return { received: true, processed: true, status: PaymentStatus.SUCCEEDED };
    }

    if (providerResult.status === PaymentStatus.FAILED) {
      await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: PrismaPaymentStatus.failed,
          failureCode: providerResult.failureCode,
          failureMessage: providerResult.failureMessage,
        },
      });

      await this.recordEvent(intent.id, 'payment.failed', { source: 'webhook' });

      return { received: true, processed: true, status: PaymentStatus.FAILED };
    }

    return { received: true, processed: false };
  }

  private async completeSuccessfulPayment(
    user: User,
    intent: { id: string; shipmentId: string; amount: { toString: () => string } | string | number; currency: string; shipment: { referenceNumber: string } },
  ) {
    void this.notificationDelivery.safeNotifyPaymentSuccess({
      userId: user.id,
      referenceNumber: intent.shipment.referenceNumber,
      amount: typeof intent.amount === 'object' && intent.amount !== null && 'toString' in intent.amount
        ? intent.amount.toString()
        : String(intent.amount),
      currency: intent.currency,
    });

    return this.shipments.confirmAfterCardPayment(user, intent.shipmentId, intent.id);
  }

  private resolveProviderType(): PaymentProviderType {
    const configured = this.config.get<string>('payment.provider', PaymentProviderType.THAWANI);

    switch (configured) {
      case PaymentProviderType.STRIPE:
        return PaymentProviderType.STRIPE;
      case PaymentProviderType.TAP:
        return PaymentProviderType.TAP;
      case PaymentProviderType.THAWANI:
        return PaymentProviderType.THAWANI;
      case PaymentProviderType.MYFATOORAH:
        return PaymentProviderType.MYFATOORAH;
      case PaymentProviderType.MOCK:
        return PaymentProviderType.MOCK;
      default:
        return PaymentProviderType.THAWANI;
    }
  }

  private toPrismaStatus(status: PaymentStatus): PrismaPaymentStatus {
    return status as PrismaPaymentStatus;
  }

  private async recordEvent(
    paymentIntentId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    await this.prisma.paymentEvent.create({
      data: {
        paymentIntentId,
        eventType,
        payload: payload as object,
      },
    });
  }

  private toPaymentIntentResponse(
    intent: {
      id: string;
      shipmentId: string;
      amount: { toFixed?: (digits: number) => string } | string | number;
      currency: string;
      status: PrismaPaymentStatus;
      provider: string;
      providerIntentId: string | null;
      clientSecret: string | null;
      failureCode: string | null;
      failureMessage: string | null;
      confirmedAt: Date | null;
      createdAt: Date;
      metadata?: unknown;
    },
    referenceNumber: string,
  ) {
    const amount = intent.amount instanceof Prisma.Decimal
      ? intent.amount.toFixed(2)
      : String(intent.amount);

    return {
      id: intent.id,
      shipmentId: intent.shipmentId,
      referenceNumber,
      amount,
      currency: intent.currency,
      status: intent.status,
      provider: intent.provider,
      providerIntentId: intent.providerIntentId,
      clientSecret: intent.clientSecret,
      failureCode: intent.failureCode,
      failureMessage: intent.failureMessage,
      confirmedAt: intent.confirmedAt?.toISOString() ?? null,
      createdAt: intent.createdAt.toISOString(),
      checkoutUrl: this.extractCheckoutUrl(intent),
    };
  }

  private extractCheckoutUrl(intent: { metadata?: unknown }) {
    const metadata = (intent.metadata ?? {}) as Record<string, unknown>;
    return typeof metadata.checkoutUrl === 'string' ? metadata.checkoutUrl : null;
  }
}
