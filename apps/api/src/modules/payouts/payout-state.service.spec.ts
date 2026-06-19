import { BadRequestException } from '@nestjs/common';
import { PayoutRequestStatus } from '@transit-logistic/shared';

import { PayoutStateService } from './payout-state.service';

describe('PayoutStateService', () => {
  const service = new PayoutStateService();

  it('allows pending to approved and rejected', () => {
    expect(() =>
      service.assertTransition(PayoutRequestStatus.PENDING, PayoutRequestStatus.APPROVED),
    ).not.toThrow();
    expect(() =>
      service.assertTransition(PayoutRequestStatus.PENDING, PayoutRequestStatus.REJECTED),
    ).not.toThrow();
  });

  it('allows approved to processed and rejected', () => {
    expect(() =>
      service.assertTransition(PayoutRequestStatus.APPROVED, PayoutRequestStatus.PROCESSED),
    ).not.toThrow();
    expect(() =>
      service.assertTransition(PayoutRequestStatus.APPROVED, PayoutRequestStatus.REJECTED),
    ).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() =>
      service.assertTransition(PayoutRequestStatus.PENDING, PayoutRequestStatus.PROCESSED),
    ).toThrow(BadRequestException);
    expect(() =>
      service.assertTransition(PayoutRequestStatus.PROCESSED, PayoutRequestStatus.APPROVED),
    ).toThrow(BadRequestException);
  });
});
