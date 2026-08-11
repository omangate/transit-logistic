import type { EmailLocale, MilestoneEmailContext } from './transactional-email.types';

type LocalizedText = { en: string; ar: string };

export interface WorkflowEventDefinition {
  event: string;
  title: LocalizedText;
  heading: LocalizedText;
  explanation: LocalizedText;
  nextAction: LocalizedText;
  statusBadge: LocalizedText;
  service: LocalizedText;
  critical?: boolean;
}

const customs = (status: string, en: string, ar: string, nextEn: string, nextAr: string, badgeEn: string, badgeAr: string): WorkflowEventDefinition => ({
  event: `customs.${status}`,
  title: { en: `Customs update — ${badgeEn}`, ar: `تحديث جمركي — ${badgeAr}` },
  heading: { en, ar },
  explanation: { en: `Your customs clearance request has been updated.`, ar: `تم تحديث طلب التخليص الجمركي.` },
  nextAction: { en: nextEn, ar: nextAr },
  statusBadge: { en: badgeEn, ar: badgeAr },
  service: { en: 'Customs Clearance', ar: 'التخليص الجمركي' },
  critical: ['cancelled', 'completed', 'documents_missing', 'customs_duty_pending'].includes(status),
});

export const CUSTOMS_STATUS_EVENTS: Record<string, WorkflowEventDefinition> = {
  draft: customs('created', 'Customs request created', 'تم إنشاء طلب التخليص الجمركي', 'Complete the form and submit when ready.', 'أكمل النموذج وأرسله عند الجاهزية.', 'Created', 'تم الإنشاء'),
  submitted: customs('submitted', 'Request submitted', 'تم إرسال الطلب', 'Our team will review your submission.', 'سيراجع فريقنا طلبك.', 'Submitted', 'مُرسَل'),
  documents_under_review: customs('documents_received', 'Documents received', 'تم استلام المستندات', 'We are reviewing your documents.', 'نراجع مستنداتك.', 'Under review', 'قيد المراجعة'),
  documents_missing: customs('documents_missing', 'Documents missing', 'مستندات ناقصة', 'Upload the requested documents.', 'ارفع المستندات المطلوبة.', 'Documents missing', 'مستندات ناقصة'),
  quotation_sent: customs('quote_issued', 'Quotation issued', 'تم إصدار عرض السعر', 'Review and accept the quotation.', 'راجع عرض السعر واقبله.', 'Quote issued', 'عرض سعر'),
  quotation_accepted: customs('quote_accepted', 'Quotation accepted', 'تم قبول عرض السعر', 'Clearance will proceed.', 'سيتم متابعة التخليص.', 'Quote accepted', 'عرض مقبول'),
  clearance_in_progress: customs('clearance_started', 'Clearance started', 'بدء التخليص', 'We are processing your clearance.', 'نعالج التخليص.', 'In progress', 'قيد التنفيذ'),
  declaration_prepared: customs('declaration_prepared', 'Declaration prepared', 'تم إعداد الإقرار', 'Declaration is ready for submission.', 'الإقرار جاهز للإرسال.', 'Declaration prepared', 'إقرار جاهز'),
  declaration_submitted: customs('declaration_submitted', 'Declaration submitted', 'تم إرسال الإقرار', 'Awaiting customs processing.', 'بانتظار معالجة الجمارك.', 'Declaration submitted', 'إقرار مُرسَل'),
  customs_inspection: customs('inspection_required', 'Inspection required', 'فحص جمركي مطلوب', 'Additional inspection is scheduled.', 'تم جدولة فحص إضافي.', 'Inspection', 'فحص'),
  additional_approval_required: customs('additional_approval', 'Additional approval required', 'موافقة إضافية مطلوبة', 'Please provide required approvals.', 'يرجى تقديم الموافقات المطلوبة.', 'Approval required', 'موافقة مطلوبة'),
  customs_duty_pending: customs('payment_requested', 'Customs duty payment requested', 'مطلوب دفع الرسوم الجمركية', 'Complete payment to continue.', 'أكمل الدفع للمتابعة.', 'Payment due', 'دفع مطلوب'),
  customs_duty_paid: customs('payment_recorded', 'Payment recorded', 'تم تسجيل الدفع', 'Payment received. Processing continues.', 'تم استلام الدفع. تتابع المعالجة.', 'Paid', 'مدفوع'),
  customs_released: customs('released', 'Customs released', 'تم الإفراج الجمركي', 'Cargo cleared by customs.', 'تم إخلاء البضاعة جمركياً.', 'Released', 'مُفرج عنه'),
  port_release_pending: customs('port_release_pending', 'Port release pending', 'بانتظار إفراج الميناء', 'Awaiting port release.', 'بانتظار إفراج الميناء.', 'Port pending', 'الميناء'),
  ready_for_pickup: customs('ready_for_pickup', 'Cargo ready for pickup', 'البضاعة جاهزة للاستلام', 'Arrange pickup or delivery.', 'رتّب الاستلام أو التسليم.', 'Ready', 'جاهز'),
  transportation_arranged: customs('transportation_arranged', 'Transportation arranged', 'تم ترتيب النقل', 'Transport has been scheduled.', 'تم جدولة النقل.', 'Transport arranged', 'نقل مرتب'),
  completed: customs('completed', 'Transaction completed', 'اكتملت المعاملة', 'No further action required.', 'لا يلزم إجراء إضافي.', 'Completed', 'مكتمل'),
  on_hold: customs('on_hold', 'Transaction on hold', 'المعاملة معلّقة', 'Contact support for assistance.', 'تواصل مع الدعم للمساعدة.', 'On hold', 'معلّق'),
  cancelled: customs('cancelled', 'Transaction cancelled', 'تم إلغاء المعاملة', 'Contact support if this was unexpected.', 'تواصل مع الدعم إن كان غير متوقع.', 'Cancelled', 'ملغى'),
};

