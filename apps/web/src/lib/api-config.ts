export const PRODUCTION_API_ORIGIN = 'https://transit-logistic-production.up.railway.app';

function normalizeApiOrigin(url: string): string {
  return url.replace(/\/$/, '').replace(/\/api\/v1\/?$/, '');
}

/** Resolved API origin for server-side proxy and SSR fetches. */
export function getApiOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_URL?.trim();

  if (configured) {
    return normalizeApiOrigin(configured);
  }

  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_API_ORIGIN;
  }

  return '';
}

/** Build a fetch URL for `/api/v1` endpoints. Browser calls stay same-origin via route handlers. */
export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const apiPath = normalizedPath.startsWith('/api/v1')
    ? normalizedPath
    : `/api/v1${normalizedPath}`;

  if (typeof window !== 'undefined') {
    return apiPath;
  }

  const base = getApiOrigin();
  return base ? `${base}${apiPath}` : apiPath;
}

/** Resolve a backend asset path (e.g. `/uploads/...`) for links and downloads. */
export function buildAssetUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined') {
    return normalizedPath;
  }

  const base = getApiOrigin();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
