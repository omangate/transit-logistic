'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { FleetShell } from './fleet-shell';

import { useRequireFleetAuth } from '@/hooks/use-require-fleet-auth';
import { createFleetDriver, deleteFleetDriver, listFleetDrivers, updateFleetDriver } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { FleetDriverOption } from '@/types/admin';

export function FleetDriversContent() {
  const t = useTranslations('fleet');
  const locale = useLocale();
  const { user, isReady } = useRequireFleetAuth();
  const [drivers, setDrivers] = useState<FleetDriverOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await listFleetDrivers();
        if (!cancelled) {
          setDrivers(data);
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

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <FleetShell user={user} title={t('drivers.title')} subtitle={t('drivers.subtitle')}>
      <FormError message={error} />

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <h2 className="panel__title">{t('drivers.addTitle')}</h2>
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setIsCreating(true);
            const formData = new FormData(event.currentTarget);
            try {
              const created = await createFleetDriver({
                email: String(formData.get('email') ?? ''),
                password: String(formData.get('password') ?? ''),
                licenseNumber: String(formData.get('licenseNumber') ?? ''),
                phone: String(formData.get('phone') ?? '') || undefined,
              });
              setDrivers((current) => [created, ...current]);
              event.currentTarget.reset();
            } catch (submitError) {
              setError(
                isApiClientError(submitError)
                  ? getLocalizedApiMessage(submitError, locale as 'en' | 'ar')
                  : t('errors.generic'),
              );
            } finally {
              setIsCreating(false);
            }
          }}
        >
          <input name="email" type="email" required placeholder={t('drivers.email')} />
          <input name="password" type="password" required placeholder={t('drivers.password')} />
          <input name="licenseNumber" type="text" required placeholder={t('drivers.license')} />
          <input name="phone" type="text" placeholder={t('drivers.phone')} />
          <button type="submit" className="portal-button portal-button--primary" disabled={isCreating}>
            {isCreating ? t('drivers.creating') : t('drivers.create')}
          </button>
        </form>
      </section>

      {isLoading ? (
        <p className="muted-text">{t('loading')}</p>
      ) : drivers.length === 0 ? (
        <p className="muted-text">{t('drivers.empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('drivers.email')}</th>
                <th>{t('drivers.phone')}</th>
                <th>{t('drivers.license')}</th>
                <th>{t('drivers.available')}</th>
                <th>{t('drivers.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td>{driver.user.email}</td>
                  <td>{driver.user.phone ?? '—'}</td>
                  <td>{driver.licenseNumber}</td>
                  <td>{driver.isAvailable ? t('drivers.yes') : t('drivers.no')}</td>
                  <td>
                    <div className="details-actions">
                      <button
                        type="button"
                        className="portal-button portal-button--ghost"
                        onClick={() => {
                          void updateFleetDriver(driver.id, {
                            isAvailable: !driver.isAvailable,
                          })
                            .then((updated) => {
                              setDrivers((current) =>
                                current.map((item) => (item.id === updated.id ? updated : item)),
                              );
                            })
                            .catch((actionError) => {
                              setError(
                                isApiClientError(actionError)
                                  ? getLocalizedApiMessage(actionError, locale as 'en' | 'ar')
                                  : t('errors.generic'),
                              );
                            });
                        }}
                      >
                        {t('drivers.toggleAvailable')}
                      </button>
                      <button
                        type="button"
                        className="portal-button portal-button--danger"
                        onClick={() => {
                          if (!window.confirm(t('drivers.confirmDelete'))) {
                            return;
                          }
                          void deleteFleetDriver(driver.id)
                            .then(() => {
                              setDrivers((current) =>
                                current.filter((item) => item.id !== driver.id),
                              );
                            })
                            .catch((actionError) => {
                              setError(
                                isApiClientError(actionError)
                                  ? getLocalizedApiMessage(actionError, locale as 'en' | 'ar')
                                  : t('errors.generic'),
                              );
                            });
                        }}
                      >
                        {t('drivers.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FleetShell>
  );
}
