import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Redis({
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string>('redis.password'),
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          connectTimeout: 10_000,
          retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
        });

        client.on('error', () => {
          // ioredis emits connection errors while reconnecting; health checks surface outages.
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
