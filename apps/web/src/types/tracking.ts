import type { ShipmentStatus } from '@transit-logistic/shared';

export interface PublicTrackingStop {
  address: string;
  city: string;
  latitude: string | number;
  longitude: string | number;
}

export interface PublicTrackingTimelineEntry {
  fromStatus: string | null;
  toStatus: string;
  createdAt: string;
  note: string | null;
}

export interface PublicTracking {
  referenceNumber: string;
  status: ShipmentStatus;
  cargoDescription: string | null;
  scheduledAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  estimatedDeliveryAt: string | null;
  pickup: PublicTrackingStop | null;
  delivery: PublicTrackingStop | null;
  timeline: PublicTrackingTimelineEntry[];
  livePosition?: {
    latitude: number;
    longitude: number;
    speed: number | null;
    recordedAt: string;
  } | null;
}
