import { distanceFromRouteSegmentMeters } from './route-deviation.util';

describe('route-deviation.util', () => {
  it('returns near-zero distance for points on the route segment', () => {
    const distance = distanceFromRouteSegmentMeters(24.7136, 46.6753, 24.7136, 46.6753, 24.75, 46.7);
    expect(distance).toBeLessThan(500);
  });
});
