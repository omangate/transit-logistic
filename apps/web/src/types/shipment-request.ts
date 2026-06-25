import type { CargoType, ShipmentRequestStatus, VehicleType } from '@transit-logistic/shared';

export type CreateShipmentRequestInput = {
  pickupAddress: string;
  pickupGeoRegionId?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryAddress: string;
  deliveryGeoRegionId?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  cargoType?: CargoType;
  weightKg?: number;
  preferredDate?: string;
  notes?: string;
  requiredVehicleType?: VehicleType;
  requiresRefrigerated?: boolean;
  requiresCrossBorder?: boolean;
  requiresContainer?: boolean;
};

export type ShipmentRequestRecord = {
  id: string;
  status: ShipmentRequestStatus;
  pickupAddress: string;
  deliveryAddress: string;
  cargoType: CargoType | null;
  weightKg: string | null;
  preferredDate: string | null;
  notes: string | null;
  createdAt: string;
  pickupRegion?: { nameEn: string; nameAr: string } | null;
  deliveryRegion?: { nameEn: string; nameAr: string } | null;
  matches?: Array<{
    id: string;
    fleetOwner: { companyName: string };
    truckListing?: { name: string; slug: string } | null;
  }>;
};
