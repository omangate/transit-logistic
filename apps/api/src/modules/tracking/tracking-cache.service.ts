/* eslint-disable @typescript-eslint/consistent-type-imports -- Nest DI needs runtime injection tokens */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../../redis/redis.module';

import type { LiveTrackingPosition } from './tracking-live.types';

@Injectable()
export class TrackingCacheService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async setLivePosition(shipmentId: string, position: LiveTrackingPosition): Promise<void> {
    const ttlSeconds = this.config.get<number>('tracking.liveCacheTtlSeconds', 86_400);
    await this.redis.set(
      this.buildKey(shipmentId),
      JSON.stringify(position),
      'EX',
      ttlSeconds,
    );
  }

  async getLivePosition(shipmentId: string): Promise<LiveTrackingPosition | null> {
    const cached = await this.redis.get(this.buildKey(shipmentId));
    if (!cached) {
      return null;
    }

    return JSON.parse(cached) as LiveTrackingPosition;
  }

  async deleteLivePosition(shipmentId: string): Promise<void> {
    await this.redis.del(this.buildKey(shipmentId));
  }

  private buildKey(shipmentId: string): string {
    return `tracking:live:${shipmentId}`;
  }
}