const freight = (status: string, en: string, ar: string, nextEn: string, nextAr: string, badgeEn: string, badgeAr: string): WorkflowEventDefinition => ({
  event: `freight.${status}`,
  title: { en: `Freight update — ${badgeEn}`, ar: `تحديث شحن — ${badgeAr}` },
  heading: { en, ar },
  explanation: { en: 'Your freight forwarding request has been updated.', ar: 'تم تحديث طلب الشحن.' },
  nextAction: { en: nextEn, ar: nextAr },
  statusBadge: { en: badgeEn, ar: badgeAr },
  service: { en: 'Freight Forwarding', ar: 'الشحن الدولي' },
  critical: ['cancelled', 'completed'].includes(status),
});

export const FREIGHT_STATUS_EVENTS: Record<string, WorkflowEventDefinition> = {
  draft: freight('created', 'Freight request created', 'تم إنشاء طلب الشحن', 'Complete details and submit.', 'أكمل التفاصيل وأرسل.', 'Created', 'تم الإنشاء'),
  submitted: freight('submitted', 'Freight request submitted', 'تم إرسال طلب الشحن', 'Our team will review your request.', 'سيراجع فريقنا طلبك.', 'Submitted', 'مُرسَل'),
  quotation_sent: freight('quote_issued', 'Freight quote issued', 'تم إصدار عرض سعر الشحن', 'Review and respond to the quote.', 'راجع عرض السعر.', 'Quote issued', 'عرض سعر'),
  quotation_accepted: freight('quote_accepted', 'Quote accepted', 'تم قبول العرض', 'Booking will be confirmed.', 'سيتم تأكيد الحجز.', 'Accepted', 'مقبول'),
  in_progress: freight('booking_confirmed', 'Booking confirmed', 'تم تأكيد الحجز', 'Shipment preparation underway.', 'جاري تجهيز الشحنة.', 'Confirmed', 'مؤكد'),
  in_transit: freight('in_transit', 'Shipment in transit', 'الشحنة في الطريق', 'Track your shipment for updates.', 'تابع شحنتك للتحديثات.', 'In transit', 'في الطريق'),
  delivered: freight('arrived', 'Cargo arrived', 'وصلت البضاعة', 'Arrange final delivery if needed.', 'رتّب التسليم النهائي إن لزم.', 'Arrived', 'وصل'),
  completed: freight('completed', 'Shipment completed', 'اكتملت الشحنة', 'Thank you for choosing Transit Logistic.', 'شكراً لاختياركم ترانزيت لوجستك.', 'Completed', 'مكتمل'),
  on_hold: freight('delayed', 'Shipment delayed/on hold', 'تأخير أو تعليق الشحنة', 'Contact support for details.', 'تواصل مع الدعم للتفاصيل.', 'Delayed', 'متأخر'),
  cancelled: freight('cancelled', 'Shipment cancelled', 'تم إلغاء الشحنة', 'Contact support if unexpected.', 'تواصل مع الدعم إن كان غير متوقع.', 'Cancelled', 'ملغى'),
};

export function resolveWorkflowEvent(domain: 'customs' | 'freight', status: string): WorkflowEventDefinition | null {
  const map = domain === 'customs' ? CUSTOMS_STATUS_EVENTS : FREIGHT_STATUS_EVENTS;
  return map[status] ?? null;
}

export function pickLocalized<T extends LocalizedText>(text: T, locale: EmailLocale): string {
  return locale === 'ar' ? text.ar : text.en;
}

export function buildMilestoneCopy(
  def: WorkflowEventDefinition,
  locale: EmailLocale,
  context: MilestoneEmailContext,
): { subject: string; title: string; heading: string; explanation: string; nextAction: string; statusBadge: string; service: string } {
  const ref = context.orderReference ?? context.customerReference ?? '';
  const refSuffix = ref ? (locale === 'ar' ? ` — ${ref}` : ` — ${ref}`) : '';
  return {
    subject: pickLocalized(def.title, locale) + refSuffix,
    title: pickLocalized(def.title, locale),
    heading: pickLocalized(def.heading, locale),
    explanation: context.explanation ?? pickLocalized(def.explanation, locale),
    nextAction: context.nextAction ?? pickLocalized(def.nextAction, locale),
    statusBadge: context.statusBadge ?? pickLocalized(def.statusBadge, locale),
    service: context.service ?? pickLocalized(def.service, locale),
  };
}
