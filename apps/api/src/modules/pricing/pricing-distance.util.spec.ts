import { calculateRouteDistanceKm } from './pricing-distance.util';

describe('calculateRouteDistanceKm', () => {
  it('returns zero for fewer than two stops', () => {
    expect(calculateRouteDistanceKm([{ latitude: 24.7, longitude: 46.6 }])).toBe(0);
    expect(calculateRouteDistanceKm([])).toBe(0);
  });

  it('orders stops by sequence before summing segment distances', () => {
    const distance = calculateRouteDistanceKm([
      { latitude: 24.7136, longitude: 46.6753, sequence: 2 },
      { latitude: 24.7743, longitude: 46.7386, sequence: 1 },
    ]);

    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(20);
  });
});
