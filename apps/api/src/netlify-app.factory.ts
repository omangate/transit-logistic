import { join } from 'path';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

function registerProbeRoutes(app: NestExpressApplication) {
  const expressApp = app.getHttpAdapter().getInstance();
  const ok = (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(200).json({ status: 'ok' });
  };

  expressApp.get('/', ok);
  expressApp.get('/health', ok);
  expressApp.get('/health/live', ok);
  expressApp.get('/api/v1/health/live', ok);
}

/** Bootstrap NestJS for long-running servers (Railway) or Netlify Functions (serverless). */
export async function createNestApp(options: { serverless?: boolean } = {}): Promise<NestExpressApplication> {
  const serverless = options.serverless ?? process.env.NETLIFY === 'true';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger: serverless ? ['error', 'warn', 'log'] : undefined,
  });

  if (!serverless) {
    app.useWebSocketAdapter(new IoAdapter(app));
  }

  const config = app.get(ConfigService);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  if (!serverless) {
    const uploadDir = config.get<string>('app.uploadDir', 'uploads');
    app.useStaticAssets(join(process.cwd(), uploadDir), { prefix: '/uploads/' });
  }

  const configuredOrigins = config
    .get<string>('app.corsOrigin', 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const nodeEnv = config.get<string>('app.nodeEnv', 'development');
  const webUrl = config.get<string>('app.webUrl', '');
  if (webUrl && !configuredOrigins.includes(webUrl)) {
    configuredOrigins.push(webUrl);
  }

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean | string) => void,
    ) => {
      if (!origin) {
        callback(null, configuredOrigins[0] ?? true);
        return;
      }

      if (configuredOrigins.includes(origin)) {
        callback(null, origin);
        return;
      }

      if (
        nodeEnv !== 'production' &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, origin);
        return;
      }

      if (/^https:\/\/[\w-]+\.netlify\.app$/.test(origin)) {
        callback(null, origin);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  registerProbeRoutes(app);
  await app.init();
  return app;
}
