export enum UserRole {
  CUSTOMER = 'customer',
  FLEET_OWNER = 'fleet_owner',
  DRIVER = 'driver',
  ADMIN = 'admin',
}

export enum ShipmentStatus {
  DRAFT = 'draft',
  PENDING_ASSIGNMENT = 'pending_assignment',
  ASSIGNED = 'assigned',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum WalletTransactionType {
  TOP_UP = 'top_up',
  SHIPMENT_PAYMENT = 'shipment_payment',
  PLATFORM_FEE = 'platform_fee',
  PAYOUT = 'payout',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
}

export enum PayoutRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSED = 'processed',
}

export enum KycStatus {
  NOT_SUBMITTED = 'not_submitted',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum PaymentStatus {
  REQUIRES_PAYMENT_METHOD = 'requires_payment_method',
  REQUIRES_CONFIRMATION = 'requires_confirmation',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentProviderType {
  MOCK = 'mock',
  STRIPE = 'stripe',
  TAP = 'tap',
  THAWANI = 'thawani',
  MYFATOORAH = 'myfatoorah',
}

export enum CargoType {
  DRY = 'dry',
  REFRIGERATED = 'refrigerated',
  SPECIAL = 'special',
}

export enum ShippingMethod {
  STANDARD = 'standard',
  EXPRESS = 'express',
  CROSS_BORDER = 'cross_border',
}
