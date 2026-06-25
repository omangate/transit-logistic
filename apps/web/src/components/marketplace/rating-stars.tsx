type RatingStarsProps = {
  rating: number;
  reviewCount?: number;
  size?: 'sm' | 'md';
};

export function RatingStars({ rating, reviewCount, size = 'md' }: RatingStarsProps) {
  const clamped = Math.min(5, Math.max(0, rating));
  const full = Math.floor(clamped);
  const hasHalf = clamped - full >= 0.25 && clamped - full < 0.75;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <span className={`rental-rating rental-rating--${size}`} aria-label={`${clamped.toFixed(1)} / 5`}>
      <span className="rental-rating__stars" aria-hidden>
        {'★'.repeat(full)}
        {hasHalf ? '⯨' : ''}
        {'☆'.repeat(empty)}
      </span>
      <span className="rental-rating__value">{clamped.toFixed(1)}</span>
      {reviewCount !== undefined ? (
        <span className="rental-rating__count">({reviewCount})</span>
      ) : null}
    </span>
  );
}
