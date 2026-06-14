const EARTH_RADIUS_M = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Distance in meters from point to the segment between two route stops. */
export function distanceFromRouteSegmentMeters(
  pointLat: number,
  pointLon: number,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
): number {
  const segmentLength = haversineMeters(startLat, startLon, endLat, endLon);
  if (segmentLength < 1) {
    return haversineMeters(pointLat, pointLon, startLat, startLon);
  }

  const samples = 20;
  let minDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index <= samples; index += 1) {
    const ratio = index / samples;
    const sampleLat = startLat + (endLat - startLat) * ratio;
    const sampleLon = startLon + (endLon - startLon) * ratio;
    minDistance = Math.min(minDistance, haversineMeters(pointLat, pointLon, sampleLat, sampleLon));
  }

  return minDistance;
}
