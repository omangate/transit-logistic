'use client';

import { UserRole } from '@transit-logistic/shared';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { FormError } from '@/components/form-error';
import { AvailabilityBadge } from '@/components/marketplace/availability-badge';
import { RatingStars } from '@/components/marketplace/rating-stars';
import { TruckCard } from '@/components/marketplace/truck-card';
import { TruckImageGallery } from '@/components/marketplace/truck-image-gallery';
import { Link, useRouter } from '@/i18n/navigation';
import { getMarketplaceTruck, getSimilarTrucks, requestTruckQuote } from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import { getStoredUser } from '@/lib/auth-storage';
import { formatOMR, getTruckTitle } from '@/lib/marketplace-utils';
import type { TruckListingDetail, TruckListingSummary } from '@/types/marketplace';

type Props = {
  slug: string;
};

function regionName(
  region: { nameEn: string; nameAr: string },
  locale: string,
): string {
  return locale === 'ar' ? region.nameAr : region.nameEn;
}

export function MarketplaceTruckProfileContent({ slug }: Props) {
  const t = useTranslations('marketplace');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteRef = useRef<HTMLElement>(null);

  const [truck, setTruck] = useState<TruckListingDetail | null>(null);
  const [similar, setSimilar] = useState<TruckListingSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteSent, setQuoteSent] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [detail, related] = await Promise.all([
          getMarketplaceTruck(slug),
          getSimilarTrucks(slug),
        ]);
        setTruck(detail);
        setSimilar(related);
      } catch (err) {
        setError(
          isApiClientError(err) ? getLocalizedApiMessage(err, locale as 'en' | 'ar') : t('errors.generic'),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, locale, t]);

  useEffect(() => {
    if (searchParams.get('action') === 'request' && quoteRef.current) {
      quoteRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams, loading]);

  if (loading) {
    return (
      <main className="container rental-detail-loading">
        <p>{t('loading')}</p>
      </main>
    );
  }

  if (error || !truck) {
    return (
      <main className="container">
        <FormError message={error ?? t('errors.notFound')} />
      </main>
    );
  }

  const title = getTruckTitle(truck);
  const governorates = truck.serviceAreas
    ?.map((sa) => sa.geoRegion)
    .filter((r) => r.type === 'governorate' || r.type === 'wilayat')
    .slice(0, 12) ?? [];

  const rentalRows = [
    {
      label: t('rental.dailyPrice'),
      value: formatOMR(truck.dailyRentalPrice, locale),
    },
    {
      label: t('rental.weeklyPrice'),
      value: formatOMR(truck.weeklyRentalPrice, locale),
    },
    {
      label: t('rental.monthlyPrice'),
      value: formatOMR(truck.monthlyRentalPrice, locale),
    },
    {
      label: t('rental.withDriver'),
      value: truck.withDriverAvailable ? t('rental.yes') : t('rental.no'),
    },
    {
      label: t('rental.withoutDriver'),
      value: truck.withoutDriverAvailable ? t('rental.yes') : t('rental.no'),
    },
    {
      label: t('rental.minDuration'),
      value: truck.minRentalDays
        ? t('rental.daysCount', { count: truck.minRentalDays })
        : '—',
    },
    {
      label: t('rental.insurance'),
      value: truck.insuranceCoverage ? t('rental.included') : t('rental.notIncluded'),
    },
    {
      label: t('rental.crossBorder'),
      value: truck.crossBorderSupport ? t('rental.allowed') : t('rental.notAllowed'),
    },
  ];

  const capabilityItems = [
    truck.refrigeratedSupport ? t('rental.refrigerated') : null,
    truck.containerTransportSupport ? t('rental.container') : null,
    truck.vehicleType === 'flatbed' ? t('vehicleTypes.flatbed') : null,
    truck.hazardousMaterialsSupport ? t('form.hazardous') : null,
  ].filter(Boolean) as string[];

  return (
    <main className="rental-detail">
      <section className="container rental-detail__top">
        <div className="rental-detail__gallery-col">
          <TruckImageGallery
            images={truck.images}
            coverUrl={truck.coverImageUrl}
            alt={title}
          />
          {truck.videoUrl ? (
            <div className="rental-detail__video">
              <h2>{t('rental.video')}</h2>
              <a href={truck.videoUrl} target="_blank" rel="noopener noreferrer" className="rental-btn rental-btn--ghost">
                {t('rental.watchVideo')}
              </a>
            </div>
          ) : null}
        </div>

        <aside className="rental-detail__summary">
          <div className="rental-detail__summary-head">
            <AvailabilityBadge status={truck.availabilityStatus} />
            {truck.isFeatured ? (
              <span className="rental-card__featured">{t('rental.featured')}</span>
            ) : null}
          </div>
          <p className="rental-detail__brand">{truck.brand}</p>
          <h1>{[truck.model, truck.year].filter(Boolean).join(' · ') || truck.name}</h1>
          <RatingStars rating={Number(truck.avgRating)} reviewCount={truck.reviewCount} />
          <p className="rental-detail__fleet">{truck.fleetOwner.companyName}</p>

          {truck.dailyRentalPrice ? (
            <p className="rental-detail__price">
              {formatOMR(truck.dailyRentalPrice, locale)}
              <span>{t('rental.perDay')}</span>
            </p>
          ) : (
            <p className="rental-detail__price rental-detail__price--quote">{t('rental.requestQuote')}</p>
          )}

          <div className="rental-detail__cta">
            <Link
              href={`/marketplace/request?truck=${truck.slug}`}
              className="rental-btn rental-btn--primary rental-btn--block"
            >
              {t('rental.createShipmentRequest')}
            </Link>
            <a href="#quote" className="rental-btn rental-btn--ghost rental-btn--block">
              {t('profile.requestQuote')}
            </a>
          </div>

          <div className="rental-detail__rental-box">
            <h2>{t('rental.rentalDetails')}</h2>
            <dl className="rental-detail__rental-list">
              {rentalRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </section>

      <section className="container rental-detail__sections">
        <div className="rental-detail__main">
          <section className="rental-panel">
            <h2>{t('profile.specs')}</h2>
            <div className="rental-spec-grid">
              <div><span>{t('profile.category')}</span><strong>{t(`categories.${truck.vehicleCategory}`)}</strong></div>
              <div><span>{t('profile.type')}</span><strong>{t(`vehicleTypes.${truck.vehicleType}`)}</strong></div>
              {truck.capacityKg ? (
                <div><span>{t('profile.capacityKg')}</span><strong>{Number(truck.capacityKg).toLocaleString(locale)}</strong></div>
              ) : null}
              {truck.capacityCbm ? (
                <div><span>{t('profile.capacityCbm')}</span><strong>{Number(truck.capacityCbm)}</strong></div>
              ) : null}
              {truck.lengthM ? (
                <div><span>{t('form.length')}</span><strong>{Number(truck.lengthM)} m</strong></div>
              ) : null}
              {truck.widthM ? (
                <div><span>{t('form.width')}</span><strong>{Number(truck.widthM)} m</strong></div>
              ) : null}
              {truck.heightM ? (
                <div><span>{t('form.height')}</span><strong>{Number(truck.heightM)} m</strong></div>
              ) : null}
            </div>
            {capabilityItems.length > 0 ? (
              <div className="rental-card__tags">
                {capabilityItems.map((item) => (
                  <span key={item} className="rental-card__tag">{item}</span>
                ))}
              </div>
            ) : null}
          </section>

          {truck.description ? (
            <section className="rental-panel">
              <h2>{t('profile.description')}</h2>
              <p className="rental-detail__description">{truck.description}</p>
            </section>
          ) : null}

          {governorates.length > 0 ? (
            <section className="rental-panel">
              <h2>{t('rental.operatingAreas')}</h2>
              <div className="rental-area-tags">
                {governorates.map((region) => (
                  <span key={region.id} className="rental-card__tag">
                    {regionName(region, locale)}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rental-panel">
            <h2>{t('rental.fleetProfile')}</h2>
            <div className="rental-fleet-profile">
              <div className="rental-fleet-profile__avatar">{truck.fleetOwner.companyName.charAt(0)}</div>
              <div>
                <strong>{truck.fleetOwner.companyName}</strong>
                <p>{truck.completedDeliveries} {t('profile.deliveries')}</p>
                <p>{truck.fleetOwner._count?.truckListings ?? 0} {t('rental.trucksListed')}</p>
              </div>
            </div>
          </section>

          <section className="rental-panel" id="reviews">
            <h2>{t('profile.reviews')}</h2>
            {truck.reviews.length === 0 ? <p>{t('profile.noReviews')}</p> : null}
            <div className="rental-reviews">
              {truck.reviews.map((review) => (
                <article key={review.id} className="rental-review">
                  <div className="rental-review__head">
                    <strong>{review.customer?.customerProfile?.fullName ?? t('profile.anonymous')}</strong>
                    <RatingStars rating={review.overallScore} size="sm" />
                  </div>
                  {review.comment ? <p>{review.comment}</p> : null}
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="rental-detail__sidebar" id="quote" ref={quoteRef}>
          <form
            className="rental-quote-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setQuoteError(null);
              const user = getStoredUser();
              if (!user || user.role !== UserRole.CUSTOMER) {
                router.push('/login');
                return;
              }
              const fd = new FormData(e.currentTarget);
              try {
                await requestTruckQuote(truck.id, {
                  originCity: String(fd.get('originCity')),
                  originCountry: String(fd.get('originCountry') || 'OM'),
                  destCity: String(fd.get('destCity')),
                  destCountry: String(fd.get('destCountry') || 'OM'),
                  cargoDetails: String(fd.get('cargoDetails') || ''),
                });
                setQuoteSent(true);
              } catch (err) {
                setQuoteError(
                  isApiClientError(err) ? getLocalizedApiMessage(err, locale as 'en' | 'ar') : t('errors.generic'),
                );
              }
            }}
          >
            <h2>{t('profile.requestQuote')}</h2>
            <FormError message={quoteError} />
            {quoteSent ? <p className="form-success">{t('profile.quoteSent')}</p> : null}
            <label>
              {t('profile.originCity')}
              <input name="originCity" required defaultValue="Muscat" />
            </label>
            <label>
              {t('profile.originCountry')}
              <input name="originCountry" defaultValue="OM" />
            </label>
            <label>
              {t('profile.destCity')}
              <input name="destCity" required />
            </label>
            <label>
              {t('profile.destCountry')}
              <input name="destCountry" defaultValue="OM" />
            </label>
            <label>
              {t('profile.cargoDetails')}
              <textarea name="cargoDetails" rows={3} />
            </label>
            <button type="submit" className="rental-btn rental-btn--primary rental-btn--block">
              {t('profile.submitQuote')}
            </button>
          </form>
        </aside>
      </section>

      {similar.length > 0 ? (
        <section className="container rental-detail__similar">
          <h2>{t('rental.similarTrucks')}</h2>
          <div className="rental-grid">
            {similar.map((item) => (
              <TruckCard key={item.id} truck={item} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
