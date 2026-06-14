import { PayoutRequestStatus } from '@prisma/client';

export type PayoutApiStatus = 'pending' | 'approved' | 'rejected' | 'paid';

const DB_TO_API: Record<PayoutRequestStatus, PayoutApiStatus> = {
  [PayoutRequestStatus.pending]: 'pending',
  [PayoutRequestStatus.approved]: 'approved',
  [PayoutRequestStatus.rejected]: 'rejected',
  [PayoutRequestStatus.processed]: 'paid',
};

const API_TO_DB: Record<PayoutApiStatus, PayoutRequestStatus> = {
  pending: PayoutRequestStatus.pending,
  approved: PayoutRequestStatus.approved,
  rejected: PayoutRequestStatus.rejected,
  paid: PayoutRequestStatus.processed,
};

export function toApiPayoutStatus(status: PayoutRequestStatus): PayoutApiStatus {
  return DB_TO_API[status];
}

export function fromApiPayoutStatus(status: PayoutApiStatus): PayoutRequestStatus {
  return API_TO_DB[status];
}

export const RESERVED_PAYOUT_STATUSES: PayoutRequestStatus[] = [
  PayoutRequestStatus.pending,
  PayoutRequestStatus.approved,
];
