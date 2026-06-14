'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { FleetShell } from './fleet-shell';

import { useRequireFleetAuth } from '@/hooks/use-require-fleet-auth';
import {
  createFleetPayout,
  getFleetPayoutSummary,
  getMyWallet,
  listFleetPayouts,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { PayoutRequest } from '@/types/payout';
import type { Wallet } from '@/types/wallet';

export function FleetPayoutsContent() {
  const t = useTranslations('fleet.payouts');
  const locale = useLocale();
  const { user, isReady } = useRequireFleetAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function reload() {
    const [walletData, payoutData] = await Promise.all([
      getMyWallet(),
      listFleetPayouts(),
    ]);
    setWallet(walletData);
    setPayouts(payoutData.data);
    await getFleetPayoutSummary();
  }

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        await reload();
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
    <FleetShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <FormError message={error} />

      {wallet ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2 className="panel__title">{t('balance')}</h2>
          <p className="stat-card__value">
            {wallet.balance} {wallet.currency}
          </p>
        </section>
      ) : null}

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <h2 className="panel__title">{t('requestTitle')}</h2>
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setIsSubmitting(true);
            const formData = new FormData(event.currentTarget);
            try {
              await createFleetPayout({
                amount: Number(formData.get('amount')),
                bankDetails: {
                  accountName: String(formData.get('accountName') ?? ''),
                  bankName: String(formData.get('bankName') ?? ''),
                  iban: String(formData.get('iban') ?? ''),
                },
              });
              await reload();
              event.currentTarget.reset();
            } catch (submitError) {
              setError(
                isApiClientError(submitError)
                  ? getLocalizedApiMessage(submitError, locale as 'en' | 'ar')
                  : t('errors.generic'),
              );
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <input name="amount" type="number" min="1" step="0.01" required placeholder={t('amount')} />
          <input name="accountName" type="text" required placeholder={t('accountName')} />
          <input name="bankName" type="text" required placeholder={t('bankName')} />
          <input name="iban" type="text" required placeholder={t('iban')} />
          <button type="submit" className="portal-button portal-button--primary" disabled={isSubmitting}>
            {isSubmitting ? t('submitting') : t('submit')}
          </button>
        </form>
      </section>

      {isLoading ? (
        <p className="muted-text">{t('loading')}</p>
      ) : payouts.length === 0 ? (
        <p className="muted-text">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('amount')}</th>
                <th>{t('status')}</th>
                <th>{t('created')}</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id}>
                  <td>
                    {payout.amount} {payout.currency}
                  </td>
                  <td>{t(`statuses.${payout.status}`)}</td>
                  <td>{new Date(payout.createdAt).toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FleetShell>
  );
}
