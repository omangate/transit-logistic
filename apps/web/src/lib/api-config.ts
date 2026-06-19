declare global {
  interface Window {
    __ENV?: {
      NEXT_PUBLIC_API_URL?: string;
    };
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function readConfiguredApiUrl(): string | undefined {
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

  return undefined;
}

/** API origin when an absolute URL is required (e.g. uploads). Empty when using same-origin proxy. */
export function getApiBaseUrl(): string {
  return readConfiguredApiUrl() ?? '';
}

/** Server-only: read API URL for runtime HTML injection. */
export function getServerApiBaseUrl(): string {
  return readConfiguredApiUrl() ?? '';
}

/** Build a fetch URL for `/api/v1` endpoints. Browser calls stay same-origin and use route handlers. */
export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const apiPath = normalizedPath.startsWith('/api/v1')
    ? normalizedPath
    : `/api/v1${normalizedPath}`;

  if (typeof window !== 'undefined') {
    return apiPath;
  }

  const base = readConfiguredApiUrl();
  return base ? `${base}${apiPath}` : apiPath;
}

/** Resolve a backend asset path (e.g. `/uploads/...`) for links and downloads. */
export function buildAssetUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined') {
    return normalizedPath;
  }

  const base = readConfiguredApiUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
