import { BadRequestException, Injectable } from '@nestjs/common';
import { ShipmentStatus } from '@transit-logistic/shared';

const TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.DRAFT]: [ShipmentStatus.PENDING_ASSIGNMENT, ShipmentStatus.CANCELLED],
  [ShipmentStatus.PENDING_ASSIGNMENT]: [
    ShipmentStatus.ASSIGNED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.ASSIGNED]: [ShipmentStatus.PICKED_UP, ShipmentStatus.CANCELLED],
  [ShipmentStatus.PICKED_UP]: [ShipmentStatus.IN_TRANSIT],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED],
  [ShipmentStatus.DELIVERED]: [ShipmentStatus.COMPLETED],
  [ShipmentStatus.COMPLETED]: [],
  [ShipmentStatus.CANCELLED]: [],
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
