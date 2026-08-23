import { EmailTransportService } from './email-transport.service';

describe('EmailTransportService', () => {
  const createService = (env: Record<string, string | undefined>) =>
    new EmailTransportService({
      get: (key: string, defaultValue?: unknown) => {
        const map: Record<string, string | undefined> = {
          'email.provider': env.EMAIL_PROVIDER,
          'email.from': env.EMAIL_FROM,
          'email.replyTo': env.EMAIL_REPLY_TO,
          'email.resendApiKey': env.RESEND_API_KEY,
          'email.smtp.host': env.SMTP_HOST,
          'email.smtp.port': env.SMTP_PORT,
          'email.smtp.secure': env.SMTP_SECURE,
          'email.smtp.user': env.SMTP_USER,
          'email.smtp.password': env.SMTP_PASSWORD,
        };

        if (key.startsWith('email.smtp.port')) {
          return env.SMTP_PORT ? Number.parseInt(env.SMTP_PORT, 10) : defaultValue;
        }

        if (key.startsWith('email.smtp.secure')) {
          return env.SMTP_SECURE === 'true';
        }

        return map[key] ?? defaultValue;
      },
    } as never);

  it('reports missing SMTP credentials without exposing password', () => {
    const service = createService({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_FROM: 'Transit Logistic <OMANGATE.A@GMAIL.COM>',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_USER: 'omangate.a@gmail.com',
    });

    expect(service.getProvider()).toBe('smtp');
    expect(service.isConfigured()).toBe(false);
    expect(service.getMissingCredentials()).toEqual(['SMTP_PASSWORD']);
  });

  it('enables SMTP when all credentials are present', () => {
    const service = createService({
      EMAIL_PROVIDER: 'smtp',
      EMAIL_FROM: 'Transit Logistic <OMANGATE.A@GMAIL.COM>',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'omangate.a@gmail.com',
      SMTP_PASSWORD: 'app-password',
    });

    expect(service.isConfigured()).toBe(true);
    expect(service.getMissingCredentials()).toEqual([]);
  });

  it('keeps Resend available as an alternative provider', () => {
    const service = createService({
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM: 'Transit Logistic <noreply@transit-logistic.dev>',
      RESEND_API_KEY: 're_test',
    });

    expect(service.getProvider()).toBe('resend');
    expect(service.isConfigured()).toBe(true);
    expect(service.getMissingCredentials()).toEqual([]);
  });
});
