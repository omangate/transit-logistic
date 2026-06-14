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
export class MyFatoorahPaymentProvider implements PaymentProvider {
  readonly providerType = PaymentProviderType.MYFATOORAH;
  private readonly logger = new Logger(MyFatoorahPaymentProvider.name);

  constructor(private readonly config: ConfigService) {}

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<ProviderPaymentIntent> {
    const apiKey = this.config.get<string>('payment.myfatoorah.apiKey');
    const baseUrl = this.config.get<string>(
      'payment.myfatoorah.baseUrl',
      'https://apitest.myfatoorah.com',
    );
    const webAppUrl = this.config.get<string>('app.webUrl', 'http://127.0.0.1:3000');
    const shipmentId = input.metadata.shipmentId;
    const successUrl =
      input.metadata.successUrl ??
      `${webAppUrl}/en/shipments/${shipmentId}/payment/success`;
    const cancelUrl =
      input.metadata.cancelUrl ??
      `${webAppUrl}/en/shipments/${shipmentId}/payment/cancel`;
    const language = input.metadata.locale === 'ar' ? 'AR' : 'EN';

    if (!apiKey) {
      throw new Error('MyFatoorah API key is not configured');
    }

    const response = await fetch(`${baseUrl}/v2/SendPayment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        InvoiceValue: Number(input.amount),
        CustomerName: input.metadata.customerEmail ?? 'Customer',
        DisplayCurrencyIso: input.currency,
        CustomerReference: shipmentId,
        CallBackUrl: successUrl,
        ErrorUrl: cancelUrl,
        Language: language,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`MyFatoorah session failed: ${errorBody}`);
      throw new Error('Failed to create MyFatoorah payment');
    }

    const body = (await response.json()) as {
      Data?: { InvoiceId?: number; InvoiceURL?: string };
    };

    return {
      providerIntentId: String(body.Data?.InvoiceId ?? ''),
      checkoutUrl: body.Data?.InvoiceURL,
      status: PaymentStatus.REQUIRES_CONFIRMATION,
    };
  }

  async confirmPayment(providerIntentId: string): Promise<ProviderConfirmResult> {
    const apiKey = this.config.get<string>('payment.myfatoorah.apiKey');
    const baseUrl = this.config.get<string>(
      'payment.myfatoorah.baseUrl',
      'https://apitest.myfatoorah.com',
    );

    if (!apiKey) {
      return {
        status: PaymentStatus.FAILED,
        failureCode: 'PAYMENT_CONFIG_ERROR',
        failureMessage: 'MyFatoorah is not configured.',
      };
    }

    const response = await fetch(`${baseUrl}/v2/GetPaymentStatus`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Key: providerIntentId,
        KeyType: 'InvoiceId',
      }),
    });

    if (!response.ok) {
      return {
        status: PaymentStatus.FAILED,
        failureCode: 'PAYMENT_VERIFY_FAILED',
        failureMessage: 'Unable to verify MyFatoorah payment.',
      };
    }

    const body = (await response.json()) as {
      Data?: { InvoiceStatus?: string };
    };

    if (body.Data?.InvoiceStatus === 'Paid') {
      return { status: PaymentStatus.SUCCEEDED };
    }

    return {
      status: PaymentStatus.FAILED,
      failureCode: 'PAYMENT_NOT_COMPLETED',
      failureMessage: 'Payment has not been completed.',
    };
  }

  async handleWebhook(event: ProviderWebhookEvent): Promise<ProviderConfirmResult | null> {
    if (event.type === 'PaymentStatusChanged' && event.payload.status === 'Paid') {
      return { status: PaymentStatus.SUCCEEDED };
    }

    return null;
  }
}
