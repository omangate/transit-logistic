import type { ShipmentStatus, WalletTransactionType } from '@transit-logistic/shared';

export const NOTIFICATION_TYPES = {
  SHIPMENT_STATUS: 'shipment_status',
  WALLET_TRANSACTION: 'wallet_transaction',
  ADMIN_BROADCAST: 'admin_broadcast',
  NEW_SHIPMENT: 'new_shipment',
  REGISTRATION_SUCCESS: 'registration_success',
  SHIPMENT_CREATED: 'shipment_created',
  PAYMENT_SUCCESS: 'payment_success',
  TRACKING_ALERT: 'tracking_alert',
  UPLOAD_COMPLETED: 'upload_completed',
  DOCUMENT_REVIEWED: 'document_reviewed',
  LISTING_APPROVED: 'listing_approved',
  LISTING_REJECTED: 'listing_rejected',
  QUOTE_RECEIVED: 'quote_received',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  NEW_MESSAGE: 'new_message',
  CUSTOMS_STATUS: 'customs_status',
  FREIGHT_STATUS: 'freight_status',
  LOGISTICS_QUOTE: 'logistics_quote',
  DOCUMENT_MISSING: 'document_missing',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export interface ShipmentStatusNotificationData {
  type: typeof NOTIFICATION_TYPES.SHIPMENT_STATUS;
  shipmentId: string;
  referenceNumber: string;
  fromStatus: ShipmentStatus | null;
  toStatus: ShipmentStatus;
}

export interface WalletTransactionNotificationData {
  type: typeof NOTIFICATION_TYPES.WALLET_TRANSACTION;
  transactionId: string;
  transactionType: WalletTransactionType;
  amount: string;
  balanceAfter: string;
  referenceType?: string | null;
  referenceId?: string | null;
}

export interface AdminBroadcastNotificationData {
  type: typeof NOTIFICATION_TYPES.ADMIN_BROADCAST;
  broadcastId: string;
  [key: string]: unknown;
}

export interface NewShipmentNotificationData {
  type: typeof NOTIFICATION_TYPES.NEW_SHIPMENT;
  shipmentId: string;
  referenceNumber: string;
  customerId: string;
}

export type NotificationData =
  | ShipmentStatusNotificationData
  | WalletTransactionNotificationData
  | AdminBroadcastNotificationData
  | NewShipmentNotificationData;

export interface CreateInAppNotificationInput {
  userId: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  data?: NotificationData | Record<string, unknown>;
}
