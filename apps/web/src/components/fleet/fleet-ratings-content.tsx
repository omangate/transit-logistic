'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';
import { LoadingState } from '../portal/loading-state';

import { FleetShell } from './fleet-shell';

import { useRequireFleetAuth } from '@/hooks/use-require-fleet-auth';
import { getFleetRatingsSummary } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { FleetRatingSummary } from '@/types/payout';

export function FleetRatingsContent() {
  const t = useTranslations('fleet.ratings');
  const locale = useLocale();
  const { user, isReady } = useRequireFleetAuth();
  const [summary, setSummary] = useState<FleetRatingSummary | null>(null);
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
        const data = await getFleetRatingsSummary();
        if (!cancelled) {
          setSummary(data);
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

      {isLoading ? (
        <p className="muted-text">{t('loading')}</p>
      ) : !summary ? (
        <p className="muted-text">{t('empty')}</p>
      ) : (
        <>
          <section className="panel" style={{ marginBottom: '1rem' }}>
            <h2 className="panel__title">{t('overview')}</h2>
            <dl className="details-list">
              <div>
                <dt>{t('average')}</dt>
                <dd>{summary.averageScore.toFixed(1)} / 5</dd>
              </div>
              <div>
                <dt>{t('total')}</dt>
                <dd>{summary.totalRatings}</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <h2 className="panel__title">{t('recent')}</h2>
            {summary.recent.length === 0 ? (
              <p className="muted-text">{t('noRecent')}</p>
            ) : (
              <ul className="timeline-list">
                {summary.recent.map((rating) => (
                  <li key={rating.id}>
                    <span className="timeline-list__status">
                      {rating.shipment.referenceNumber} — {rating.score}/5
                    </span>
                    {rating.comment ? (
                      <span className="timeline-list__note">{rating.comment}</span>
                    ) : null}
                    <span className="timeline-list__date">
                      {new Date(rating.createdAt).toLocaleString(locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </FleetShell>
  );
}
