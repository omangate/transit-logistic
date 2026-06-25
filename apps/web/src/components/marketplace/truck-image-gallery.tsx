'use client';

import { useState } from 'react';

import { buildAssetUrl } from '@/lib/api-config';
import type { TruckListingImage } from '@/types/marketplace';

type TruckImageGalleryProps = {
  images: TruckListingImage[];
  coverUrl?: string | null;
  alt: string;
};

export function TruckImageGallery({ images, coverUrl, alt }: TruckImageGalleryProps) {
  const allUrls = [
    ...(coverUrl ? [coverUrl] : []),
    ...images.filter((img) => img.url !== coverUrl).map((img) => img.url),
  ];
  const uniqueUrls = [...new Set(allUrls)];
  const [activeIndex, setActiveIndex] = useState(0);
  const activeUrl = uniqueUrls[activeIndex] ?? uniqueUrls[0];

  if (!activeUrl) {
    return <div className="rental-gallery rental-gallery--empty">🚛</div>;
  }

  return (
    <div className="rental-gallery">
      <div className="rental-gallery__main">
        <img src={buildAssetUrl(activeUrl)} alt={alt} />
      </div>
      {uniqueUrls.length > 1 ? (
        <div className="rental-gallery__thumbs">
          {uniqueUrls.map((url, index) => (
            <button
              key={url}
              type="button"
              className={`rental-gallery__thumb${index === activeIndex ? ' rental-gallery__thumb--active' : ''}`}
              onClick={() => setActiveIndex(index)}
            >
              <img src={buildAssetUrl(url)} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
