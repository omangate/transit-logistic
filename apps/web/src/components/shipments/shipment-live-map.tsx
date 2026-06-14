'use client';

import { useEffect, useState } from 'react';

import { getShipmentLiveTracking } from '@/lib/api';

type ShipmentLiveMapProps = {
  shipmentId: string;
  pickup?: { latitude: number; longitude: number };
  delivery?: { latitude: number; longitude: number };
};

export function ShipmentLiveMap({ shipmentId, pickup, delivery }: ShipmentLiveMapProps) {
  const [live, setLive] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const point = await getShipmentLiveTracking(shipmentId);
        if (!cancelled && point) {
          setLive({ latitude: Number(point.latitude), longitude: Number(point.longitude) });
        }
      } catch {
        if (!cancelled) {
          setLive(null);
        }
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [shipmentId]);

  const center = live ?? pickup ?? delivery;
  if (!center) {
    return null;
  }

  const delta = 0.08;
  const bbox = [
    center.longitude - delta,
    center.latitude - delta,
    center.longitude + delta,
    center.latitude + delta,
  ].join('%2C');

  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${center.latitude}%2C${center.longitude}`;

  return (
    <section className="panel">
      <iframe
        title="Live shipment map"
        src={src}
        style={{ width: '100%', height: '320px', border: 0, borderRadius: '0.75rem' }}
        loading="lazy"
      />
    </section>
  );
}
