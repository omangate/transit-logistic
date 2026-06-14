export type PayoutStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface PayoutRequest {
  id: string;
  walletId: string;
  userId: string;
  amount: string;
  currency: string;
  bankDetails: Record<string, unknown>;
  status: PayoutStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; email: string; role: string };
}

export interface PayoutSummary {
  totals: Record<PayoutStatus, { count: number; amount: string }>;
}

export interface PaginatedPayouts {
  data: PayoutRequest[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface FleetRatingSummary {
  averageScore: number;
  totalRatings: number;
  recent: Array<{
    id: string;
    score: number;
    comment: string | null;
    createdAt: string;
    shipment: { referenceNumber: string };
  }>;
}
