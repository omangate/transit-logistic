import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { PRODUCTION_API_ORIGIN } from './src/lib/api-config';

// Railway and other hosts often set NODE_ENV=development during `next build`, which
// makes Next prerender pages-router /404 and /500 with next/document Html and fails.
if (process.argv.some((arg) => arg.includes('build')) && process.env.NODE_ENV !== 'production') {
  process.env.NODE_ENV = 'production';
}

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
