import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { PRODUCTION_API_ORIGIN } from './src/lib/api-config';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

function resolveApiOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_URL?.trim() ?? '';

  if (configured) {
    return configured.replace(/\/$/, '').replace(/\/api\/v1\/?$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_API_ORIGIN;
  }

  return '';
}

const nextConfig: NextConfig = {
  transpilePackages: ['@transit-logistic/shared'],
  reactStrictMode: true,
  async rewrites() {
    const apiOrigin = resolveApiOrigin();

    if (!apiOrigin) {
      return [];
    }

    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin}/api/v1/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiOrigin}/uploads/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
