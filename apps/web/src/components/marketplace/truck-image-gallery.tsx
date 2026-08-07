'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { buildAssetUrl } from '@/lib/api-config';
import type { TruckListingImage } from '@/types/marketplace';

type TruckImageGalleryProps = {
  images: TruckListingImage[];
  coverUrl?: string | null;
  alt: string;
  hero?: boolean;
};

export function TruckImageGallery({ images, coverUrl, alt, hero = false }: TruckImageGalleryProps) {
  const t = useTranslations('marketplace');
  const sorted = useMemo(
    () => [...images].sort((a, b) => a.sortOrder - b.sortOrder),
    [images],
  );

  const galleryItems = useMemo(() => {
    const items: Array<{ url: string; thumb?: string | null }> = [];
    const cover = coverUrl ?? sorted.find((img) => img.isCover)?.url;
    if (cover) items.push({ url: cover, thumb: sorted.find((i) => i.url === cover)?.thumbnailUrl });
    for (const img of sorted) {
      if (img.url !== cover) items.push({ url: img.url, thumb: img.thumbnailUrl ?? img.url });
    }
    return items;
  }, [coverUrl, sorted]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const active = galleryItems[activeIndex];

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i <= 0 ? galleryItems.length - 1 : i - 1));
  }, [galleryItems.length]);

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i >= galleryItems.length - 1 ? 0 : i + 1));
  }, [galleryItems.length]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, goNext, goPrev]);

  if (!active) {
    return <div className={`rental-gallery rental-gallery--empty${hero ? ' rental-gallery--hero' : ''}`}>🚛</div>;
  }

  const mainClass = `rental-gallery${hero ? ' rental-gallery--hero' : ''}`;

  return (
    <>
      <div className={mainClass}>
        <div className="rental-gallery__main">
          <img src={buildAssetUrl(active.url)} alt={alt} />
          {galleryItems.length > 1 ? (
            <>
              <button type="button" className="rental-gallery__nav rental-gallery__nav--prev" onClick={goPrev} aria-label="Previous">
                ‹
              </button>
              <button type="button" className="rental-gallery__nav rental-gallery__nav--next" onClick={goNext} aria-label="Next">
                ›
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="rental-gallery__fullscreen"
            onClick={() => setFullscreen(true)}
          >
            {t('profile.fullscreen')}
          </button>
        </div>
        {galleryItems.length > 1 ? (
          <div className="rental-gallery__thumbs">
            {galleryItems.map((item, index) => (
              <button
                key={item.url}
                type="button"
                className={`rental-gallery__thumb${index === activeIndex ? ' rental-gallery__thumb--active' : ''}`}
                onClick={() => setActiveIndex(index)}
              >
                <img src={buildAssetUrl(item.thumb ?? item.url)} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {fullscreen ? (
        <div className="rental-gallery-lightbox" role="dialog" aria-modal="true">
          <button type="button" className="rental-gallery-lightbox__close" onClick={() => setFullscreen(false)}>
            {t('profile.closeGallery')}
          </button>
          <img src={buildAssetUrl(active.url)} alt={alt} />
          {galleryItems.length > 1 ? (
            <>
              <button type="button" className="rental-gallery-lightbox__prev" onClick={goPrev}>‹</button>
              <button type="button" className="rental-gallery-lightbox__next" onClick={goNext}>›</button>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
