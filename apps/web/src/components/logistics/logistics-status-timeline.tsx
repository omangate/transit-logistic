'use client';

import { useLocale } from 'next-intl';

import type { StatusHistoryEntry } from '@/types/logistics';

type Props = {
  entries: StatusHistoryEntry[];
};

export function LogisticsStatusTimeline({ entries }: Props) {
  const locale = useLocale();

  if (!entries.length) {
    return <p className="logistics-empty">—</p>;
  }

  return (
    <ol className="logistics-timeline">
      {entries.map((entry) => (
        <li key={entry.id} className="logistics-timeline__item">
          <div className="logistics-timeline__dot" />
          <div className="logistics-timeline__body">
            <strong>{entry.status.replace(/_/g, ' ')}</strong>
            <time>{new Date(entry.createdAt).toLocaleString(locale)}</time>
            {entry.note ? <p>{entry.note}</p> : null}
            {entry.actor ? <span className="logistics-timeline__actor">{entry.actor.email}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
