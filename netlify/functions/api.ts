import type { Handler, HandlerContext, HandlerEvent } from '@netlify/functions';
import serverless from 'serverless-http';

process.env.NETLIFY = 'true';

type ServerlessHandler = (
  event: HandlerEvent,
  context: HandlerContext,
) => Promise<unknown>;

let cachedHandler: ServerlessHandler | null = null;

async function getHandler(): Promise<ServerlessHandler> {
  if (cachedHandler) return cachedHandler;

  const { createNestApp } = await import('../../apps/api/dist/netlify-app.factory.js');
  const app = await createNestApp({ serverless: true });
  const expressApp = app.getHttpAdapter().getInstance();

  cachedHandler = serverless(expressApp, {
    binary: [
      'application/pdf',
      'application/octet-stream',
      'image/*',
      'video/*',
      'multipart/form-data',
    ],
  }) as ServerlessHandler;

  return cachedHandler;
}

export const handler: Handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const fn = await getHandler();
  return fn(event, context);
};
