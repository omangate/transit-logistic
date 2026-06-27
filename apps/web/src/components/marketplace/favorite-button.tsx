'use client';

import { UserRole } from '@transit-logistic/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useRouter } from '@/i18n/navigation';
import { addTruckFavorite, removeTruckFavorite } from '@/lib/api';
import { getStoredUser } from '@/lib/auth-storage';

type FavoriteButtonProps = {
  truckId: string;
  initialFavorited?: boolean;
};

export function FavoriteButton({ truckId, initialFavorited = false }: FavoriteButtonProps) {
  const t = useTranslations('marketplace');
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      className={`favorite-btn${favorited ? ' favorite-btn--active' : ''}`}
      aria-label={favorited ? t('favorites.remove') : t('favorites.add')}
      disabled={loading}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const user = getStoredUser();
        if (!user || user.role !== UserRole.CUSTOMER) {
          router.push('/login');
          return;
        }
        setLoading(true);
        try {
          if (favorited) {
            await removeTruckFavorite(truckId);
            setFavorited(false);
          } else {
            await addTruckFavorite(truckId);
            setFavorited(true);
          }
        } finally {
          setLoading(false);
        }
      }}
    >
      {favorited ? '♥' : '♡'}
    </button>
  );
}
