import type { AuthUser } from '@/types/auth';

const ACCESS_TOKEN_KEY = 'tl_access_token';
const REFRESH_TOKEN_KEY = 'tl_refresh_token';
const USER_KEY = 'tl_user';

export function storeAuthSession(input: {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}) {
  if (!input.accessToken || !input.refreshToken || !input.user?.id) {
    throw new Error('Invalid auth session payload');
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, input.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, input.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(input.user));
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function hasAuthSession(): boolean {
  return Boolean(getAccessToken() && getRefreshToken() && getStoredUser());
}
