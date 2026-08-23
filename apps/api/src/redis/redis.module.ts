import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { MemoryCacheClient } from '../cache/memory-cache.client';
import { PostgresCacheClient } from '../cache/postgres-cache.client';
import type { CacheLike } from '../cache/cache.types';
import { PrismaService } from '../database/prisma.service';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const CACHE_PROVIDER = Symbol('CACHE_PROVIDER');

function resolveCacheProvider(config: ConfigService): 'redis' | 'postgres' | 'memory' {
  const explicit = config.get<string>('cache.provider');
  if (explicit === 'redis' || explicit === 'postgres' || explicit === 'memory') {
    return explicit;
  }
  if (process.env.NETLIFY === 'true' || process.env.NETLIFY_TEST_STACK === 'true') {
    return 'postgres';
  }
  const redisHost = config.get<string>('redis.host', 'localhost');
  if (redisHost && redisHost !== 'disabled') {
    return 'redis';
  }
  return 'memory';
}

@Global()
@Module({
  providers: [
    {
      provide: CACHE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => resolveCacheProvider(config),
    },
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService, PrismaService, CACHE_PROVIDER],
      useFactory: (config: ConfigService, prisma: PrismaService, provider: string): CacheLike => {
        if (provider === 'postgres') {
          return new PostgresCacheClient(prisma);
        }
        if (provider === 'memory') {
          return new MemoryCacheClient();
        }

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

        return client as unknown as CacheLike;
      },
    },
  ],
  exports: [REDIS_CLIENT, CACHE_PROVIDER],
})
export class RedisModule {}
