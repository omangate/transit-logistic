import { BadRequestException, Injectable } from '@nestjs/common';
import { PayoutRequestStatus } from '@transit-logistic/shared';

const TRANSITIONS: Record<PayoutRequestStatus, PayoutRequestStatus[]> = {
  [PayoutRequestStatus.PENDING]: [
    PayoutRequestStatus.APPROVED,
    PayoutRequestStatus.REJECTED,
  ],
  [PayoutRequestStatus.APPROVED]: [
    PayoutRequestStatus.PROCESSED,
    PayoutRequestStatus.REJECTED,
  ],
  [PayoutRequestStatus.REJECTED]: [],
  [PayoutRequestStatus.PROCESSED]: [],
};

@Injectable()
export class PayoutStateService {
  assertTransition(from: PayoutRequestStatus, to: PayoutRequestStatus) {
    const allowed = TRANSITIONS[from] ?? [];

    if (!allowed.includes(to)) {
      throw new BadRequestException({
        code: 'INVALID_PAYOUT_STATUS_TRANSITION',
        message_en: `Cannot transition payout from ${from} to ${to}.`,
        message_ar: `لا يمكن تغيير حالة طلب السحب من ${from} إلى ${to}.`,
      });
    }
  }
}
