'use client';

import { UserRole } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { PortalShell } from '@/components/portal/portal-shell';
import { useRequireAuth } from '@/hooks/use-require-auth';
import {
  getCurrentUser,
  getEmailPreferences,
  resendVerificationEmail,
  updateEmailPreferences,
  updateUserEmail,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { storeAuthSession, getRefreshToken, getAccessToken } from '@/lib/auth-storage';
import type { EmailPreferences } from '@/types/email-preferences';

export function AccountNotificationsContent() {
  const t = useTranslations('account');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireAuth();
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const [me, preferences] = await Promise.all([getCurrentUser(), getEmailPreferences()]);
      setIsVerified(me.isVerified);
      setEmail(me.email);
      setPrefs(preferences);
      setError(null);

      const accessToken = getAccessToken();
      const refreshToken = getRefreshToken();
      if (accessToken && refreshToken && user) {
        storeAuthSession({
          accessToken,
          refreshToken,
          user: { ...user, email: me.email, isVerified: me.isVerified },
        });
      }
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setIsLoading(false);
    }
  }, [locale, t, user]);

  useEffect(() => {
    if (!isReady || !user) return;
    void reload();
  }, [isReady, reload, user]);

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  const isAdmin = user.role === UserRole.ADMIN;

  async function handlePrefChange(key: keyof EmailPreferences, value: boolean) {
    if (!prefs) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await updateEmailPreferences({ [key]: value });
      setPrefs(updated);
      setMessage(t('preferences.saved'));
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResendVerification() {
    setMessage(null);
    setError(null);
    try {
      const result = await resendVerificationEmail();
      setMessage(result.alreadyVerified ? t('verification.alreadyVerified') : t('verification.sent'));
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    }
  }

  async function handleEmailUpdate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await updateUserEmail(email);
      setMessage(t('verification.emailUpdated'));
      await reload();
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    }
  }

  return (
    <PortalShell user={user} title={t('title')} subtitle={t('subtitle')}>
      {error ? <FormError message={error} /> : null}
      {message ? <p className="form-success">{message}</p> : null}
      {isLoading || !prefs ? (
        <LoadingState message={t('loading')} />
      ) : (
        <div className="account-notifications">
          <section className="logistics-panel">
            <h2>{t('verification.title')}</h2>
            <p className={`logistics-badge ${isVerified ? 'logistics-badge--success' : 'logistics-badge--warning'}`}>
              {isVerified ? t('verification.verified') : t('verification.unverified')}
            </p>
            {!isVerified ? (
              <button type="button" className="rental-btn rental-btn--primary" onClick={() => void handleResendVerification()}>
                {t('verification.resend')}
              </button>
            ) : null}
            <form className="account-notifications__email-form" onSubmit={(e) => void handleEmailUpdate(e)}>
              <label>
                {t('verification.emailLabel')}
                <input type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} required />
              </label>
              <button type="submit" className="rental-btn rental-btn--ghost">
                {t('verification.updateEmail')}
              </button>
            </form>
          </section>

          <section className="logistics-panel">
            <h2>{t('preferences.title')}</h2>
            <p className="account-notifications__hint">{t('preferences.hint')}</p>
            <ul className="account-notifications__list">
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={prefs.generalUpdates}
                    disabled={isSaving}
                    onChange={(ev) => void handlePrefChange('generalUpdates', ev.target.checked)}
                  />
                  {t('preferences.generalUpdates')}
                </label>
              </li>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={prefs.messageEmails}
                    disabled={isSaving}
                    onChange={(ev) => void handlePrefChange('messageEmails', ev.target.checked)}
                  />
                  {t('preferences.messageEmails')}
                </label>
              </li>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={prefs.marketing}
                    disabled={isSaving}
                    onChange={(ev) => void handlePrefChange('marketing', ev.target.checked)}
                  />
                  {t('preferences.marketing')}
                </label>
              </li>
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={prefs.recommendations}
                    disabled={isSaving}
                    onChange={(ev) => void handlePrefChange('recommendations', ev.target.checked)}
                  />
                  {t('preferences.recommendations')}
                </label>
              </li>
              {isAdmin ? (
                <li>
                  <label>
                    <input
                      type="checkbox"
                      checked={prefs.adminAlerts}
                      disabled={isSaving}
                      onChange={(ev) => void handlePrefChange('adminAlerts', ev.target.checked)}
                    />
                    {t('preferences.adminAlerts')}
                  </label>
                </li>
              ) : null}
            </ul>
            <p className="account-notifications__critical">{t('preferences.criticalNote')}</p>
          </section>
        </div>
      )}
    </PortalShell>
  );
}
