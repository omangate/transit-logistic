'use client';

import { UserRole } from '@transit-logistic/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { markChecklistItemMissing } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { DocumentChecklistItem } from '@/types/logistics';

type Props = {
  items: DocumentChecklistItem[];
  isAdmin?: boolean;
  onUpdated?: () => void;
};

export function DocumentChecklistPanel({ items, isAdmin, onUpdated }: Props) {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!items.length) return null;

  async function handleMarkMissing(itemId: string) {
    setPendingId(itemId);
    setError(null);
    try {
      await markChecklistItemMissing(itemId);
      onUpdated?.();
    } catch (err) {
      setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic'));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="logistics-checklist">
      <h3>{t('documents.checklist')}</h3>
      {error ? <p className="form-error-inline">{error}</p> : null}
      <ul>
        {items.map((item) => (
          <li key={item.id} className={`logistics-checklist__item logistics-checklist__item--${item.status}`}>
            <span>{t(`documents.categories.${item.documentCategory}` as never)}</span>
            <span className="logistics-badge">{t(`documents.status.${item.status}` as never)}</span>
            {isAdmin && item.status !== 'missing' && item.status !== 'approved' ? (
              <button
                type="button"
                className="rental-btn rental-btn--ghost rental-btn--sm"
                disabled={pendingId === item.id}
                onClick={() => void handleMarkMissing(item.id)}
              >
                {t('documents.markMissing')}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function isAdminRole(role?: string) {
  return role === UserRole.ADMIN;
}
