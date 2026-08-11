const BRAND = {
  nameEn: 'Transit Logistic',
  nameAr: 'ترانزيت لوجستك',
  primary: '#1D4ED8',
  accent: '#FDE68A',
  text: '#0F172A',
  muted: '#64748B',
  supportEmail: 'support@transit-logistic.com',
};

export type EmailTemplateInput = {
  title: string;
  preheader?: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  locale?: 'en' | 'ar';
  statusBadge?: string;
  footerNote?: string;
};

export function resolveWebAppUrl(path = ''): string {
  const base = process.env.WEB_APP_URL ?? 'http://127.0.0.1:3000';
  return path ? `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}` : base;
}

export function renderBrandedEmail(input: EmailTemplateInput): string {
  const dir = input.locale === 'ar' ? 'rtl' : 'ltr';
  const brandName = input.locale === 'ar' ? BRAND.nameAr : BRAND.nameEn;
  const supportLabel = input.locale === 'ar' ? 'الدعم' : 'Support';
  const footerNote =
    input.footerNote ??
    (input.locale === 'ar'
      ? `للمساعدة تواصل معنا على ${BRAND.supportEmail}`
      : `Need help? Contact us at ${BRAND.supportEmail}`);

  return `<!DOCTYPE html>
<html lang="${input.locale ?? 'en'}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${input.title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Tahoma,Arial,sans-serif;color:${BRAND.text};">
  <span style="display:none;max-height:0;overflow:hidden;">${input.preheader ?? input.heading}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND.primary};padding:24px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="color:#ffffff;font-size:22px;font-weight:700;">${brandName}</td>
                ${
                  input.statusBadge
                    ? `<td align="${dir === 'rtl' ? 'left' : 'right'}"><span style="display:inline-block;background:rgba(255,255,255,0.18);color:#fff;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;">${input.statusBadge}</span></td>`
                    : ''
                }
              </tr></table>
              <div style="color:#dbeafe;font-size:13px;margin-top:4px;">${input.locale === 'ar' ? 'لوجستيات بكل سهولة' : 'Logistics made simple'}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:${BRAND.text};">${input.heading}</h1>
              <div style="font-size:15px;line-height:1.7;color:${BRAND.text};">${input.bodyHtml}</div>
              ${
                input.ctaLabel && input.ctaUrl
                  ? `<p style="margin:28px 0 0;"><a href="${input.ctaUrl}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">${input.ctaLabel}</a></p>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#f8fafc;color:${BRAND.muted};font-size:12px;line-height:1.6;">
              ${footerNote}<br/>
              <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primary};">${supportLabel}</a>
              · © ${new Date().getFullYear()} ${brandName}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailsTable(rows: Array<{ label: string; value: string }>, locale: 'en' | 'ar') {
  if (rows.length === 0) return '';
  const align = locale === 'ar' ? 'right' : 'left';
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;">
    ${rows
      .map(
        (row) => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:${BRAND.muted};font-size:13px;" align="${align}">${row.label}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;font-size:14px;" align="${align}">${row.value}</td>
    </tr>`,
      )
      .join('')}
  </table>`;
}

export function milestoneEmail(input: {
  locale: 'en' | 'ar';
  title: string;
  heading: string;
  explanation: string;
  nextAction: string;
  statusBadge: string;
  orderReference?: string;
  customerReference?: string;
  service?: string;
  status?: string;
  occurredAt?: Date;
  details?: Array<{ label: string; value: string }>;
  actionUrl: string;
  actionLabel?: string;
}) {
  const isAr = input.locale === 'ar';
  const rows: Array<{ label: string; value: string }> = [];
  if (input.orderReference) {
    rows.push({ label: isAr ? 'مرجع الطلب' : 'Order reference', value: input.orderReference });
  }
  if (input.customerReference) {
    rows.push({ label: isAr ? 'مرجع العميل' : 'Customer reference', value: input.customerReference });
  }
  if (input.service) {
    rows.push({ label: isAr ? 'الخدمة' : 'Service', value: input.service });
  }
  if (input.status) {
    rows.push({ label: isAr ? 'الحالة' : 'Status', value: input.status });
  }
  if (input.occurredAt) {
    rows.push({
      label: isAr ? 'التاريخ' : 'Date',
      value: input.occurredAt.toLocaleString(isAr ? 'ar-OM' : 'en-GB', { timeZone: 'Asia/Muscat' }),
    });
  }
  if (input.details?.length) {
    rows.push(...input.details);
  }

  const bodyHtml = `
    <p>${input.explanation}</p>
    ${detailsTable(rows, input.locale)}
    <p style="margin-top:16px;"><strong>${isAr ? 'الإجراء التالي:' : 'Next action:'}</strong> ${input.nextAction}</p>`;

  return renderBrandedEmail({
    locale: input.locale,
    title: input.title,
    heading: input.heading,
    bodyHtml,
    statusBadge: input.statusBadge,
    ctaLabel: input.actionLabel ?? (isAr ? 'عرض المعاملة' : 'View Transaction'),
    ctaUrl: input.actionUrl,
  });
}

export function documentRequestEmail(input: {
  locale: 'en' | 'ar';
  documentName: string;
  reference: string;
  dueDate?: Date;
  uploadUrl: string;
}) {
  const isAr = input.locale === 'ar';
  const due = input.dueDate
    ? `<p>${isAr ? 'تاريخ الاستحقاق:' : 'Due date:'} <strong>${input.dueDate.toLocaleDateString(isAr ? 'ar-OM' : 'en-GB')}</strong></p>`
    : '';
  return renderBrandedEmail({
    locale: input.locale,
    title: isAr ? 'مستند مطلوب' : 'Document required',
    heading: isAr ? 'مستند ناقص' : 'Document missing',
    statusBadge: isAr ? 'مطلوب' : 'Required',
    bodyHtml: isAr
      ? `<p>نحتاج إلى <strong>${input.documentName}</strong> لمعاملة <strong>${input.reference}</strong>.</p>${due}`
      : `<p>We need <strong>${input.documentName}</strong> for transaction <strong>${input.reference}</strong>.</p>${due}`,
    ctaLabel: isAr ? 'رفع المستند' : 'Upload document',
    ctaUrl: input.uploadUrl,
  });
}

export function documentRejectedEmail(input: {
  locale: 'en' | 'ar';
  documentName: string;
  reference: string;
  reason?: string;
  uploadUrl: string;
}) {
  const isAr = input.locale === 'ar';
  const reasonHtml = input.reason
    ? `<p>${isAr ? 'السبب:' : 'Reason:'} ${input.reason}</p>`
    : '';
  return renderBrandedEmail({
    locale: input.locale,
    title: isAr ? 'تم رفض المستند' : 'Document rejected',
    heading: isAr ? 'يرجى إعادة رفع المستند' : 'Please re-upload your document',
    statusBadge: isAr ? 'مرفوض' : 'Rejected',
    bodyHtml: isAr
      ? `<p>تم رفض <strong>${input.documentName}</strong> للمعاملة <strong>${input.reference}</strong>.</p>${reasonHtml}`
      : `<p><strong>${input.documentName}</strong> for <strong>${input.reference}</strong> was rejected.</p>${reasonHtml}`,
    ctaLabel: isAr ? 'استبدال المستند' : 'Replace document',
    ctaUrl: input.uploadUrl,
  });
}

export function paymentEmail(input: {
  locale: 'en' | 'ar';
  kind: 'requested' | 'received' | 'failed' | 'refund_initiated' | 'refund_completed' | 'invoice' | 'receipt';
  reference: string;
  amount: string;
  currency: string;
  description?: string;
  actionUrl?: string;
}) {
  const isAr = input.locale === 'ar';
  const titles: Record<typeof input.kind, { en: string; ar: string }> = {
    requested: { en: 'Payment requested', ar: 'مطلوب دفع' },
    received: { en: 'Payment received', ar: 'تم استلام الدفع' },
    failed: { en: 'Payment failed', ar: 'فشل الدفع' },
    refund_initiated: { en: 'Refund initiated', ar: 'بدء استرداد' },
    refund_completed: { en: 'Refund completed', ar: 'اكتمل الاسترداد' },
    invoice: { en: 'Invoice issued', ar: 'تم إصدار فاتورة' },
    receipt: { en: 'Receipt issued', ar: 'تم إصدار إيصال' },
  };
  const title = isAr ? titles[input.kind].ar : titles[input.kind].en;
  const body = isAr
    ? `<p>${title} — <strong>${input.reference}</strong></p>
       <p>المبلغ: <strong>${input.amount} ${input.currency}</strong></p>
       ${input.description ? `<p>${input.description}</p>` : ''}`
    : `<p>${title} — <strong>${input.reference}</strong></p>
       <p>Amount: <strong>${input.amount} ${input.currency}</strong></p>
       ${input.description ? `<p>${input.description}</p>` : ''}`;

  return renderBrandedEmail({
    locale: input.locale,
    title,
    heading: title,
    bodyHtml: body,
    ctaLabel: input.actionUrl ? (isAr ? 'عرض التفاصيل' : 'View details') : undefined,
    ctaUrl: input.actionUrl,
  });
}

export function messageNotificationEmail(input: {
  locale: 'en' | 'ar';
  orderReference: string;
  conversationUrl: string;
}) {
  const isAr = input.locale === 'ar';
  return renderBrandedEmail({
    locale: input.locale,
    title: isAr ? 'رسالة جديدة' : 'New message',
    heading: isAr
      ? `رسالة جديدة بخصوص ${input.orderReference}`
      : `New message regarding ${input.orderReference}`,
    bodyHtml: isAr
      ? '<p>لديك رسالة جديدة في محادثة اللوجستيات. افتح المحادثة للرد.</p>'
      : '<p>You have a new message in your logistics conversation. Open the conversation to reply.</p>',
    ctaLabel: isAr ? 'فتح المحادثة' : 'Open Conversation',
    ctaUrl: input.conversationUrl,
  });
}

export function emailVerificationEmail(input: { locale: 'en' | 'ar'; verifyUrl: string; name?: string }) {
  const isAr = input.locale === 'ar';
  return renderBrandedEmail({
    locale: input.locale,
    title: isAr ? 'تأكيد البريد الإلكتروني' : 'Verify your email',
    heading: isAr ? 'أكد بريدك الإلكتروني' : 'Confirm your email address',
    bodyHtml: isAr
      ? `<p>مرحباً${input.name ? ` ${input.name}` : ''}، يرجى تأكيد بريدك الإلكتروني للمتابعة.</p>`
      : `<p>Hi${input.name ? ` ${input.name}` : ''}, please verify your email to continue.</p>`,
    ctaLabel: isAr ? 'تأكيد البريد' : 'Verify email',
    ctaUrl: input.verifyUrl,
  });
}

export function passwordResetEmail(input: { locale: 'en' | 'ar'; resetUrl: string }) {
  const isAr = input.locale === 'ar';
  return renderBrandedEmail({
    locale: input.locale,
    title: isAr ? 'إعادة تعيين كلمة المرور' : 'Reset your password',
    heading: isAr ? 'طلب إعادة تعيين كلمة المرور' : 'Password reset request',
    bodyHtml: isAr
      ? '<p>اضغط الزر أدناه لإعادة تعيين كلمة المرور (صالح لمدة ساعة). إذا لم تطلب ذلك، تجاهل هذه الرسالة.</p>'
      : '<p>Use the button below to reset your password (valid for 1 hour). If you did not request this, ignore this email.</p>',
    ctaLabel: isAr ? 'إعادة التعيين' : 'Reset password',
    ctaUrl: input.resetUrl,
  });
}

export function welcomeEmail(name: string, locale: 'en' | 'ar' = 'en') {
  const isAr = locale === 'ar';
  return renderBrandedEmail({
    locale,
    title: isAr ? 'مرحباً بك' : 'Welcome',
    heading: isAr ? `مرحباً ${name}` : `Welcome, ${name}`,
    bodyHtml: isAr
      ? '<p>تم إنشاء حسابك بنجاح في ترانزيت لوجستك. يمكنك الآن إنشاء الشحنات وتتبعها وإدارة عملياتك اللوجستية.</p>'
      : '<p>Your Transit Logistic account is ready. You can now create shipments, track deliveries, and manage your logistics operations.</p>',
    ctaLabel: isAr ? 'فتح لوحة التحكم' : 'Open dashboard',
    ctaUrl: resolveWebAppUrl(`/${locale}/dashboard`),
  });
}

export function shipmentCreatedEmail(reference: string, locale: 'en' | 'ar' = 'en') {
  const isAr = locale === 'ar';
  return renderBrandedEmail({
    locale,
    title: isAr ? 'تم إنشاء الشحنة' : 'Shipment created',
    heading: isAr ? 'تم إنشاء شحنتك' : 'Your shipment was created',
    bodyHtml: isAr
      ? `<p>تم إنشاء الشحنة <strong>${reference}</strong>. أكمل الدفع لتأكيد الشحنة.</p>`
      : `<p>Shipment <strong>${reference}</strong> has been created. Complete payment to confirm your shipment.</p>`,
    ctaLabel: isAr ? 'عرض الشحنة' : 'View shipment',
    ctaUrl: resolveWebAppUrl(`/${locale}/shipments`),
  });
}

export function paymentConfirmationEmail(reference: string, amount: string, currency: string, locale: 'en' | 'ar' = 'en') {
  return paymentEmail({
    locale,
    kind: 'received',
    reference,
    amount,
    currency,
    actionUrl: resolveWebAppUrl(`/${locale}/shipments`),
  });
}

export function shipmentStatusEmail(reference: string, statusLabel: string, locale: 'en' | 'ar' = 'en') {
  const isAr = locale === 'ar';
  return renderBrandedEmail({
    locale,
    title: isAr ? 'تحديث الشحنة' : 'Shipment update',
    heading: isAr ? 'تحديث حالة الشحنة' : 'Shipment status update',
    statusBadge: statusLabel,
    bodyHtml: isAr
      ? `<p>الشحنة <strong>${reference}</strong> أصبحت الآن: <strong>${statusLabel}</strong>.</p>`
      : `<p>Shipment <strong>${reference}</strong> is now: <strong>${statusLabel}</strong>.</p>`,
    ctaLabel: isAr ? 'عرض الشحنة' : 'View shipment',
    ctaUrl: resolveWebAppUrl(`/${locale}/shipments`),
  });
}

export function assignmentEmail(reference: string, locale: 'en' | 'ar' = 'en') {
  const isAr = locale === 'ar';
  return renderBrandedEmail({
    locale,
    title: isAr ? 'تم تعيين الشحنة' : 'Shipment assigned',
    heading: isAr ? 'تم تعيين شحنتك' : 'Your shipment was assigned',
    bodyHtml: isAr
      ? `<p>تم تعيين الشحنة <strong>${reference}</strong> إلى أسطول وسائق.</p>`
      : `<p>Shipment <strong>${reference}</strong> has been assigned to a fleet and driver.</p>`,
    ctaLabel: isAr ? 'عرض الشحنة' : 'View shipment',
    ctaUrl: resolveWebAppUrl(`/${locale}/shipments`),
  });
}

export function deliveryConfirmationEmail(reference: string, locale: 'en' | 'ar' = 'en') {
  const isAr = locale === 'ar';
  return renderBrandedEmail({
    locale,
    title: isAr ? 'تم التسليم' : 'Delivery confirmation',
    heading: isAr ? 'تم تسليم شحنتك' : 'Your shipment was delivered',
    bodyHtml: isAr
      ? `<p>تم تسليم الشحنة <strong>${reference}</strong> بنجاح.</p>`
      : `<p>Shipment <strong>${reference}</strong> has been delivered successfully.</p>`,
    ctaLabel: isAr ? 'عرض الشحنة' : 'View shipment',
    ctaUrl: resolveWebAppUrl(`/${locale}/shipments`),
  });
}

export function adminOperationalAlertEmail(input: {
  locale: 'en' | 'ar';
  title: string;
  body: string;
  actionUrl?: string;
}) {
  const isAr = input.locale === 'ar';
  return renderBrandedEmail({
    locale: input.locale,
    title: input.title,
    heading: input.title,
    bodyHtml: `<p>${input.body}</p>`,
    statusBadge: isAr ? 'تنبيه' : 'Alert',
    ctaLabel: input.actionUrl ? (isAr ? 'فتح في لوحة الإدارة' : 'Open in admin') : undefined,
    ctaUrl: input.actionUrl,
  });
}

export function driverJobEmail(input: {
  locale: 'en' | 'ar';
  title: string;
  reference: string;
  instructions?: string;
  statusLabel?: string;
  actionUrl: string;
}) {
  const isAr = input.locale === 'ar';
  const instructionsHtml = input.instructions
    ? `<p><strong>${isAr ? 'التعليمات:' : 'Instructions:'}</strong> ${input.instructions}</p>`
    : '';
  const statusHtml = input.statusLabel
    ? `<p><strong>${isAr ? 'الحالة:' : 'Status:'}</strong> ${input.statusLabel}</p>`
    : '';

  return renderBrandedEmail({
    locale: input.locale,
    title: input.title,
    heading: input.title,
    statusBadge: input.statusLabel,
    bodyHtml: isAr
      ? `<p>الشحنة <strong>${input.reference}</strong></p>${statusHtml}${instructionsHtml}`
      : `<p>Shipment <strong>${input.reference}</strong></p>${statusHtml}${instructionsHtml}`,
    ctaLabel: isAr ? 'فتح لوحة السائق' : 'Open driver dashboard',
    ctaUrl: input.actionUrl,
  });
}
