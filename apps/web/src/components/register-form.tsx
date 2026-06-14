'use client';

import { UserRole } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';

import { FormError } from './form-error';

import { Link, useRouter } from '@/i18n/navigation';
import { register } from '@/lib/api';
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

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

type RegisterRole = 'customer' | 'fleet_owner';

function resolveDestination(role: string) {
  if (role === UserRole.FLEET_OWNER) {
    return '/fleet/dashboard';
  }

  return '/dashboard';
}

export function RegisterForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState<RegisterRole>(UserRole.CUSTOMER);

  async function submitRegistration(form: HTMLFormElement) {
    setError(null);
    setErrorCode(null);
    setIsSubmitting(true);

    const formData = new FormData(form);
    const fullName = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');
    const selectedRole = (String(formData.get('role') ?? role).trim() || UserRole.CUSTOMER) as RegisterRole;

    if (!email || !password || !confirmPassword) {
      setError(t('errors.requiredFields'));
      setIsSubmitting(false);
      return;
    }

    if (password.length < 8) {
      setError(t('errors.passwordMinLength'));
      setIsSubmitting(false);
      return;
    }

    if (!PASSWORD_PATTERN.test(password)) {
      setError(t('errors.passwordComplexity'));
      setIsSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      setIsSubmitting(false);
      return;
    }

    if (selectedRole === UserRole.CUSTOMER && !fullName) {
      setError(t('errors.fullNameRequired'));
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await register({
        email,
        password,
        role: selectedRole,
        locale: locale as 'en' | 'ar',
        ...(selectedRole === UserRole.CUSTOMER ? { fullName } : {}),
      });
      storeAuthSession(result);
      router.push(resolveDestination(result.user.role));
    } catch (submitError) {
      if (isApiClientError(submitError)) {
        setErrorCode(submitError.code);
        setError(getLocalizedApiMessage(submitError, locale as 'en' | 'ar'));
      } else {
        setError(t('errors.generic'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitRegistration(event.currentTarget);
  }

  return (
    <>
      <FormError message={error} />

      {errorCode === 'USER_ALREADY_EXISTS' ? (
        <p
          style={{
            color: 'var(--color-muted)',
            fontSize: '0.875rem',
            marginBlock: '-0.5rem 1rem',
            textAlign: 'center',
          }}
        >
          <Link href="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            {t('loginLink')}
          </Link>
        </p>
      ) : null}

      <form noValidate method="post" action="#" onSubmit={handleSubmit}>
        <label style={fieldStyle}>
          <span>{t('role')}</span>
          <select
            name="role"
            value={role}
            onChange={(event) => {
              setRole(event.target.value as RegisterRole);
              setError(null);
              setErrorCode(null);
            }}
            disabled={isSubmitting}
            style={inputStyle}
          >
            <option value={UserRole.CUSTOMER}>{t('roleCustomer')}</option>
            <option value={UserRole.FLEET_OWNER}>{t('roleFleetOwner')}</option>
          </select>
        </label>

        {role === UserRole.CUSTOMER ? (
          <label style={fieldStyle}>
            <span>{t('name')}</span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              disabled={isSubmitting}
              style={inputStyle}
            />
          </label>
        ) : null}

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
            autoComplete="new-password"
            disabled={isSubmitting}
            style={inputStyle}
          />
          <span className="muted-text" style={{ fontSize: '0.8125rem' }}>
            {t('passwordHint')}
          </span>
        </label>

        <label style={fieldStyle}>
          <span>{t('confirmPassword')}</span>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
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
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? t('submitting') : t('registerButton')}
        </button>
      </form>

      <p
        style={{
          color: 'var(--color-muted)',
          fontSize: '0.875rem',
          marginBlockStart: '1.5rem',
          textAlign: 'center',
        }}
      >
        {t('hasAccount')}{' '}
        <Link href="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          {t('loginLink')}
        </Link>
      </p>
    </>
  );
}
