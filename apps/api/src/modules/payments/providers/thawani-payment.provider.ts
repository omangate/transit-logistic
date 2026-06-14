import { createHmac, randomBytes } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
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
export class ThawaniPaymentProvider implements PaymentProvider {
  readonly providerType = PaymentProviderType.THAWANI;
  private readonly logger = new Logger(ThawaniPaymentProvider.name);

  constructor(private readonly config: ConfigService) {}

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<ProviderPaymentIntent> {
    const apiKey = this.config.get<string>('payment.thawani.secretKey');
    const publishableKey = this.config.get<string>('payment.thawani.publishableKey');
    const baseUrl = this.config.get<string>(
      'payment.thawani.baseUrl',
      'https://uatcheckout.thawani.om/api/v1',
    );
    const webAppUrl = this.config.get<string>('app.webUrl', 'http://127.0.0.1:3000');
    const shipmentId = input.metadata.shipmentId ?? randomBytes(8).toString('hex');

    if (!apiKey || !publishableKey) {
      throw new Error('Thawani API keys are not configured');
    }

    const unitAmount = this.toProviderAmount(input.amount, input.currency);
    const successUrl =
      input.metadata.successUrl ??
      `${webAppUrl}/en/shipments/${shipmentId}/payment/success`;
    const cancelUrl =
      input.metadata.cancelUrl ??
      `${webAppUrl}/en/shipments/${shipmentId}/payment/cancel`;

    const response = await fetch(`${baseUrl}/checkout/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'thawani-api-key': apiKey,
      },
      body: JSON.stringify({
        client_reference_id: shipmentId,
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: input.metadata,
        products: [
          {
            name: `Shipment ${input.metadata.referenceNumber ?? shipmentId}`,
            quantity: 1,
            unit_amount: unitAmount,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Thawani session failed: ${errorBody}`);
      throw new Error('Failed to create Thawani checkout session');
    }

    const body = (await response.json()) as {
      data?: { session_id?: string; invoice_id?: string };
    };

    const sessionId = body.data?.session_id ?? body.data?.invoice_id;

    if (!sessionId) {
      throw new Error('Thawani session id missing from response');
    }

    const checkoutUrl = `${baseUrl.replace('/api/v1', '')}/pay/${sessionId}?key=${publishableKey}`;

    return {
      providerIntentId: sessionId,
      checkoutUrl,
      status: PaymentStatus.REQUIRES_CONFIRMATION,
    };
  }

  async confirmPayment(providerIntentId: string): Promise<ProviderConfirmResult> {
    const apiKey = this.config.get<string>('payment.thawani.secretKey');
    const baseUrl = this.config.get<string>(
      'payment.thawani.baseUrl',
      'https://uatcheckout.thawani.om/api/v1',
    );

    if (!apiKey) {
      return {
        status: PaymentStatus.FAILED,
        failureCode: 'PAYMENT_CONFIG_ERROR',
        failureMessage: 'Thawani is not configured.',
      };
    }

    const response = await fetch(`${baseUrl}/checkout/session/${providerIntentId}`, {
      headers: { 'thawani-api-key': apiKey },
    });

    if (!response.ok) {
      return {
        status: PaymentStatus.FAILED,
        failureCode: 'PAYMENT_VERIFY_FAILED',
        failureMessage: 'Unable to verify Thawani payment.',
      };
    }

    const body = (await response.json()) as {
      data?: { payment_status?: string; status?: string };
    };

    const paymentStatus = body.data?.payment_status ?? body.data?.status;

    if (paymentStatus === 'paid' || paymentStatus === 'successful' || paymentStatus === 'success') {
      return { status: PaymentStatus.SUCCEEDED };
    }

    return {
      status: PaymentStatus.FAILED,
      failureCode: 'PAYMENT_NOT_COMPLETED',
      failureMessage: 'Payment has not been completed.',
    };
  }

  async handleWebhook(event: ProviderWebhookEvent): Promise<ProviderConfirmResult | null> {
    if (event.type === 'checkout.completed' || event.type === 'payment.succeeded') {
      return { status: PaymentStatus.SUCCEEDED };
    }

    if (event.type === 'payment.failed') {
      return {
        status: PaymentStatus.FAILED,
        failureCode: 'CARD_DECLINED',
        failureMessage: 'Payment failed via Thawani webhook.',
      };
    }

    return null;
  }

  verifyWebhookSignature(payload: string, signature: string | undefined): boolean {
    const secret = this.config.get<string>('payment.thawani.webhookSecret');
    if (!secret || !signature) {
      return false;
    }

    const digest = createHmac('sha256', secret).update(payload).digest('hex');
    return digest === signature;
  }

  private toProviderAmount(amount: string, currency: string): number {
    const value = Number(amount);
    if (currency === 'OMR') {
      return Math.round(value * 1000);
    }

    return Math.round(value * 100);
  }
}
