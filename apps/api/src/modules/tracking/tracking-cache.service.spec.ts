import type { ConfigService } from '@nestjs/config';

import { TrackingCacheService } from './tracking-cache.service';
import type { LiveTrackingPosition } from './tracking-live.types';

describe('TrackingCacheService', () => {
  const position: LiveTrackingPosition = {
    id: '1',
    shipmentId: 'shipment-1',
    latitude: '24.7136000',
    longitude: '46.6753000',
    speed: '40.00',
    heading: '90.00',
    recordedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const redis = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const config = {
    get: jest.fn().mockReturnValue(3600),
  };

  let service: TrackingCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrackingCacheService(redis as never, config as unknown as ConfigService);
  });

  it('stores live positions in Redis with TTL', async () => {
    await service.setLivePosition('shipment-1', position);

    expect(redis.set).toHaveBeenCalledWith(
      'tracking:live:shipment-1',
      JSON.stringify(position),
      'EX',
      3600,
    );
  });

  it('reads cached live positions', async () => {
    redis.get.mockResolvedValue(JSON.stringify(position));

    const result = await service.getLivePosition('shipment-1');

    expect(result).toEqual(position);
  });

  it('returns null when cache is empty', async () => {
    redis.get.mockResolvedValue(null);

    const result = await service.getLivePosition('shipment-1');

    expect(result).toBeNull();
  });
});
