import { buildPaymentCallbackUrl, resolvePaymentLocale } from './payment-callback-url.util';

describe('payment-callback-url.util', () => {
  it('defaults to en for unknown locales', () => {
    expect(resolvePaymentLocale('fr')).toBe('en');
    expect(resolvePaymentLocale()).toBe('en');
  });

  it('builds locale-prefixed callback URLs', () => {
    expect(
      buildPaymentCallbackUrl(
        'http://127.0.0.1:3000',
        'ar',
        'abc-123',
        '/shipments/{id}/payment/success',
      ),
    ).toBe('http://127.0.0.1:3000/ar/shipments/abc-123/payment/success');
  });
});
