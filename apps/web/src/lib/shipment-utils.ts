import { ShipmentStatus } from '@transit-logistic/shared';

import type { Shipment } from '@/types/shipment';

const ACTIVE_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.PENDING_ASSIGNMENT,
  ShipmentStatus.ASSIGNED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
];

export function countShipmentsByStatus(shipments: Shipment[], status: ShipmentStatus): number {
  return shipments.filter((shipment) => shipment.status === status).length;
}

export function countActiveShipments(shipments: Shipment[]): number {
  return shipments.filter((shipment) => ACTIVE_STATUSES.includes(shipment.status)).length;
}

export function getPickupStop(shipment: Shipment) {
  return shipment.stops.find((stop) => stop.stopType === 'pickup') ?? shipment.stops[0];
}

export function getDeliveryStop(shipment: Shipment) {
  return shipment.stops.find((stop) => stop.stopType === 'delivery') ?? shipment.stops.at(-1);
}

export function formatRoute(shipment: Shipment): string {
  const pickup = getPickupStop(shipment);
  const delivery = getDeliveryStop(shipment);

  if (!pickup || !delivery) {
    return '—';
  }

  return `${pickup.city} → ${delivery.city}`;
}

export function formatDate(value: string | null, locale: string): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatAmount(amount: string | null | undefined, currency = 'OMR'): string {
  if (!amount) {
    return '—';
  }

  return `${Number(amount).toFixed(3)} ${currency}`;
}
