'use client';

import { useTranslations } from 'next-intl';

type VerificationBadgeProps = {
  kycStatus?: string;
  insuranceIncluded?: boolean;
  size?: 'sm' | 'md';
};

export function VerificationBadge({ kycStatus, insuranceIncluded, size = 'sm' }: VerificationBadgeProps) {
  const t = useTranslations('marketplace');

  return (
    <span className={`verification-badges verification-badges--${size}`}>
      {kycStatus === 'verified' ? (
        <span className="verification-badge verification-badge--verified">{t('badges.verified')}</span>
      ) : null}
      {kycStatus === 'pending' ? (
        <span className="verification-badge verification-badge--pending">{t('badges.pending')}</span>
      ) : null}
      {insuranceIncluded ? (
        <span className="verification-badge verification-badge--insurance">{t('badges.insured')}</span>
      ) : null}
    </span>
  );
}
