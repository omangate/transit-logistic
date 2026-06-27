'use client';

import { useTranslations } from 'next-intl';

import { AvailabilityBadge } from '@/components/marketplace/availability-badge';
import { FavoriteButton } from '@/components/marketplace/favorite-button';
import { RatingStars } from '@/components/marketplace/rating-stars';
import { VerificationBadge } from '@/components/marketplace/verification-badge';
import { Link } from '@/i18n/navigation';
import { buildAssetUrl } from '@/lib/api-config';
import {
  getTruckDisplayPrice,
  getTruckLocationLabel,
  getTruckTitle,
} from '@/lib/marketplace-utils';
import type { TruckListingSummary } from '@/types/marketplace';

type TruckCardProps = {
  truck: TruckListingSummary;
  locale: string;
  compact?: boolean;
  isFavorited?: boolean;
};

export function TruckCard({ truck, locale, compact = false, isFavorited = false }: TruckCardProps) {
  const t = useTranslations('marketplace');
  const imageUrl = truck.coverImageUrl ?? truck.images?.[0]?.url;
  const title = getTruckTitle(truck);
  const location = getTruckLocationLabel(truck.serviceAreas, locale);
  const price = getTruckDisplayPrice(truck, locale, {
    perDay: t('rental.perDay'),
    perKm: t('rental.perKm'),
    requestQuote: t('rental.requestQuote'),
  });

  const capabilityBadges = [
    truck.refrigeratedSupport ? t('rental.refrigerated') : null,
    truck.containerTransportSupport ? t('rental.container') : null,
    truck.crossBorderSupport ? t('rental.crossBorder') : null,
  ].filter(Boolean) as string[];

  return (
    <article className={`rental-card${compact ? ' rental-card--compact' : ''}`}>
      <Link href={`/marketplace/trucks/${truck.slug}`} className="rental-card__media">
        {imageUrl ? (
          <img src={buildAssetUrl(imageUrl)} alt={title} loading="lazy" />
        ) : (
          <div className="rental-card__placeholder">
            <span>🚛</span>
          </div>
        )}
        <div className="rental-card__media-badges">
          {truck.isFeatured ? (
            <span className="rental-card__featured">{t('rental.featured')}</span>
          ) : null}
          <AvailabilityBadge status={truck.availabilityStatus} size="sm" />
        </div>
        <FavoriteButton truckId={truck.id} initialFavorited={isFavorited} />
      </Link>

      <div className="rental-card__body">
        <div className="rental-card__header">
          <div>
            <p className="rental-card__brand">{truck.brand ?? truck.name}</p>
            <h3 className="rental-card__title">
              {[truck.model, truck.year].filter(Boolean).join(' · ') || title}
            </h3>
            <VerificationBadge
              kycStatus={truck.fleetOwner?.kycStatus}
              insuranceIncluded={truck.insuranceCoverage}
              size="sm"
            />
          </div>
          <RatingStars rating={Number(truck.avgRating)} reviewCount={truck.reviewCount} size="sm" />
        </div>

        <ul className="rental-card__specs">
          <li>{t(`vehicleTypes.${truck.vehicleType}`)}</li>
          {truck.capacityKg ? (
            <li>{Number(truck.capacityKg).toLocaleString(locale)} kg</li>
          ) : null}
          {location ? <li>{location}</li> : null}
        </ul>

        {capabilityBadges.length > 0 ? (
          <div className="rental-card__tags">
            {capabilityBadges.map((badge) => (
              <span key={badge} className="rental-card__tag">
                {badge}
              </span>
            ))}
          </div>
        ) : null}

        <div className="rental-card__footer">
          <p className={`rental-card__price${price.hasPrice ? '' : ' rental-card__price--quote'}`}>
            {price.text}
          </p>
          <div className="rental-card__actions">
            <Link
              href={`/marketplace/trucks/${truck.slug}`}
              className="rental-btn rental-btn--ghost"
            >
              {t('rental.viewDetails')}
            </Link>
            <Link
              href={`/marketplace/trucks/${truck.slug}?action=request`}
              className="rental-btn rental-btn--primary"
            >
              {t('rental.requestTruck')}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
