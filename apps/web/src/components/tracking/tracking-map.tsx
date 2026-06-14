'use client';



type TrackingMapProps = {
  center: { latitude: number; longitude: number };
  title?: string;
  embedded?: boolean;
};

export function TrackingMap({ center, title = 'Shipment map', embedded = false }: TrackingMapProps) {
  const delta = 0.08;
  const bbox = [
    center.longitude - delta,
    center.latitude - delta,
    center.longitude + delta,
    center.latitude + delta,
  ].join('%2C');

  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${center.latitude}%2C${center.longitude}`;

  const map = (
    <iframe
      title={title}
      src={src}
      style={{ width: '100%', height: '320px', border: 0, borderRadius: '0.75rem' }}
      loading="lazy"
    />
  );

  if (embedded) {
    return map;
  }

  return <section className="panel">{map}</section>;
}


