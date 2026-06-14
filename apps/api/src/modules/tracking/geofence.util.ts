const EARTH_RADIUS_METERS = 6_371_000;

export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinRadiusMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusMeters: number,
): boolean {
  return distanceMeters(lat1, lon1, lat2, lon2) <= radiusMeters;
}
