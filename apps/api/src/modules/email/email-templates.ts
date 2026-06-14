const BRAND = {
  nameEn: 'Transit Logistic',
  nameAr: 'ترانزيت لوجستك',
  primary: '#1D4ED8',
  accent: '#FDE68A',
  text: '#0F172A',
  muted: '#64748B',
  logoUrl: 'https://transit-logistic.com/logo.svg',
};

export type EmailTemplateInput = {
  title: string;
  preheader?: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  locale?: 'en' | 'ar';
};

export function renderBrandedEmail(input: EmailTemplateInput): string {
  const dir = input.locale === 'ar' ? 'rtl' : 'ltr';
  const brandName = input.locale === 'ar' ? BRAND.nameAr : BRAND.nameEn;

  return `<!DOCTYPE html>
<html lang="${input.locale ?? 'en'}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${input.title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,system-ui,sans-serif;color:${BRAND.text};">
  <span style="display:none;max-height:0;overflow:hidden;">${input.preheader ?? input.heading}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND.primary};padding:24px 28px;">
              <div style="color:#ffffff;font-size:22px;font-weight:700;">${brandName}</div>
              <div style="color:#dbeafe;font-size:13px;margin-top:4px;">Logistics made simple</div>
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
            <td style="padding:20px 28px;background:#f8fafc;color:${BRAND.muted};font-size:12px;">
              © ${new Date().getFullYear()} ${brandName}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
    ctaUrl: process.env.WEB_APP_URL ?? 'http://127.0.0.1:3000',
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
  });
}

export function paymentConfirmationEmail(reference: string, amount: string, currency: string, locale: 'en' | 'ar' = 'en') {
  const isAr = locale === 'ar';
  return renderBrandedEmail({
    locale,
    title: isAr ? 'تأكيد الدفع' : 'Payment confirmation',
    heading: isAr ? 'تم الدفع بنجاح' : 'Payment successful',
    bodyHtml: isAr
      ? `<p>تم استلام دفعتك للشحنة <strong>${reference}</strong> بمبلغ <strong>${amount} ${currency}</strong>.</p>`
      : `<p>We received your payment for shipment <strong>${reference}</strong> — <strong>${amount} ${currency}</strong>.</p>`,
  });
}

export function shipmentStatusEmail(reference: string, statusLabel: string, locale: 'en' | 'ar' = 'en') {
  const isAr = locale === 'ar';
  return renderBrandedEmail({
    locale,
    title: isAr ? 'تحديث الشحنة' : 'Shipment update',
    heading: isAr ? 'تحديث حالة الشحنة' : 'Shipment status update',
    bodyHtml: isAr
      ? `<p>الشحنة <strong>${reference}</strong> أصبحت الآن: <strong>${statusLabel}</strong>.</p>`
      : `<p>Shipment <strong>${reference}</strong> is now: <strong>${statusLabel}</strong>.</p>`,
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
  });
}
