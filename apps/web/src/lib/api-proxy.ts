import { NextResponse, type NextRequest } from 'next/server';

import { getApiOrigin } from '@/lib/api-config';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

export async function proxyToBackend(
  request: NextRequest,
  backendPath: string,
): Promise<NextResponse> {
  const origin = getApiOrigin();
  if (!origin) {
    return NextResponse.json(
      {
        code: 'API_NOT_CONFIGURED',
        message_en: 'API URL is not configured. Set NEXT_PUBLIC_API_URL for local development.',
        message_ar: 'لم يتم تكوين عنوان واجهة برمجة التطبيقات. عيّن NEXT_PUBLIC_API_URL للتطوير المحلي.',
      },
      { status: 503 },
    );
  }

  const normalizedPath = backendPath.startsWith('/') ? backendPath : `/${backendPath}`;
  const targetUrl = `${origin}${normalizedPath}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  let backendResponse: Response;

  try {
    backendResponse = await fetch(targetUrl, init);
  } catch {
    return NextResponse.json(
      {
        code: 'API_UNREACHABLE',
        message_en: 'Unable to reach the API server.',
        message_ar: 'تعذر الوصول إلى خادم واجهة برمجة التطبيقات.',
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  backendResponse.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders,
  });
}
