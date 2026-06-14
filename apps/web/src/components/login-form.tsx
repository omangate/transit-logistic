'use client';

import { UserRole } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { FormError } from './form-error';

import { Link, useRouter } from '@/i18n/navigation';
import { login } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { storeAuthSession } from '@/lib/auth-storage';

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '0.375rem',
  marginBlockEnd: '1rem',
};

const inputStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  padding: '0.625rem 0.75rem',
  font: 'inherit',
};

export function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <>
      <FormError message={error} />

      <form
        noValidate
        method="post"
        action="#"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setIsSubmitting(true);

          const formData = new FormData(event.currentTarget);
          const email = String(formData.get('email') ?? '').trim();
          const password = String(formData.get('password') ?? '');

          if (!email || !password) {
            setError(t('errors.requiredFields'));
            setIsSubmitting(false);
            return;
          }

          try {
            const result = await login({ email, password });
            storeAuthSession(result);

            const destination =
              result.user.role === UserRole.ADMIN
                ? '/admin/dashboard'
                : result.user.role === UserRole.FLEET_OWNER
                  ? '/fleet/dashboard'
                  : result.user.role === UserRole.DRIVER
                    ? '/driver/dashboard'
                    : '/dashboard';

            router.push(destination);
          } catch (submitError) {
            if (isApiClientError(submitError)) {
              setError(getLocalizedApiMessage(submitError, locale as 'en' | 'ar'));
            } else {
              setError(t('errors.generic'));
            }
          } finally {
            setIsSubmitting(false);
          }
        }}
      >
        <label style={fieldStyle}>
          <span>{t('email')}</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            disabled={isSubmitting}
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          <span>{t('password')}</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            disabled={isSubmitting}
            style={inputStyle}
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%',
            background: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            marginBlockStart: '0.5rem',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? t('submitting') : t('loginButton')}
        </button>
      </form>

      <p
        style={{
          color: 'var(--color-muted)',
          fontSize: '0.875rem',
          marginBlock: '1.5rem 0 0',
          textAlign: 'center',
        }}
      >
        {t('noAccount')}{' '}
        <Link href="/register" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          {t('registerLink')}
        </Link>
      </p>
    </>
  );
}
