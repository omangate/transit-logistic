import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@transit-logistic/shared'],
  reactStrictMode: true,
  async rewrites() {
    const configured =
      process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_URL?.trim() ?? '';
    const apiOrigin = configured.replace(/\/$/, '').replace(/\/api\/v1\/?$/, '');

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
