import { BadRequestException, Injectable } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';

const TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.draft]: [ShipmentStatus.pending_assignment, ShipmentStatus.cancelled],
  [ShipmentStatus.pending_assignment]: [
    ShipmentStatus.assigned,
    ShipmentStatus.cancelled,
  ],
  [ShipmentStatus.assigned]: [ShipmentStatus.picked_up, ShipmentStatus.cancelled],
  [ShipmentStatus.picked_up]: [ShipmentStatus.in_transit],
  [ShipmentStatus.in_transit]: [ShipmentStatus.delivered],
  [ShipmentStatus.delivered]: [ShipmentStatus.completed],
  [ShipmentStatus.completed]: [],
  [ShipmentStatus.cancelled]: [],
};

@Injectable()
export class ShipmentStateService {
  assertTransition(from: ShipmentStatus, to: ShipmentStatus) {
    const allowed = TRANSITIONS[from] ?? [];

    if (!allowed.includes(to)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message_en: `Cannot transition shipment from ${from} to ${to}.`,
        message_ar: `لا يمكن تغيير حالة الشحنة من ${from} إلى ${to}.`,
      });
    }
  }
}
