import { randomBytes } from 'crypto';

/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Injectable } from '@nestjs/common';
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
export class MockPaymentProvider implements PaymentProvider {
  readonly providerType = PaymentProviderType.MOCK;

  private readonly intents = new Map<
    string,
    { amount: string; currency: string; metadata: Record<string, string> }
  >();

  constructor(private readonly config: ConfigService) {}

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<ProviderPaymentIntent> {
    const providerIntentId = `mock_pi_${randomBytes(12).toString('hex')}`;
    const shipmentId = input.metadata.shipmentId;
    const successUrl =
      input.metadata.successUrl ??
      `${this.config.get<string>('app.webUrl', 'http://127.0.0.1:3000')}/en/shipments/${shipmentId}/payment/success`;

    this.intents.set(providerIntentId, {
      amount: input.amount,
      currency: input.currency,
      metadata: input.metadata,
    });

    return {
      providerIntentId,
      checkoutUrl: successUrl,
      status: PaymentStatus.REQUIRES_CONFIRMATION,
    };
  }

  async confirmPayment(
    providerIntentId: string,
    options?: { cardLast4?: string },
  ): Promise<ProviderConfirmResult> {
    const intent = this.intents.get(providerIntentId);

    if (!intent) {
      return {
        status: PaymentStatus.SUCCEEDED,
      };
    }

    if (options?.cardLast4 === '0000') {
      return {
        status: PaymentStatus.FAILED,
        failureCode: 'CARD_DECLINED',
        failureMessage: 'The card was declined. Try another card.',
      };
    }

    return { status: PaymentStatus.SUCCEEDED };
  }

  async handleWebhook(event: ProviderWebhookEvent): Promise<ProviderConfirmResult | null> {
    if (!this.intents.has(event.providerIntentId)) {
      return null;
    }

    if (event.type === 'payment.succeeded') {
      return { status: PaymentStatus.SUCCEEDED };
    }

    if (event.type === 'payment.failed') {
      return {
        status: PaymentStatus.FAILED,
        failureCode: 'CARD_DECLINED',
        failureMessage: 'Payment failed via webhook.',
      };
    }

    return null;
  }
}
