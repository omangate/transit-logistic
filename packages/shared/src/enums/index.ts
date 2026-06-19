export const UserRole = {
  CUSTOMER: 'customer',
  FLEET_OWNER: 'fleet_owner',
  DRIVER: 'driver',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ShipmentStatus = {
  DRAFT: 'draft',
  PENDING_ASSIGNMENT: 'pending_assignment',
  ASSIGNED: 'assigned',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

export const WalletTransactionType = {
  TOP_UP: 'top_up',
  SHIPMENT_PAYMENT: 'shipment_payment',
  PLATFORM_FEE: 'platform_fee',
  PAYOUT: 'payout',
  REFUND: 'refund',
  ADJUSTMENT: 'adjustment',
} as const;

export type WalletTransactionType =
  (typeof WalletTransactionType)[keyof typeof WalletTransactionType];

export const PayoutRequestStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSED: 'processed',
} as const;

export type PayoutRequestStatus =
  (typeof PayoutRequestStatus)[keyof typeof PayoutRequestStatus];

export const KycStatus = {
  NOT_SUBMITTED: 'not_submitted',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];

export const PaymentStatus = {
  REQUIRES_PAYMENT_METHOD: 'requires_payment_method',
  REQUIRES_CONFIRMATION: 'requires_confirmation',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentProviderType = {
  MOCK: 'mock',
  STRIPE: 'stripe',
  TAP: 'tap',
  THAWANI: 'thawani',
  MYFATOORAH: 'myfatoorah',
} as const;

export type PaymentProviderType =
  (typeof PaymentProviderType)[keyof typeof PaymentProviderType];

export const NotificationChannel = {
  IN_APP: 'in_app',
  PUSH: 'push',
  EMAIL: 'email',
} as const;

export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const CargoType = {
  DRY: 'dry',
  REFRIGERATED: 'refrigerated',
  SPECIAL: 'special',
} as const;

export type CargoType = (typeof CargoType)[keyof typeof CargoType];

export const ShippingMethod = {
  STANDARD: 'standard',
  EXPRESS: 'express',
  CROSS_BORDER: 'cross_border',
} as const;

export type ShippingMethod = (typeof ShippingMethod)[keyof typeof ShippingMethod];
