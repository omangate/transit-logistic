'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { AdminShell } from './admin-shell';

import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import { getSettings, updateSettings } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { PlatformSettings } from '@/types/settings';

type SettingsSection = 'company' | 'email' | 'payment' | 'notifications';

export function AdminSettingsContent() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>('company');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getSettings();
        if (!cancelled) {
          setSettings(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            isApiClientError(loadError)
              ? getLocalizedApiMessage(loadError, locale as 'en' | 'ar')
              : t('errors.generic'),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isReady, user, locale, t]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(event.currentTarget);
    let value: Record<string, unknown> = {};

    if (activeSection === 'company') {
      value = {
        nameEn: String(formData.get('nameEn') ?? ''),
        nameAr: String(formData.get('nameAr') ?? ''),
        email: String(formData.get('email') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        address: String(formData.get('address') ?? ''),
      };
    } else if (activeSection === 'email') {
      value = {
        provider: String(formData.get('provider') ?? ''),
        fromAddress: String(formData.get('fromAddress') ?? ''),
        enabled: formData.has('enabled'),
      };
    } else if (activeSection === 'payment') {
      value = {
        provider: String(formData.get('provider') ?? ''),
        currency: String(formData.get('currency') ?? ''),
        successPath: String(formData.get('successPath') ?? ''),
        cancelPath: String(formData.get('cancelPath') ?? ''),
      };
    } else {
      value = {
        inApp: formData.has('inApp'),
        email: formData.has('email'),
        push: formData.has('push'),
      };
    }

    try {
      await updateSettings({ key: activeSection, value });
      setSettings((current) =>
        current
          ? {
              ...current,
              [activeSection]: { ...current[activeSection], ...value },
            }
          : current,
      );
      setSuccess(t('saved'));
    } catch (saveError) {
      setError(
        isApiClientError(saveError)
          ? getLocalizedApiMessage(saveError, locale as 'en' | 'ar')
          : t('errors.generic'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <AdminShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <FormError message={error} />
      {success ? <p className="success-text">{success}</p> : null}

      {isLoading || !settings ? (
        <p className="muted-text">{t('loading')}</p>
      ) : (
        <div className="settings-layout">
          <nav className="settings-tabs">
            {(['company', 'email', 'payment', 'notifications'] as SettingsSection[]).map(
              (section) => (
                <button
                  key={section}
                  type="button"
                  className={`settings-tabs__tab${activeSection === section ? ' settings-tabs__tab--active' : ''}`}
                  onClick={() => {
                    setActiveSection(section);
                    setSuccess(null);
                  }}
                >
                  {t(`sections.${section}`)}
                </button>
              ),
            )}
          </nav>

          <form className="panel settings-form" onSubmit={(event) => void handleSave(event)}>
            {activeSection === 'company' ? (
              <>
                <label className="settings-form__field">
                  <span>{t('company.nameEn')}</span>
                  <input name="nameEn" defaultValue={settings.company.nameEn} required />
                </label>
                <label className="settings-form__field">
                  <span>{t('company.nameAr')}</span>
                  <input name="nameAr" defaultValue={settings.company.nameAr} required />
                </label>
                <label className="settings-form__field">
                  <span>{t('company.email')}</span>
                  <input name="email" type="email" defaultValue={settings.company.email} required />
                </label>
                <label className="settings-form__field">
                  <span>{t('company.phone')}</span>
                  <input name="phone" defaultValue={settings.company.phone} required />
                </label>
                <label className="settings-form__field">
                  <span>{t('company.address')}</span>
                  <input name="address" defaultValue={settings.company.address} required />
                </label>
              </>
            ) : null}

            {activeSection === 'email' ? (
              <>
                <label className="settings-form__field">
                  <span>{t('email.provider')}</span>
                  <input name="provider" defaultValue={settings.email.provider} required />
                </label>
                <label className="settings-form__field">
                  <span>{t('email.fromAddress')}</span>
                  <input
                    name="fromAddress"
                    defaultValue={settings.email.fromAddress}
                    required
                  />
                </label>
                <label className="settings-form__field settings-form__field--checkbox">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={settings.email.enabled}
                  />
                  <span>{t('email.enabled')}</span>
                </label>
              </>
            ) : null}

            {activeSection === 'payment' ? (
              <>
                <label className="settings-form__field">
                  <span>{t('payment.provider')}</span>
                  <input name="provider" defaultValue={settings.payment.provider} required />
                </label>
                <label className="settings-form__field">
                  <span>{t('payment.currency')}</span>
                  <input name="currency" defaultValue={settings.payment.currency} required />
                </label>
                <label className="settings-form__field">
                  <span>{t('payment.successPath')}</span>
                  <input
                    name="successPath"
                    defaultValue={settings.payment.successPath}
                    required
                  />
                </label>
                <label className="settings-form__field">
                  <span>{t('payment.cancelPath')}</span>
                  <input name="cancelPath" defaultValue={settings.payment.cancelPath} required />
                </label>
              </>
            ) : null}

            {activeSection === 'notifications' ? (
              <>
                <label className="settings-form__field settings-form__field--checkbox">
                  <input
                    type="checkbox"
                    name="inApp"
                    defaultChecked={settings.notifications.inApp}
                  />
                  <span>{t('notifications.inApp')}</span>
                </label>
                <label className="settings-form__field settings-form__field--checkbox">
                  <input
                    type="checkbox"
                    name="email"
                    defaultChecked={settings.notifications.email}
                  />
                  <span>{t('notifications.email')}</span>
                </label>
                <label className="settings-form__field settings-form__field--checkbox">
                  <input
                    type="checkbox"
                    name="push"
                    defaultChecked={settings.notifications.push}
                  />
                  <span>{t('notifications.push')}</span>
                </label>
              </>
            ) : null}

            <button
              type="submit"
              className="portal-button portal-button--primary"
              disabled={isSaving}
            >
              {isSaving ? t('saving') : t('save')}
            </button>
          </form>
        </div>
      )}
    </AdminShell>
  );
}
