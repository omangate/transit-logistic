import { EmailPreferencesService } from './email-preferences.service';
import { CRITICAL_EMAIL_EVENTS } from './transactional-email.types';

describe('EmailPreferencesService', () => {
  const service = new EmailPreferencesService({ user: { findUnique: jest.fn() } } as never);

  it('defaults optional preferences to safe values', () => {
    expect(service.merge(null)).toEqual({
      marketing: false,
      recommendations: false,
      generalUpdates: true,
      messageEmails: true,
      adminAlerts: true,
    });
  });

  it('allows disabling marketing but not critical events', () => {
    const prefs = service.merge({ marketing: false });
    expect(service.shouldSend('marketing.promotion', prefs, true)).toBe(false);
    expect(service.shouldSend('auth.password_reset', prefs, false, true)).toBe(true);
    expect(CRITICAL_EMAIL_EVENTS.has('document.missing')).toBe(true);
  });

  it('falls back to Arabic locale when missing', () => {
    expect(service.resolveLocale(undefined)).toBe('ar');
    expect(service.resolveLocale('en')).toBe('en');
  });
});

describe('email templates locale', () => {
  it('renders Arabic RTL email', async () => {
    const { renderBrandedEmail } = await import('./email-templates');
    const html = renderBrandedEmail({
      locale: 'ar',
      title: 'اختبار',
      heading: 'مرحباً',
      bodyHtml: '<p>محتوى</p>',
    });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
    expect(html).toContain('ترانزيت لوجستك');
  });

  it('renders English LTR email', async () => {
    const { renderBrandedEmail } = await import('./email-templates');
    const html = renderBrandedEmail({
      locale: 'en',
      title: 'Test',
      heading: 'Hello',
      bodyHtml: '<p>Content</p>',
    });
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('Transit Logistic');
  });
});

describe('transactional email events', () => {
  it('maps customs statuses to events', async () => {
    const { resolveWorkflowEvent, pickLocalized } = await import('./transactional-email.events');
    const def = resolveWorkflowEvent('customs', 'documents_missing');
    expect(def?.event).toBe('customs.documents_missing');
    expect(pickLocalized(def!.heading, 'ar')).toContain('مستند');
  });
});
