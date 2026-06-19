import { PayoutRequestStatus } from '@transit-logistic/shared';

export type PayoutApiStatus = 'pending' | 'approved' | 'rejected' | 'paid';

const DB_TO_API: Record<PayoutRequestStatus, PayoutApiStatus> = {
  [PayoutRequestStatus.PENDING]: 'pending',
  [PayoutRequestStatus.APPROVED]: 'approved',
  [PayoutRequestStatus.REJECTED]: 'rejected',
  [PayoutRequestStatus.PROCESSED]: 'paid',
};

const API_TO_DB: Record<PayoutApiStatus, PayoutRequestStatus> = {
  pending: PayoutRequestStatus.PENDING,
  approved: PayoutRequestStatus.APPROVED,
  rejected: PayoutRequestStatus.REJECTED,
  paid: PayoutRequestStatus.PROCESSED,
};

export function toApiPayoutStatus(status: PayoutRequestStatus): PayoutApiStatus {
  return DB_TO_API[status];
}

export function fromApiPayoutStatus(status: PayoutApiStatus): PayoutRequestStatus {
  return API_TO_DB[status];
}

export const RESERVED_PAYOUT_STATUSES: PayoutRequestStatus[] = [
  PayoutRequestStatus.PENDING,
  PayoutRequestStatus.APPROVED,
];
