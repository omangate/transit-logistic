'use client';

import { useTranslations } from 'next-intl';

import type { DocumentChecklistItem } from '@/types/logistics';

type Props = {
  items: DocumentChecklistItem[];
};

export function DocumentChecklistPanel({ items }: Props) {
  const t = useTranslations('logistics');

  if (!items.length) return null;

  return (
    <div className="logistics-checklist">
      <h3>{t('documents.checklist')}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={`logistics-checklist__item logistics-checklist__item--${item.status}`}>
            <span>{t(`documents.categories.${item.documentCategory}` as never)}</span>
            <span className="logistics-badge">{t(`documents.status.${item.status}` as never)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
