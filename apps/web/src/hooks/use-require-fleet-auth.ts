'use client';

import { UserRole } from '@transit-logistic/shared';
import { useEffect, useState } from 'react';

import { useRouter } from '@/i18n/navigation';
import { getAccessToken, getStoredUser, hasAuthSession } from '@/lib/auth-storage';
import type { AuthUser } from '@/types/auth';

export function useRequireFleetAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!hasAuthSession() || !getAccessToken()) {
      router.replace('/login');
      return;
    }

    const storedUser = getStoredUser();

    if (!storedUser || storedUser.role !== UserRole.FLEET_OWNER) {
      router.replace('/dashboard');
      return;
    }

    setUser(storedUser);
    setIsReady(true);
  }, [router]);

  return { user, isReady };
}
