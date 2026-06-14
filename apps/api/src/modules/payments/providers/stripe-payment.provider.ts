import { Injectable } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { ConfigService } from '@nestjs/config';
import { PaymentProviderType, PaymentStatus } from '@transit-logistic/shared';

import type {
  CreatePaymentIntentInput,
  PaymentProvider,
  ProviderConfirmResult,
  ProviderPaymentIntent,
  ProviderWebhookEvent,
} from '../payment-provider.interface';

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly providerType = PaymentProviderType.STRIPE;

  constructor(private readonly config: ConfigService) {}

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<ProviderPaymentIntent> {
    const secretKey = this.config.get<string>('payment.stripe.secretKey');
    const webAppUrl = this.config.get<string>('app.webUrl', 'http://127.0.0.1:3000');
    const shipmentId = input.metadata.shipmentId ?? 'unknown';
    const successUrl =
      input.metadata.successUrl ??
      `${webAppUrl}/en/shipments/${shipmentId}/payment/success`;
    const cancelUrl =
      input.metadata.cancelUrl ??
      `${webAppUrl}/en/shipments/${shipmentId}/payment/cancel`;

    if (!secretKey) {
      throw new Error('Stripe secret key is not configured');
    }

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', successUrl);
    params.set('cancel_url', cancelUrl);
    params.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
    params.set(
      'line_items[0][price_data][product_data][name]',
      `Shipment ${input.metadata.referenceNumber ?? shipmentId}`,
    );
    params.set('line_items[0][price_data][unit_amount]', String(Math.round(Number(input.amount) * 100)));
    params.set('line_items[0][quantity]', '1');
    params.set('metadata[shipmentId]', shipmentId);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to create Stripe checkout session');
    }

    const body = (await response.json()) as { id: string; url?: string };

    return {
      providerIntentId: body.id,
      checkoutUrl: body.url,
      status: PaymentStatus.REQUIRES_CONFIRMATION,
    };
  }

  async confirmPayment(providerIntentId: string): Promise<ProviderConfirmResult> {
    const secretKey = this.config.get<string>('payment.stripe.secretKey');

    if (!secretKey) {
      return {
        status: PaymentStatus.FAILED,
        failureCode: 'PAYMENT_CONFIG_ERROR',
        failureMessage: 'Stripe is not configured.',
      };
    }

    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${providerIntentId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    if (!response.ok) {
      return {
        status: PaymentStatus.FAILED,
        failureCode: 'PAYMENT_VERIFY_FAILED',
        failureMessage: 'Unable to verify Stripe payment.',
      };
    }

    const body = (await response.json()) as { payment_status?: string };

    if (body.payment_status === 'paid') {
      return { status: PaymentStatus.SUCCEEDED };
    }

    return {
      status: PaymentStatus.FAILED,
      failureCode: 'PAYMENT_NOT_COMPLETED',
      failureMessage: 'Payment has not been completed.',
    };
  }

  async handleWebhook(event: ProviderWebhookEvent): Promise<ProviderConfirmResult | null> {
    if (event.type === 'checkout.session.completed') {
      return { status: PaymentStatus.SUCCEEDED };
    }

    return null;
  }
}
