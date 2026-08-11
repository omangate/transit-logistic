'use client';

import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import { Link } from '@/i18n/navigation';
import { verifyEmailToken } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';

export function VerifyEmailContent() {
  const t = useTranslations('account.verification');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError(t('invalidToken'));
      return;
    }

    void verifyEmailToken(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale as 'en' | 'ar') : t('invalidToken'));
      });
  }, [locale, t, token]);

  return (
    <main className="container auth-page">
      <h1>{t('pageTitle')}</h1>
      {status === 'loading' ? <p>{t('verifying')}</p> : null}
      {status === 'success' ? (
        <>
          <p className="form-success">{t('success')}</p>
          <Link href="/account/notifications" className="rental-btn rental-btn--primary">
            {t('goToAccount')}
          </Link>
        </>
      ) : null}
      {status === 'error' && error ? <FormError message={error} /> : null}
    </main>
  );
}
