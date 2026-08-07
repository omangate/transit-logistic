'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';

import {
  deleteTruckListingImage,
  setTruckListingCover,
  uploadTruckListingImages,
  uploadTruckListingVideo,
} from '@/lib/api';
import { buildAssetUrl } from '@/lib/api-config';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { TruckListingImage } from '@/types/marketplace';

type Props = {
  listingId: string;
  images: TruckListingImage[];
  coverUrl?: string | null;
  videoUrl?: string | null;
  onChange: () => void;
  locale: 'en' | 'ar';
};

type UploadItem = { id: string; name: string; progress: number; error?: string };

export function TruckMediaUploader({ listingId, images, coverUrl, videoUrl, onChange, locale }: Props) {
  const t = useTranslations('marketplace');
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [externalVideo, setExternalVideo] = useState('');

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;

      const batchId = crypto.randomUUID();
      setUploads((u) => [...u, { id: batchId, name: files.map((f) => f.name).join(', '), progress: 10 }]);

      try {
        setUploads((u) => u.map((item) => (item.id === batchId ? { ...item, progress: 60 } : item)));
        await uploadTruckListingImages(listingId, files);
        setUploads((u) => u.filter((item) => item.id !== batchId));
        onChange();
      } catch (err) {
        const msg = isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic');
        setUploads((u) =>
          u.map((item) => (item.id === batchId ? { ...item, progress: 0, error: msg } : item)),
        );
      }
    },
    [listingId, locale, onChange, t],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="media-uploader">
      <div
        className={`media-uploader__dropzone${dragOver ? ' media-uploader__dropzone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <p className="media-uploader__title">{t('form.uploadPhotos')}</p>
        <p className="media-uploader__hint">{t('form.uploadHint')}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          capture="environment"
          hidden
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
        />
      </div>

      {uploads.map((item) => (
        <div key={item.id} className="media-uploader__progress">
          <span>{item.name}</span>
          <div className="media-uploader__bar" style={{ width: `${item.progress}%` }} />
          {item.error ? (
            <button type="button" onClick={() => inputRef.current?.click()}>
              {t('form.retryUpload')}
            </button>
          ) : null}
        </div>
      ))}

      {sorted.length > 0 ? (
        <div className="media-uploader__grid">
          {sorted.map((img) => (
            <div key={img.id} className="media-uploader__item">
              <img src={buildAssetUrl(img.thumbnailUrl ?? img.url)} alt="" />
              <div className="media-uploader__actions">
                <button
                  type="button"
                  onClick={() => void setTruckListingCover(listingId, img.id).then(onChange)}
                >
                  {img.isCover || img.url === coverUrl ? t('form.cover') : t('form.setCover')}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteTruckListingImage(listingId, img.id).then(onChange)}
                >
                  {t('form.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="media-uploader__video">
        <p>{t('form.videoUpload')}</p>
        <input
          ref={videoRef}
          type="file"
          accept="video/mp4,video/webm"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void uploadTruckListingVideo(listingId, file).then(onChange);
          }}
        />
        <button type="button" className="rental-btn rental-btn--ghost" onClick={() => videoRef.current?.click()}>
          {t('form.uploadVideo')}
        </button>
        {videoUrl ? <p className="media-uploader__video-link">{videoUrl}</p> : null}
        <input
          type="url"
          placeholder={t('form.videoUrlFallback')}
          value={externalVideo}
          onChange={(e) => setExternalVideo(e.target.value)}
        />
      </div>
    </div>
  );
}
