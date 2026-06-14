'use client';

import { useEffect, useState } from 'react';

import { useRouter } from '@/i18n/navigation';
import { getAccessToken, getStoredUser, hasAuthSession } from '@/lib/auth-storage';
import type { AuthUser } from '@/types/auth';

export function useRequireAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!hasAuthSession() || !getAccessToken()) {
      router.replace('/login');
      return;
    }

    setUser(getStoredUser());
    setIsReady(true);
  }, [router]);

  return { user, isReady };
}
