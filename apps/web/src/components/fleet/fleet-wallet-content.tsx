'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { FleetShell } from './fleet-shell';

import { useRequireFleetAuth } from '@/hooks/use-require-fleet-auth';
import { getMyWallet, getMyWalletTransactions } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { WalletTransaction } from '@/types/wallet';
import type { Wallet } from '@/types/wallet';

export function FleetWalletContent() {
  const t = useTranslations('fleet.wallet');
  const locale = useLocale();
  const { user, isReady } = useRequireFleetAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !user) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [walletData, txData] = await Promise.all([
          getMyWallet(),
          getMyWalletTransactions(),
        ]);
        if (!cancelled) {
          setWallet(walletData);
          setTransactions(txData.data);
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

      <section className="panel">
        <h2 className="panel__title">{t('transactions')}</h2>
        {isLoading ? (
          <p className="muted-text">{t('loading')}</p>
        ) : transactions.length === 0 ? (
          <p className="muted-text">{t('empty')}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('type')}</th>
                  <th>{t('amount')}</th>
                  <th>{t('date')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.type}</td>
                    <td>
                      {tx.amount} {tx.currency}
                    </td>
                    <td>{new Date(tx.createdAt).toLocaleString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </FleetShell>
  );
}
