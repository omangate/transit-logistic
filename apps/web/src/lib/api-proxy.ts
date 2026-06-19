import { NextResponse, type NextRequest } from 'next/server';

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

export function getApiOrigin(): string | null {
  const configured =
    process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_URL?.trim() ?? null;

  if (!configured) {
    return null;
  }

  return configured.replace(/\/$/, '').replace(/\/api\/v1\/?$/, '');
}

export async function proxyToBackend(
  request: NextRequest,
  backendPath: string,
): Promise<NextResponse> {
  const origin = getApiOrigin();
  if (!origin) {
    return NextResponse.json(
      {
        code: 'API_NOT_CONFIGURED',
        message_en: 'NEXT_PUBLIC_API_URL is not configured on the web service.',
        message_ar: 'لم يتم تكوين NEXT_PUBLIC_API_URL على خدمة الويب.',
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
