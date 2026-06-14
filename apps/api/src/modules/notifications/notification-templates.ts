import { ShipmentStatus, WalletTransactionType } from '@prisma/client';

const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, { en: string; ar: string }> = {
  [ShipmentStatus.draft]: { en: 'Draft', ar: 'مسودة' },
  [ShipmentStatus.pending_assignment]: { en: 'Pending assignment', ar: 'بانتظار التعيين' },
  [ShipmentStatus.assigned]: { en: 'Assigned', ar: 'معينة' },
  [ShipmentStatus.picked_up]: { en: 'Picked up', ar: 'تم الاستلام' },
  [ShipmentStatus.in_transit]: { en: 'In transit', ar: 'قيد النقل' },
  [ShipmentStatus.delivered]: { en: 'Delivered', ar: 'تم التسليم' },
  [ShipmentStatus.completed]: { en: 'Completed', ar: 'مكتملة' },
  [ShipmentStatus.cancelled]: { en: 'Cancelled', ar: 'ملغاة' },
};

const WALLET_TYPE_LABELS: Record<WalletTransactionType, { en: string; ar: string }> = {
  [WalletTransactionType.top_up]: { en: 'Top up', ar: 'إيداع' },
  [WalletTransactionType.shipment_payment]: { en: 'Shipment payment', ar: 'دفع شحنة' },
  [WalletTransactionType.platform_fee]: { en: 'Platform fee', ar: 'رسوم المنصة' },
  [WalletTransactionType.payout]: { en: 'Payout', ar: 'سحب' },
  [WalletTransactionType.refund]: { en: 'Refund', ar: 'استرداد' },
  [WalletTransactionType.adjustment]: { en: 'Adjustment', ar: 'تعديل' },
};

export function buildShipmentStatusNotification(
  referenceNumber: string,
  toStatus: ShipmentStatus,
) {
  const label = SHIPMENT_STATUS_LABELS[toStatus];

  return {
    titleEn: 'Shipment update',
    titleAr: 'تحديث الشحنة',
    bodyEn: `Shipment ${referenceNumber} is now ${label.en}.`,
    bodyAr: `أصبحت الشحنة ${referenceNumber} الآن ${label.ar}.`,
  };
}

export function buildNewShipmentAdminNotification(referenceNumber: string) {
  return {
    titleEn: 'New shipment ready',
    titleAr: 'شحنة جديدة جاهزة',
    bodyEn: `Shipment ${referenceNumber} is paid and awaiting assignment.`,
    bodyAr: `الشحنة ${referenceNumber} مدفوعة وبانتظار التعيين.`,
  };
}

export function buildRegistrationNotification(name: string) {
  return {
    titleEn: 'Welcome to Transit Logistic',
    titleAr: 'مرحباً بك في ترانزيت لوجستك',
    bodyEn: `Hi ${name}, your account has been created successfully.`,
    bodyAr: `مرحباً ${name}، تم إنشاء حسابك بنجاح.`,
  };
}

export function buildShipmentCreatedNotification(referenceNumber: string) {
  return {
    titleEn: 'Shipment created',
    titleAr: 'تم إنشاء الشحنة',
    bodyEn: `Shipment ${referenceNumber} has been created. Complete payment to confirm.`,
    bodyAr: `تم إنشاء الشحنة ${referenceNumber}. أكمل الدفع للتأكيد.`,
  };
}

export function buildPaymentSuccessNotification(referenceNumber: string, amount: string, currency: string) {
  return {
    titleEn: 'Payment successful',
    titleAr: 'تم الدفع بنجاح',
    bodyEn: `Payment of ${amount} ${currency} for shipment ${referenceNumber} was successful.`,
    bodyAr: `تم الدفع بمبلغ ${amount} ${currency} للشحنة ${referenceNumber} بنجاح.`,
  };
}

export function buildTrackingAlertNotification(referenceNumber: string, alertType: string) {
  const isDeviation = alertType === 'route_deviation';

  return {
    titleEn: isDeviation ? 'Route deviation detected' : 'Tracking alert',
    titleAr: isDeviation ? 'انحراف عن المسار' : 'تنبيه تتبع',
    bodyEn: isDeviation
      ? `Shipment ${referenceNumber} has deviated from the planned route.`
      : `Shipment ${referenceNumber} triggered a tracking alert (${alertType}).`,
    bodyAr: isDeviation
      ? `انحرفت الشحنة ${referenceNumber} عن المسار المخطط.`
      : `أطلقت الشحنة ${referenceNumber} تنبيهاً للتتبع (${alertType}).`,
  };
}

export function buildWalletTransactionNotification(
  transactionType: WalletTransactionType,
  amount: string,
  balanceAfter: string,
) {
  const label = WALLET_TYPE_LABELS[transactionType];

  return {
    titleEn: 'Wallet transaction',
    titleAr: 'معاملة المحفظة',
    bodyEn: `${label.en}: ${amount} SAR. New balance: ${balanceAfter} SAR.`,
    bodyAr: `${label.ar}: ${amount} ريال. الرصيد الجديد: ${balanceAfter} ريال.`,
  };
}
