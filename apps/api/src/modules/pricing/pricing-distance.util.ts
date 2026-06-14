import { distanceMeters } from '../tracking/geofence.util';

export interface PricingCoordinate {
  latitude: number;
  longitude: number;
  sequence?: number;
}

export function calculateRouteDistanceKm(stops: PricingCoordinate[]): number {
  if (stops.length < 2) {
    return 0;
  }

  const ordered = [...stops].sort((left, right) => {
    const leftSequence = left.sequence ?? 0;
    const rightSequence = right.sequence ?? 0;
    return leftSequence - rightSequence;
  });

  let totalMeters = 0;

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const current = ordered[index]!;

    totalMeters += distanceMeters(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude,
    );
  }

  return totalMeters / 1000;
}
