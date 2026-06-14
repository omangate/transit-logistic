import { BadRequestException, Injectable } from '@nestjs/common';
import { PayoutRequestStatus } from '@prisma/client';

const TRANSITIONS: Record<PayoutRequestStatus, PayoutRequestStatus[]> = {
  [PayoutRequestStatus.pending]: [
    PayoutRequestStatus.approved,
    PayoutRequestStatus.rejected,
  ],
  [PayoutRequestStatus.approved]: [
    PayoutRequestStatus.processed,
    PayoutRequestStatus.rejected,
  ],
  [PayoutRequestStatus.rejected]: [],
  [PayoutRequestStatus.processed]: [],
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
