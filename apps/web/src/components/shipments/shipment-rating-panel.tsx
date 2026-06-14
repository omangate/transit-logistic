'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';

import { getShipmentRating, submitShipmentRating } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { CarrierRating } from '@/types/shipment';

type ShipmentRatingPanelProps = {
  shipmentId: string;
  canRate: boolean;
};

export function ShipmentRatingPanel({ shipmentId, canRate }: ShipmentRatingPanelProps) {
  const t = useTranslations('shipments.rating');
  const locale = useLocale();
  const [rating, setRating] = useState<CarrierRating | null>(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void getShipmentRating(shipmentId)
      .then(setRating)
      .catch(() => setRating(null));
  }, [shipmentId]);

  if (rating) {
    return (
      <section className="panel">
        <h2 className="panel__title">{t('title')}</h2>
        <p>
          {t('submitted', { score: rating.score })}
        </p>
        {rating.comment ? <p className="muted-text">{rating.comment}</p> : null}
      </section>
    );
  }

  if (!canRate) {
    return null;
  }

  return (
    <section className="panel">
      <h2 className="panel__title">{t('title')}</h2>
      <p className="muted-text">{t('subtitle')}</p>
      <FormError message={error} />
      <div className="form-grid">
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <span>{t('score')}</span>
          <select
            value={score}
            onChange={(event) => setScore(Number(event.target.value))}
            style={{ padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <span>{t('comment')}</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            style={{ padding: '0.625rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}
          />
        </label>
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="portal-button portal-button--primary"
          disabled={isSubmitting}
          onClick={async () => {
            setError(null);
            setIsSubmitting(true);
            try {
              const created = await submitShipmentRating(shipmentId, {
                score,
                comment: comment.trim() || undefined,
              });
              setRating(created);
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
          {isSubmitting ? t('submitting') : t('submit')}
        </button>
      </div>
    </section>
  );
}
