'use client';

import type { TruckAvailabilityStatus } from '@transit-logistic/shared';
import { useTranslations } from 'next-intl';

type AvailabilityBadgeProps = {
  status: TruckAvailabilityStatus;
  size?: 'sm' | 'md';
};

const STATUS_CLASS: Record<TruckAvailabilityStatus, string> = {
  available: 'rental-badge--available',
  busy: 'rental-badge--busy',
  maintenance: 'rental-badge--maintenance',
};

export function AvailabilityBadge({ status, size = 'md' }: AvailabilityBadgeProps) {
  const t = useTranslations('marketplace');
  return (
    <span className={`rental-badge rental-badge--${size} ${STATUS_CLASS[status]}`}>
      {t(`availability.${status}`)}
    </span>
  );
}
