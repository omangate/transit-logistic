import { distanceMeters, isWithinRadiusMeters } from './geofence.util';

describe('geofence.util', () => {
  it('returns zero distance for identical coordinates', () => {
    expect(distanceMeters(24.7136, 46.6753, 24.7136, 46.6753)).toBe(0);
  });

  it('detects points within a radius', () => {
    expect(isWithinRadiusMeters(24.7136, 46.6753, 24.7140, 46.6758, 500)).toBe(true);
  });

  it('detects points outside a radius', () => {
    expect(isWithinRadiusMeters(24.7136, 46.6753, 25.0, 47.0, 500)).toBe(false);
  });
});
