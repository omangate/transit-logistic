'use client';

import { OMAN_MAP_CENTER } from '@transit-logistic/shared';
import dynamic from 'next/dynamic';

import 'leaflet/dist/leaflet.css';

const MapInner = dynamic(() => import('./oman-map-inner').then((m) => m.OmanMapInner), {
  ssr: false,
  loading: () => <div className="oman-map oman-map--loading">Loading map…</div>,
});

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
};

type OmanMapProps = {
  markers?: MapMarker[];
  center?: { latitude: number; longitude: number };
  zoom?: number;
  height?: number;
  onMapClick?: (lat: number, lng: number) => void;
};

export function OmanMap({
  markers = [],
  center = OMAN_MAP_CENTER,
  zoom = OMAN_MAP_CENTER.zoom,
  height = 320,
  onMapClick,
}: OmanMapProps) {
  return (
    <div className="oman-map" style={{ height }}>
      <MapInner
        markers={markers}
        center={[center.latitude, center.longitude]}
        zoom={zoom}
        onMapClick={onMapClick}
      />
    </div>
  );
}
