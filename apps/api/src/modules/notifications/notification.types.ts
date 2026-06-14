import type { ShipmentStatus, WalletTransactionType } from '@prisma/client';

export const NOTIFICATION_TYPES = {
  SHIPMENT_STATUS: 'shipment_status',
  WALLET_TRANSACTION: 'wallet_transaction',
  ADMIN_BROADCAST: 'admin_broadcast',
  NEW_SHIPMENT: 'new_shipment',
  REGISTRATION_SUCCESS: 'registration_success',
  SHIPMENT_CREATED: 'shipment_created',
  PAYMENT_SUCCESS: 'payment_success',
  TRACKING_ALERT: 'tracking_alert',
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
