import type {
  CargoType,
  QuoteRequestStatus,
  ShippingMethod,
  TruckAvailabilityStatus,
  TruckListingStatus,
  VehicleCategory,
  VehicleType,
} from '@transit-logistic/shared';

export type TruckListingImage = {
  id: string;
  url: string;
  sortOrder: number;
  isCover: boolean;
};

export type TruckServiceArea = {
  geoRegion: {
    id: string;
    code: string;
    type: string;
    nameEn: string;
    nameAr: string;
    parentId: string | null;
  };
};

export type TruckListingSummary = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  vehicleCategory: VehicleCategory;
  vehicleType: VehicleType;
  capacityKg: string | null;
  capacityCbm: string | null;
  coverImageUrl: string | null;
  crossBorderSupport: boolean;
  refrigeratedSupport: boolean;
  containerTransportSupport?: boolean;
  insuranceCoverage?: boolean;
  pricePerKm: string | null;
  dailyRentalPrice?: string | null;
  weeklyRentalPrice?: string | null;
  monthlyRentalPrice?: string | null;
  withDriverAvailable?: boolean;
  withoutDriverAvailable?: boolean;
  minRentalDays?: number | null;
  avgRating: string;
  reviewCount: number;
  completedDeliveries: number;
  isFeatured: boolean;
  availabilityStatus: TruckAvailabilityStatus;
  operatingCountries: string[];
  images?: TruckListingImage[];
  serviceAreas?: TruckServiceArea[];
  fleetOwner?: {
    id: string;
    companyName: string;
    kycStatus: string;
  };
};

export type TruckReview = {
  id: string;
  communicationScore: number;
  deliverySpeedScore: number;
  vehicleConditionScore: number;
  professionalismScore: number;
  overallScore: number;
  comment: string | null;
  createdAt: string;
  customer?: {
    customerProfile?: { fullName: string } | null;
  };
};

export type TruckListingDetail = TruckListingSummary & {
  lengthM: string | null;
  widthM: string | null;
  heightM: string | null;
  cargoType: CargoType;
  shippingMethod: ShippingMethod;
  hazardousMaterialsSupport: boolean;
  containerTransportSupport?: boolean;
  insuranceCoverage: boolean;
  videoUrl?: string | null;
  description: string | null;
  viewCount: number;
  listingStatus: TruckListingStatus;
  isListingEnabled: boolean;
  images: TruckListingImage[];
  serviceAreas?: TruckServiceArea[];
  reviews: TruckReview[];
  fleetOwner: {
    id: string;
    companyName: string;
    kycStatus: string;
    _count?: { truckListings: number; ratings: number };
  };
};

export type PaginatedTruckListings = {
  items: TruckListingSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type MarketplaceBrowseQuery = {
  search?: string;
  category?: VehicleCategory;
  vehicleType?: VehicleType;
  country?: string;
  crossBorder?: boolean;
  refrigerated?: boolean;
  containerTransport?: boolean;
  governorateId?: string;
  wilayatId?: string;
  pickupGeoRegionId?: string;
  deliveryGeoRegionId?: string;
  minCapacityKg?: number;
  maxCapacityKg?: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  featured?: boolean;
  availability?: TruckAvailabilityStatus;
  page?: number;
  limit?: number;
  sort?: 'rating' | 'newest' | 'deliveries' | 'price_asc' | 'price_desc';
};

export type MarketplaceHomeSections = {
  featured: TruckListingSummary[];
  recent: TruckListingSummary[];
  topRated: TruckListingSummary[];
  premiumFleets: Array<{
    id: string;
    companyName: string;
    kycStatus: string;
    truckListings: Array<{ coverImageUrl: string | null; avgRating: string }>;
    _count: { truckListings: number };
  }>;
};

export type CreateTruckListingInput = {
  vehicleId?: string;
  name: string;
  brand?: string;
  model?: string;
  year?: number;
  vehicleCategory: VehicleCategory;
  vehicleType: VehicleType;
  capacityKg?: number;
  capacityCbm?: number;
  lengthM?: number;
  widthM?: number;
  heightM?: number;
  cargoType?: CargoType;
  shippingMethod?: ShippingMethod;
  crossBorderSupport?: boolean;
  refrigeratedSupport?: boolean;
  hazardousMaterialsSupport?: boolean;
  containerTransportSupport?: boolean;
  insuranceCoverage?: boolean;
  plateNumber?: string;
  videoUrl?: string;
  serviceAreaIds?: string[];
  operatingCountries?: string[];
  description?: string;
  coverImageUrl?: string;
  pricePerKm?: number;
  dailyRentalPrice?: number;
  weeklyRentalPrice?: number;
  monthlyRentalPrice?: number;
  withDriverAvailable?: boolean;
  withoutDriverAvailable?: boolean;
  minRentalDays?: number;
  availabilityStatus?: TruckAvailabilityStatus;
  galleryImages?: string[];
};

export type UpdateTruckListingInput = Partial<
  Omit<CreateTruckListingInput, 'vehicleId'>
> & {
  isListingEnabled?: boolean;
};

export type CreateQuoteRequestInput = {
  originCity: string;
  originCountry: string;
  destCity: string;
  destCountry: string;
  cargoDetails?: string;
  weightKg?: number;
  preferredDate?: string;
};

export type TruckQuoteRequest = {
  id: string;
  status: QuoteRequestStatus;
  originCity: string;
  originCountry: string;
  destCity: string;
  destCountry: string;
  cargoDetails: string | null;
  fleetResponse: string | null;
  createdAt: string;
  truckListing?: { name: string; slug: string; coverImageUrl?: string | null };
};

export type MarketplaceAdminMetrics = {
  totalTrucks: number;
  activeTrucks: number;
  featuredTrucks: number;
  pendingApprovals: number;
  marketplaceViews: number;
  quoteRequests: number;
  shipmentRequests: number;
  fleetCompanies: number;
  customers: number;
  completedDeliveries: number;
  mostViewedTrucks: Array<{ id: string; name: string; slug: string; viewCount: number }>;
  mostActiveFleetOwners: Array<{
    id: string;
    companyName: string;
    _count: { truckListings: number };
  }>;
  popularRoutes: Array<{
    pickupAddress: string;
    deliveryAddress: string;
    pickupRegion: { nameEn: string; nameAr: string } | null;
    deliveryRegion: { nameEn: string; nameAr: string } | null;
  }>;
};

export type FleetTruckListing = TruckListingSummary & {
  listingStatus: TruckListingStatus;
  isListingEnabled: boolean;
  rejectionReason: string | null;
  viewCount?: number;
  withDriverAvailable?: boolean;
  withoutDriverAvailable?: boolean;
  minRentalDays?: number | null;
  plateNumber?: string | null;
  videoUrl?: string | null;
  hazardousMaterialsSupport?: boolean;
  containerTransportSupport?: boolean;
  insuranceCoverage?: boolean;
  lengthM?: string | null;
  widthM?: string | null;
  heightM?: string | null;
  description?: string | null;
  images: TruckListingImage[];
  serviceAreas?: TruckServiceArea[];
  fleetOwner?: { companyName: string };
};
