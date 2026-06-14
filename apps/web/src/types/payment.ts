import type { PaymentStatus } from '@transit-logistic/shared';

import type { Shipment } from './shipment';

export interface PaymentQuote {
  shipmentId: string;
  referenceNumber: string;
  amount: string;
  currency: string;
  baseAmount: string;
  platformFee: string;
  breakdown: unknown;
}

export interface PaymentIntent {
  id: string;
  shipmentId: string;
  referenceNumber: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerIntentId: string | null;
  clientSecret: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  confirmedAt: string | null;
  createdAt: string;
  checkoutUrl?: string | null;
}

export interface ConfirmPaymentInput {
  cardNumber: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvc?: string;
}

export interface ConfirmPaymentResponse {
  payment: PaymentIntent;
  shipment: Shipment;
}
