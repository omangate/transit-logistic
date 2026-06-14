import type { PaymentProviderType, PaymentStatus } from '@transit-logistic/shared';

export type CreatePaymentIntentInput = {
  amount: string;
  currency: string;
  metadata: Record<string, string>;
};

export type ProviderPaymentIntent = {
  providerIntentId: string;
  clientSecret?: string;
  checkoutUrl?: string;
  status: PaymentStatus;
};

export type ProviderConfirmResult = {
  status: PaymentStatus;
  failureCode?: string;
  failureMessage?: string;
};

export type ProviderWebhookEvent = {
  type: string;
  providerIntentId: string;
  payload: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly providerType: PaymentProviderType;

  createPaymentIntent(input: CreatePaymentIntentInput): Promise<ProviderPaymentIntent>;

  confirmPayment(
    providerIntentId: string,
    options?: { cardLast4?: string },
  ): Promise<ProviderConfirmResult>;

  handleWebhook(event: ProviderWebhookEvent): Promise<ProviderConfirmResult | null>;

  verifyWebhookSignature?(payload: string, signature: string | undefined): boolean;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
