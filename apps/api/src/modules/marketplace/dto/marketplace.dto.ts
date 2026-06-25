import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CargoType,
  ShippingMethod,
  VehicleCategory,
  VehicleType,
} from '@transit-logistic/shared';

export class CreateTruckListingDto {
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(1980)
  @Max(2100)
  year?: number;

  @IsEnum(VehicleCategory)
  vehicleCategory!: VehicleCategory;

  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityCbm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthM?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  widthM?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  heightM?: number;

  @IsOptional()
  @IsEnum(CargoType)
  cargoType?: CargoType;

  @IsOptional()
  @IsEnum(ShippingMethod)
  shippingMethod?: ShippingMethod;

  @IsOptional()
  @IsBoolean()
  crossBorderSupport?: boolean;

  @IsOptional()
  @IsBoolean()
  refrigeratedSupport?: boolean;

  @IsOptional()
  @IsBoolean()
  hazardousMaterialsSupport?: boolean;

  @IsOptional()
  @IsBoolean()
  containerTransportSupport?: boolean;

  @IsOptional()
  @IsBoolean()
  insuranceCoverage?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  plateNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  videoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  serviceAreaIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  operatingCountries?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyRentalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weeklyRentalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyRentalPrice?: number;

  @IsOptional()
  @IsBoolean()
  withDriverAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  withoutDriverAvailable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  minRentalDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  galleryImages?: string[];
}

export class UpdateTruckListingDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(1980)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsEnum(VehicleCategory)
  vehicleCategory?: VehicleCategory;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityCbm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthM?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  widthM?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  heightM?: number;

  @IsOptional()
  @IsEnum(CargoType)
  cargoType?: CargoType;

  @IsOptional()
  @IsEnum(ShippingMethod)
  shippingMethod?: ShippingMethod;

  @IsOptional()
  @IsBoolean()
  crossBorderSupport?: boolean;

  @IsOptional()
  @IsBoolean()
  refrigeratedSupport?: boolean;

  @IsOptional()
  @IsBoolean()
  hazardousMaterialsSupport?: boolean;

  @IsOptional()
  @IsBoolean()
  containerTransportSupport?: boolean;

  @IsOptional()
  @IsBoolean()
  insuranceCoverage?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  plateNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  videoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  serviceAreaIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operatingCountries?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyRentalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weeklyRentalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyRentalPrice?: number;

  @IsOptional()
  @IsBoolean()
  withDriverAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  withoutDriverAvailable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  minRentalDays?: number;

  @IsOptional()
  @IsBoolean()
  isListingEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryImages?: string[];
}

export class SetCoverImageDto {
  @IsString()
  @MaxLength(500)
  imageUrl!: string;
}

export class MarketplaceBrowseQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(VehicleCategory)
  category?: VehicleCategory;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsBoolean()
  crossBorder?: boolean;

  @IsOptional()
  @IsBoolean()
  refrigerated?: boolean;

  @IsOptional()
  @IsBoolean()
  containerTransport?: boolean;

  @IsOptional()
  @IsUUID()
  governorateId?: string;

  @IsOptional()
  @IsUUID()
  wilayatId?: string;

  @IsOptional()
  @IsUUID()
  pickupGeoRegionId?: string;

  @IsOptional()
  @IsUUID()
  deliveryGeoRegionId?: string;

  @IsOptional()
  @IsString()
  availability?: 'available' | 'busy' | 'maintenance';

  @IsOptional()
  @IsNumber()
  @Min(0)
  minCapacityKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCapacityKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  sort?: 'rating' | 'newest' | 'deliveries' | 'price_asc' | 'price_desc';
}

export class CreateQuoteRequestDto {
  @IsString()
  @MinLength(2)
  originCity!: string;

  @IsString()
  @MinLength(2)
  originCountry!: string;

  @IsString()
  @MinLength(2)
  destCity!: string;

  @IsString()
  @MinLength(2)
  destCountry!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cargoDetails?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  preferredDate?: string;
}

export class CreateTruckReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  communicationScore!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  deliverySpeedScore!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  vehicleConditionScore!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  professionalismScore!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  overallScore!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;
}

export class AdminModerateListingDto {
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isListingEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

export class RespondQuoteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  fleetResponse!: string;
}
