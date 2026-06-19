import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

function proxyToApi(request: NextRequest, pathname: string): NextResponse | null {
  const apiOrigin = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (!apiOrigin) {
    return null;
  }

  const target = new URL(`${pathname}${request.nextUrl.search}`, apiOrigin);
  return NextResponse.rewrite(target);
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/v1/')) {
    const proxied = proxyToApi(request, pathname);
    if (proxied) {
      return proxied;
    }
  }

  if (pathname.startsWith('/uploads/')) {
    const proxied = proxyToApi(request, pathname);
    if (proxied) {
      return proxied;
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(ar|en)/:path*', '/api/v1/:path*', '/uploads/:path*'],
};
