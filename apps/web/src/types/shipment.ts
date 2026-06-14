import type { CargoType, ShipmentStatus, ShippingMethod } from '@transit-logistic/shared';

export interface ShipmentStop {
  id: string;
  shipmentId: string;
  sequence: number;
  address: string;
  city: string;
  latitude: string | number;
  longitude: string | number;
  stopType: 'pickup' | 'delivery';
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentPricing {
  baseAmount: string;
  platformFee: string;
  totalAmount: string;
  currency: string;
  breakdown: unknown;
}

export interface Shipment {
  id: string;
  referenceNumber: string;
  customerId: string;
  fleetOwnerId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  status: ShipmentStatus;
  cargoType: CargoType;
  cargoDescription: string | null;
  weightKg: string | null;
  packageCount: number | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  shippingMethod: ShippingMethod;
  isCrossBorder: boolean;
  scheduledAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stops: ShipmentStop[];
  pricing: ShipmentPricing | null;
  fleetOwner: { id: string; companyName: string } | null;
  vehicle: { id: string; plateNumber: string } | null;
}

export interface PaginatedShipments {
  data: Shipment[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateShipmentStopInput {
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  stopType: 'pickup' | 'delivery';
}

export interface UpdateShipmentRequest {
  cargoType?: CargoType;
  cargoDescription?: string;
  weightKg?: number;
  packageCount?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  shippingMethod?: ShippingMethod;
  isCrossBorder?: boolean;
  scheduledAt?: string;
  stops?: CreateShipmentStopInput[];
}

export interface CreateShipmentRequest {
  cargoType?: CargoType;
  cargoDescription?: string;
  weightKg?: number;
  packageCount?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  shippingMethod?: ShippingMethod;
  isCrossBorder?: boolean;
  scheduledAt?: string;
  stops: CreateShipmentStopInput[];
}

export interface ShipmentDocument {
  id: string;
  shipmentId: string;
  documentType: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface ShipmentContract {
  id: string;
  shipmentId: string;
  contractNumber: string;
  termsVersion: string;
  signedAt: string;
  payload: Record<string, unknown>;
}

export interface ShipmentInvoice {
  id: string;
  shipmentId: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  issuedAt: string;
  payload: Record<string, unknown>;
}

export interface CarrierRating {
  id: string;
  shipmentId: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

export interface ShipmentListQuery {
  status?: ShipmentStatus;
  page?: number;
  limit?: number;
  search?: string;
}

export interface ShipmentTimeline {
  history: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    note: string | null;
    createdAt: string;
  }>;
}
