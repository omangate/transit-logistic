import { GlobalTrackingSearchType, TrackingMode } from '@transit-logistic/shared';

const CONTAINER_PATTERN = /^[A-Z]{4}\d{7}$/i;
const AWB_PATTERN = /^\d{3}-?\d{8}$/;

export function detectTrackingMode(reference: string): TrackingMode | 'all' {
  const normalized = reference.trim().toUpperCase().replace(/\s+/g, '');

  if (CONTAINER_PATTERN.test(normalized)) {
    return TrackingMode.OCEAN;
  }

  if (AWB_PATTERN.test(normalized) || /^\d{11}$/.test(normalized.replace(/-/g, ''))) {
    return TrackingMode.AIR;
  }

  if (/^TL[-\d]/i.test(reference.trim()) || /^TRK[-\d]/i.test(reference.trim())) {
    return TrackingMode.ROAD;
  }

  return 'all';
}

export function detectSearchType(reference: string, mode: TrackingMode | 'all'): GlobalTrackingSearchType {
  const normalized = reference.trim().toUpperCase().replace(/\s+/g, '');

  if (mode === TrackingMode.OCEAN || mode === 'all') {
    if (CONTAINER_PATTERN.test(normalized)) {
      return GlobalTrackingSearchType.CONTAINER;
    }
    if (/^[A-Z]{4}\d{8,}$/.test(normalized)) {
      return GlobalTrackingSearchType.BILL_OF_LADING;
    }
  }

  if (mode === TrackingMode.AIR || mode === 'all') {
    if (/^\d{3}-?\d{8}$/.test(normalized) || /^\d{11}$/.test(normalized.replace(/-/g, ''))) {
      return GlobalTrackingSearchType.AWB;
    }
    if (/^MAWB/i.test(reference.trim())) {
      return GlobalTrackingSearchType.MAWB;
    }
    if (/^HAWB/i.test(reference.trim())) {
      return GlobalTrackingSearchType.HAWB;
    }
  }

  if (mode === TrackingMode.ROAD) {
    if (/^TRK|^VEH|^TRUCK/i.test(reference.trim())) {
      return GlobalTrackingSearchType.TRUCK;
    }
    return GlobalTrackingSearchType.SHIPMENT_REFERENCE;
  }

  return GlobalTrackingSearchType.REFERENCE;
}

export function normalizeReference(reference: string): string {
  return reference.trim();
}
