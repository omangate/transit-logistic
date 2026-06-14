import type { ShipmentStatus } from '@transit-logistic/shared';

const STATUS_CLASS: Record<ShipmentStatus, string> = {
  draft: 'status-badge--draft',
  pending_assignment: 'status-badge--pending',
  assigned: 'status-badge--assigned',
  picked_up: 'status-badge--transit',
  in_transit: 'status-badge--transit',
  delivered: 'status-badge--delivered',
  completed: 'status-badge--completed',
  cancelled: 'status-badge--cancelled',
};

type StatusBadgeProps = {
  status: ShipmentStatus;
  label: string;
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return <span className={`status-badge ${STATUS_CLASS[status]}`}>{label}</span>;
}
