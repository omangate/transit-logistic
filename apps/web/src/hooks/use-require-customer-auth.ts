'use client';

import { UserRole } from '@transit-logistic/shared';
import { useEffect, useState } from 'react';

import { useRouter } from '@/i18n/navigation';
import { getAccessToken, getStoredUser, hasAuthSession } from '@/lib/auth-storage';
import type { AuthUser } from '@/types/auth';

export function useRequireCustomerAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!hasAuthSession() || !getAccessToken()) {
      router.replace('/login');
      return;
    }

    const storedUser = getStoredUser();

    if (!storedUser) {
      router.replace('/login');
      return;
    }

    if (storedUser.role === UserRole.FLEET_OWNER) {
      router.replace('/fleet/logistics');
      return;
    }

    if (storedUser.role === UserRole.DRIVER) {
      router.replace('/driver/dashboard');
      return;
    }

    if (storedUser.role !== UserRole.CUSTOMER && storedUser.role !== UserRole.ADMIN) {
      router.replace('/login');
      return;
    }

    setUser(storedUser);
    setIsReady(true);
  }, [router]);

  return { user, isReady };
}
