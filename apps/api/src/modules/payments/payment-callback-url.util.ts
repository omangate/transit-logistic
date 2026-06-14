export const PAYMENT_CALLBACK_LOCALES = ['en', 'ar'] as const;

export type PaymentCallbackLocale = (typeof PAYMENT_CALLBACK_LOCALES)[number];

export function resolvePaymentLocale(locale?: string): PaymentCallbackLocale {
  if (locale && PAYMENT_CALLBACK_LOCALES.includes(locale as PaymentCallbackLocale)) {
    return locale as PaymentCallbackLocale;
  }

  return 'en';
}

export function buildPaymentCallbackUrl(
  webAppUrl: string,
  locale: string | undefined,
  shipmentId: string,
  pathTemplate: string,
): string {
  const resolvedLocale = resolvePaymentLocale(locale);
  const path = pathTemplate.replace('{id}', shipmentId);
  const base = webAppUrl.replace(/\/$/, '');

  return `${base}/${resolvedLocale}${path}`;
}
