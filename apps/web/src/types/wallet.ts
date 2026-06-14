export interface Wallet {
  id: string;
  userId: string;
  balance: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: string;
  amount: string;
  currency: string;
  description: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface PaginatedWalletTransactions {
  data: WalletTransaction[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
