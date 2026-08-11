export type EmailLocale = 'en' | 'ar';

export type EmailPreferenceKey = 'marketing' | 'recommendations' | 'generalUpdates' | 'messageEmails' | 'adminAlerts';

export interface EmailPreferences {
  marketing?: boolean;
  recommendations?: boolean;
  generalUpdates?: boolean;
  messageEmails?: boolean;
  adminAlerts?: boolean;
}

export const DEFAULT_EMAIL_PREFERENCES: Required<EmailPreferences> = {
  marketing: false,
  recommendations: false,
  generalUpdates: true,
  messageEmails: true,
  adminAlerts: true,
};

/** Events that always send regardless of user preferences or global email toggle. */
export const CRITICAL_EMAIL_EVENTS = new Set<string>([
  'auth.password_reset',
  'auth.email_verification',
  'auth.security_change',
  'payment.requested',
  'payment.received',
  'payment.failed',
  'payment.refund_initiated',
  'payment.refund_completed',
  'payment.invoice_issued',
  'payment.receipt_issued',
  'booking.cancelled',
  'document.missing',
  'document.rejected',
  'customs.cancelled',
  'freight.cancelled',
  'logistics.cancelled',
  'customs.completed',
  'freight.completed',
  'logistics.completed',
]);

/** Optional events gated by user email preferences. */
export const OPTIONAL_EMAIL_PREFERENCE_MAP: Record<string, EmailPreferenceKey> = {
  'marketing.promotion': 'marketing',
  'marketing.recommendation': 'recommendations',
  'system.general_update': 'generalUpdates',
  'message.new': 'messageEmails',
  'admin.operational_alert': 'adminAlerts',
};

export interface MilestoneEmailContext {
  orderReference?: string;
  customerReference?: string;
  service?: string;
  status?: string;
  statusBadge?: string;
  explanation?: string;
  nextAction?: string;
  occurredAt?: Date;
  details?: Array<{ label: string; value: string }>;
}

export interface SendTransactionalEmailInput {
  userId?: string;
  to: string;
  locale?: EmailLocale;
  event: string;
  eventKey: string;
  entityType?: string;
  entityId?: string;
  subject: string;
  html: string;
  metadata?: Record<string, unknown>;
  force?: boolean;
}

export interface SendMilestoneEmailInput {
  userId: string;
  event: string;
  eventKey: string;
  entityType: string;
  entityId: string;
  locale?: EmailLocale;
  context: MilestoneEmailContext;
  actionUrl: string;
  actionLabel?: { en: string; ar: string };
  title?: { en: string; ar: string };
  heading?: { en: string; ar: string };
  force?: boolean;
}
