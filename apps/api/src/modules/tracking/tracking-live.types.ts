export interface LiveTrackingPosition {
  id: string;
  shipmentId: string;
  latitude: string;
  longitude: string;
  speed: string | null;
  heading: string | null;
  recordedAt: string;
  createdAt: string;
}
