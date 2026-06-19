import type { NextRequest } from 'next/server';

import { proxyToBackend } from '@/lib/api-proxy';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function handle(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToBackend(request, `/uploads/${path.join('/')}`);
}

export const GET = handle;
export const HEAD = handle;
