import { ConfigService } from '@nestjs/config';
import { createNestApp } from './netlify-app.factory';

async function bootstrap() {
  console.log(
    `[bootstrap] PORT=${process.env.PORT ?? '(unset)'} API_PORT=${process.env.API_PORT ?? '(unset)'} NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}`,
  );

  const app = await createNestApp({ serverless: false });
  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3001);

  await app.listen(port, '0.0.0.0');
  console.log(`API listening on 0.0.0.0:${port}`);
}

void bootstrap().catch((error: unknown) => {
  console.error('Failed to start API:', error);
  process.exit(1);
});
