import { BadRequestException } from '@nestjs/common';
import { PayoutRequestStatus } from '@prisma/client';

import { PayoutStateService } from './payout-state.service';

describe('PayoutStateService', () => {
  const service = new PayoutStateService();

  it('allows pending to approved and rejected', () => {
    expect(() =>
      service.assertTransition(PayoutRequestStatus.pending, PayoutRequestStatus.approved),
    ).not.toThrow();
    expect(() =>
      service.assertTransition(PayoutRequestStatus.pending, PayoutRequestStatus.rejected),
    ).not.toThrow();
  });

  it('allows approved to processed and rejected', () => {
    expect(() =>
      service.assertTransition(PayoutRequestStatus.approved, PayoutRequestStatus.processed),
    ).not.toThrow();
    expect(() =>
      service.assertTransition(PayoutRequestStatus.approved, PayoutRequestStatus.rejected),
    ).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() =>
      service.assertTransition(PayoutRequestStatus.pending, PayoutRequestStatus.processed),
    ).toThrow(BadRequestException);
    expect(() =>
      service.assertTransition(PayoutRequestStatus.processed, PayoutRequestStatus.approved),
    ).toThrow(BadRequestException);
  });
});
