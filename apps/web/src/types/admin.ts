import type { ShipmentStatus } from '@transit-logistic/shared';

import type { PaymentIntent } from './payment';
import type { Shipment } from './shipment';

export interface AdminDashboardMetrics {
  shipments: {
    total: number;
    draft: number;
    pending_assignment: number;
    assigned: number;
    active: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
  recentShipments: Shipment[];
  revenue: {
    total: string;
    currency: string;
  };
  pendingPayments: {
    count: number;
    total: string;
    currency: string;
  };
  fleet: {
    owners: number;
    drivers: number;
    vehicles: number;
  };
  pendingPayoutRequests: number;
  latestNotifications: AdminDashboardNotification[];
}

export interface AdminDashboardNotification {
  id: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminCustomer {
  id: string;
  email: string;
  phone: string | null;
  fullName: string | null;
  company: string | null;
  isActive: boolean;
  isVerified: boolean;
  locale: string;
  shipmentCount: number;
  createdAt: string;
}

export interface AdminRating {
  id: string;
  score: number;
  comment: string | null;
  createdAt: string;
  shipmentReference: string;
  fleetOwnerName: string;
  customerEmail: string;
  customerName: string | null;
}

export interface PaginatedAdminRatings {
  data: AdminRating[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface PaginatedPayments {
  data: PaymentIntent[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface FleetOwnerOption {
  id: string;
  companyName: string;
  taxId: string | null;
  kycStatus: string;
  user: {
    id: string;
    email: string;
    phone: string | null;
    isActive: boolean;
  };
  vehicleCount: number;
  driverCount: number;
}

export interface FleetDriverOption {
  id: string;
  fleetOwnerId: string;
  licenseNumber: string;
  isAvailable: boolean;
  user: {
    id: string;
    email: string;
    phone: string | null;
    role: string;
    isActive: boolean;
    locale: string;
  };
}

export interface FleetVehicleOption {
  id: string;
  fleetOwnerId: string;
  plateNumber: string;
  vehicleType: string;
  capacityKg: string | null;
  isActive: boolean;
}

export interface AssignShipmentInput {
  fleetOwnerId: string;
  vehicleId: string;
  driverId: string;
}

export interface UpdateShipmentStatusInput {
  status: ShipmentStatus;
  note?: string;
}
