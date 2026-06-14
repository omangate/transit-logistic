'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { AdminShell } from './admin-shell';

import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import {
  approveAdminPayout,
  getAdminPayoutSummary,
  listAdminPayouts,
  markAdminPayoutPaid,
  rejectAdminPayout,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { PayoutRequest, PayoutSummary } from '@/types/payout';

export function AdminPayoutsContent() {
  const t = useTranslations('admin.payouts');
  const locale = useLocale();
  const { user, isReady } = useRequireAdminAuth();
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function reload() {
    const [listData, summaryData] = await Promise.all([
      listAdminPayouts(),
      getAdminPayoutSummary(),
    ]);
    setPayouts(listData.data);
    setSummary(summaryData);
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

  async function runAction(
    id: string,
    action: 'approve' | 'reject' | 'paid',
  ) {
    setPendingId(id);
    setError(null);
    try {
      if (action === 'approve') {
        await approveAdminPayout(id);
      } else if (action === 'reject') {
        const reason = window.prompt(t('rejectReason')) ?? '';
        if (!reason.trim()) {
          return;
        }
        await rejectAdminPayout(id, reason.trim());
      } else {
        await markAdminPayoutPaid(id);
      }
      await reload();
    } catch (actionError) {
      setError(
        isApiClientError(actionError)
          ? getLocalizedApiMessage(actionError, locale as 'en' | 'ar')
          : t('errors.generic'),
      );
    } finally {
      setPendingId(null);
    }
  }

  if (!isReady || !user) {
    return <LoadingState message={t('loading')} />;
  }

  return (
    <AdminShell user={user} title={t('title')} subtitle={t('subtitle')}>
      <FormError message={error} />

      {summary ? (
        <div className="stats-grid" style={{ marginBottom: '1rem' }}>
          {(['pending', 'approved', 'rejected', 'paid'] as const).map((status) => (
            <div key={status} className="stat-card">
              <span className="stat-card__label">{t(`statuses.${status}`)}</span>
              <span className="stat-card__value">{summary.totals[status].count}</span>
              <span className="muted-text">{summary.totals[status].amount} SAR</span>
            </div>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <p className="muted-text">{t('loading')}</p>
      ) : payouts.length === 0 ? (
        <p className="muted-text">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('user')}</th>
                <th>{t('amount')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id}>
                  <td>{payout.user?.email ?? payout.userId}</td>
                  <td>
                    {payout.amount} {payout.currency}
                  </td>
                  <td>{t(`statuses.${payout.status}`)}</td>
                  <td>
                    <div className="details-actions">
                      {payout.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            className="portal-button portal-button--primary"
                            disabled={pendingId === payout.id}
                            onClick={() => void runAction(payout.id, 'approve')}
                          >
                            {t('approve')}
                          </button>
                          <button
                            type="button"
                            className="portal-button portal-button--danger"
                            disabled={pendingId === payout.id}
                            onClick={() => void runAction(payout.id, 'reject')}
                          >
                            {t('reject')}
                          </button>
                        </>
                      ) : null}
                      {payout.status === 'approved' ? (
                        <button
                          type="button"
                          className="portal-button portal-button--primary"
                          disabled={pendingId === payout.id}
                          onClick={() => void runAction(payout.id, 'paid')}
                        >
                          {t('markPaid')}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
