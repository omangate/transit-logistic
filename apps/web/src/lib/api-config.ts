declare global {
  interface Window {
    __ENV?: {
      NEXT_PUBLIC_API_URL?: string;
    };
  }
}

const DEV_API_URL = 'http://localhost:3001';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

/** Resolve the API origin for HTTP requests (no `/api/v1` suffix). */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const runtimeUrl = window.__ENV?.NEXT_PUBLIC_API_URL?.trim();
    if (runtimeUrl) {
      return normalizeBaseUrl(runtimeUrl);
    }
  }

  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return normalizeBaseUrl(envUrl);
  }

  if (process.env.NODE_ENV === 'development') {
    return DEV_API_URL;
  }

  throw new Error(
    'NEXT_PUBLIC_API_URL is not configured. Set it in your deployment environment.',
  );
}

/** Server-only: read API URL from runtime env (supports non-public fallback). */
export function getServerApiBaseUrl(): string {
  const envUrl = (process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL)?.trim();
  if (envUrl) {
    return normalizeBaseUrl(envUrl);
  }

  if (process.env.NODE_ENV === 'development') {
    return DEV_API_URL;
  }

  return '';
}
