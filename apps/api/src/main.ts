import { join } from 'path';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  console.log(
    `[bootstrap] PORT=${process.env.PORT ?? '(unset)'} API_PORT=${process.env.API_PORT ?? '(unset)'} NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}`,
  );

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3001);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const uploadDir = config.get<string>('app.uploadDir', 'uploads');
  app.useStaticAssets(join(process.cwd(), uploadDir), { prefix: '/uploads/' });

  const configuredOrigins = config
    .get<string>('app.corsOrigin', 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const nodeEnv = config.get<string>('app.nodeEnv', 'development');

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean | string) => void,
    ) => {
      if (!origin) {
        callback(null, configuredOrigins[0]);
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

  await app.listen(port, '0.0.0.0');
  console.log(`API listening on port ${port}`);
}

void bootstrap().catch((error: unknown) => {
  console.error('Failed to start API:', error);
  process.exit(1);
});
